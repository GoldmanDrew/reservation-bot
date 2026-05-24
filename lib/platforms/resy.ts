import {
  DEFAULT_RESY_API_KEY,
  getResyCredentials,
  setResyCredentials,
} from "@/lib/credentials";
import type { BookResult, RestaurantResult, TimeSlot } from "@/lib/types";
import {
  formatMinutesToDisplay,
  formatMinutesToTime,
  parseResySlotTime,
} from "@/lib/utils/time";

const BASE_URL = "https://api.resy.com";

interface ResyClientConfig {
  apiKey: string;
  authToken: string;
}

function buildHeaders(config: ResyClientConfig, json = false): HeadersInit {
  const headers: Record<string, string> = {
    Authorization: `ResyAPI api_key="${config.apiKey}"`,
    Origin: "https://resy.com",
    Referer: "https://resy.com/",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  };

  if (config.authToken) {
    headers["x-resy-auth-token"] = config.authToken;
  }
  if (json) {
    headers["Content-Type"] = "application/json";
  }

  return headers;
}

async function resyFetch(
  config: ResyClientConfig,
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = path.startsWith("http") ? path : `${BASE_URL}${path}`;
  return fetch(url, {
    ...options,
    headers: {
      ...buildHeaders(config, options.method === "POST" && !options.body?.toString().includes("=")),
      ...(options.headers ?? {}),
    },
  });
}

export async function loginResy(
  email: string,
  password: string,
  apiKey = DEFAULT_RESY_API_KEY
): Promise<{ authToken: string; apiKey: string }> {
  const body = new URLSearchParams({ email, password });
  const res = await fetch(`${BASE_URL}/3/auth/password`, {
    method: "POST",
    headers: {
      ...buildHeaders({ apiKey, authToken: "" }),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Resy login failed (${res.status}): ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as { token?: string };
  if (!data.token) {
    throw new Error("Resy login succeeded but no token returned");
  }

  const creds = { apiKey, authToken: data.token, email };
  setResyCredentials(creds);
  return { authToken: data.token, apiKey };
}

export function getResyClient(): ResyClientConfig {
  const creds = getResyCredentials();
  if (!creds?.authToken) {
    throw new Error("Resy not connected. Add credentials in Settings.");
  }
  return {
    apiKey: creds.apiKey || DEFAULT_RESY_API_KEY,
    authToken: creds.authToken,
  };
}

export async function searchResyRestaurants(
  query: string,
  lat = 40.7128,
  lon = -74.006
): Promise<RestaurantResult[]> {
  const config: ResyClientConfig = {
    apiKey: getResyCredentials()?.apiKey || DEFAULT_RESY_API_KEY,
    authToken: getResyCredentials()?.authToken || "",
  };

  const res = await resyFetch(config, "/3/venuesearch/search", {
    method: "POST",
    headers: buildHeaders(config, true),
    body: JSON.stringify({
      query,
      geo: { latitude: lat, longitude: lon },
      types: ["venue"],
      per_page: 10,
    }),
  });

  if (!res.ok) {
    throw new Error(`Resy search failed (${res.status})`);
  }

  const data = (await res.json()) as {
    search?: { hits?: Array<{ id?: number; name?: string; url_slug?: string; location?: { name?: string; code?: string }; locale?: { latitude?: number; longitude?: number } }> };
  };

  const hits = data.search?.hits ?? [];
  return hits
    .filter((h) => h.id && h.name)
    .map((h) => ({
      platform: "resy" as const,
      venueId: String(h.id),
      name: h.name!,
      location: h.location?.name,
      slug: h.url_slug,
      lat: h.locale?.latitude,
      lon: h.locale?.longitude,
      url: h.url_slug
        ? `https://resy.com/cities/${h.location?.code ?? "ny"}/venues/${h.url_slug}`
        : undefined,
    }));
}

export async function resolveResyVenueBySlug(
  slug: string,
  cityCode = "ny"
): Promise<RestaurantResult | null> {
  const config: ResyClientConfig = {
    apiKey: getResyCredentials()?.apiKey || DEFAULT_RESY_API_KEY,
    authToken: getResyCredentials()?.authToken || "",
  };

  const params = new URLSearchParams({ url_slug: slug, location: cityCode });
  const res = await resyFetch(config, `/3/venue?${params}`);

  if (!res.ok) return null;

  const data = (await res.json()) as {
    id?: { resy?: number };
    name?: string;
    location?: { code?: string; name?: string };
    latitude?: number;
    longitude?: number;
    url_slug?: string;
  };

  if (!data.id?.resy || !data.name) return null;

  return {
    platform: "resy",
    venueId: String(data.id.resy),
    name: data.name,
    location: data.location?.name,
    slug: data.url_slug ?? slug,
    lat: data.latitude,
    lon: data.longitude,
    url: `https://resy.com/cities/${data.location?.code ?? cityCode}/venues/${data.url_slug ?? slug}`,
  };
}

export async function checkResyAvailability(
  venueId: string,
  date: string,
  partySize: number,
  lat = 0,
  lon = 0
): Promise<TimeSlot[]> {
  const config = getResyClient();
  const params = new URLSearchParams({
    lat: String(lat),
    long: String(lon),
    day: date,
    party_size: String(partySize),
    venue_id: venueId,
  });

  const res = await resyFetch(config, `/4/find?${params}`);
  if (!res.ok) {
    throw new Error(`Resy availability check failed (${res.status})`);
  }

  const data = (await res.json()) as {
    results?: {
      venues?: Array<{
        slots?: Array<{
          config?: { id?: string; token?: string; type?: string };
          date?: { start?: string };
        }>;
      }>;
    };
  };

  const slots = data.results?.venues?.[0]?.slots ?? [];
  return slots
    .filter((s) => s.date?.start && s.config?.token)
    .map((s) => {
      const minutes = parseResySlotTime(s.date!.start!);
      return {
        time: formatMinutesToTime(minutes),
        displayTime: formatMinutesToDisplay(minutes),
        configId: s.config!.id,
        configToken: s.config!.token,
        seatingType: s.config!.type,
        raw: s,
      };
    });
}

async function getResyPaymentMethodId(config: ResyClientConfig): Promise<number> {
  const res = await resyFetch(config, "/2/user");
  if (!res.ok) {
    throw new Error("Failed to fetch Resy user profile — check auth token");
  }

  const data = (await res.json()) as {
    payment_methods?: Array<{ id?: number; is_default?: boolean }>;
  };

  const methods = data.payment_methods ?? [];
  const defaultMethod = methods.find((m) => m.is_default) ?? methods[0];
  if (!defaultMethod?.id) {
    throw new Error("No payment method on Resy account — add a card in the Resy app");
  }
  return defaultMethod.id;
}

export async function bookResySlot(
  slot: TimeSlot,
  date: string,
  partySize: number,
  dryRun = false
): Promise<BookResult> {
  if (!slot.configToken) {
    return { ok: false, message: "Missing config token for slot" };
  }

  const config = getResyClient();

  const detailsParams = new URLSearchParams({
    config_id: slot.configToken,
    day: date,
    party_size: String(partySize),
  });

  const detailsRes = await resyFetch(config, `/3/details?${detailsParams}`);
  if (!detailsRes.ok) {
    return { ok: false, message: `Failed to get booking details (${detailsRes.status})` };
  }

  const details = (await detailsRes.json()) as {
    book_token?: { value?: string };
  };

  const bookToken = details.book_token?.value;
  if (!bookToken) {
    return { ok: false, message: "No book token returned — slot may be gone" };
  }

  if (dryRun) {
    return {
      ok: true,
      message: "Dry run — would have booked this slot",
      bookedTime: slot.displayTime,
    };
  }

  const paymentId = await getResyPaymentMethodId(config);
  const bookBody = new URLSearchParams({
    book_token: bookToken,
    struct_payment_method: JSON.stringify({ id: paymentId }),
  });

  const bookRes = await resyFetch(config, "/3/book", {
    method: "POST",
    headers: {
      ...buildHeaders(config),
      "Content-Type": "application/x-www-form-urlencoded",
      Origin: "https://widgets.resy.com",
      Referer: "https://widgets.resy.com/",
    },
    body: bookBody.toString(),
  });

  if (!bookRes.ok) {
    const text = await bookRes.text();
    return { ok: false, message: `Booking failed (${bookRes.status}): ${text.slice(0, 200)}` };
  }

  const result = (await bookRes.json()) as {
    resy_token?: string;
    reservation_id?: string;
  };

  return {
    ok: true,
    confirmationId: result.resy_token ?? result.reservation_id,
    bookedTime: slot.displayTime,
    message: "Reservation confirmed on Resy",
  };
}

export async function verifyResyAuth(): Promise<boolean> {
  try {
    const config = getResyClient();
    const res = await resyFetch(config, "/2/user");
    return res.ok;
  } catch {
    return false;
  }
}
