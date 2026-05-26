import {
  DEFAULT_RESY_API_KEY,
  formatMinutesToDisplay,
  formatMinutesToTime,
  parseResySlotTime,
} from "./time.mjs";

const BASE_URL = "https://api.resy.com";

function buildHeaders(config, extra = {}) {
  const headers = {
    Authorization: `ResyAPI api_key="${config.apiKey}"`,
    Origin: "https://resy.com",
    Referer: "https://resy.com/",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    ...extra,
  };
  if (config.authToken) {
    headers["x-resy-auth-token"] = config.authToken;
  }
  return headers;
}

export async function loginResy(email, password, apiKey = DEFAULT_RESY_API_KEY) {
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

  const data = await res.json();
  if (!data.token) throw new Error("Resy login succeeded but no token returned");
  return { apiKey, authToken: data.token };
}

export async function searchResyRestaurants(query, lat = 40.7128, lon = -74.006) {
  const config = { apiKey: DEFAULT_RESY_API_KEY, authToken: "" };
  const res = await fetch(`${BASE_URL}/3/venuesearch/search`, {
    method: "POST",
    headers: buildHeaders(config, { "Content-Type": "application/json" }),
    body: JSON.stringify({
      query,
      geo: { latitude: lat, longitude: lon },
      types: ["venue"],
      per_page: 10,
    }),
  });

  if (!res.ok) throw new Error(`Resy search failed (${res.status})`);

  const data = await res.json();
  const hits = data.search?.hits ?? [];
  return hits
    .filter((h) => h.id && h.name)
    .map((h) => {
      const id = h.id;
      const venueId =
        typeof id === "object"
          ? String(id.resy_id ?? id.id ?? id.venue_id ?? "")
          : String(id);
      return {
        platform: "resy",
        venueId,
        name: h.name,
        location: h.location?.name,
        url: h.url_slug
          ? `https://resy.com/cities/${h.location?.code ?? "ny"}/venues/${h.url_slug}`
          : undefined,
      };
    })
    .filter((r) => r.venueId);
}

export async function checkResyAvailability(config, venueId, date, partySize) {
  const params = new URLSearchParams({
    lat: "0",
    long: "0",
    day: date,
    party_size: String(partySize),
    venue_id: venueId,
  });

  const res = await fetch(`${BASE_URL}/4/find?${params}`, {
    headers: buildHeaders(config),
  });

  if (!res.ok) throw new Error(`Availability check failed (${res.status})`);

  const data = await res.json();
  const slots = data.results?.venues?.[0]?.slots ?? [];

  return slots
    .filter((s) => s.date?.start && s.config?.token)
    .map((s) => {
      const minutes = parseResySlotTime(s.date.start);
      return {
        time: formatMinutesToTime(minutes),
        displayTime: formatMinutesToDisplay(minutes),
        configToken: s.config.token,
        seatingType: s.config.type,
      };
    });
}

async function getPaymentMethodId(config) {
  const res = await fetch(`${BASE_URL}/2/user`, { headers: buildHeaders(config) });
  if (!res.ok) throw new Error("Failed to fetch Resy user profile");

  const data = await res.json();
  const methods = data.payment_methods ?? [];
  const method = methods.find((m) => m.is_default) ?? methods[0];
  if (!method?.id) {
    throw new Error("No payment method on Resy account — add a card in the Resy app");
  }
  return method.id;
}

export async function bookResySlot(config, slot, date, partySize, dryRun = false) {
  const detailsParams = new URLSearchParams({
    config_id: slot.configToken,
    day: date,
    party_size: String(partySize),
  });

  const detailsRes = await fetch(`${BASE_URL}/3/details?${detailsParams}`, {
    headers: buildHeaders(config),
  });

  if (!detailsRes.ok) {
    return { ok: false, message: `Failed to get booking details (${detailsRes.status})` };
  }

  const details = await detailsRes.json();
  const bookToken = details.book_token?.value;
  if (!bookToken) return { ok: false, message: "No book token — slot may be gone" };

  if (dryRun) {
    return {
      ok: true,
      message: "Dry run — would have booked",
      bookedTime: slot.displayTime,
    };
  }

  const paymentId = await getPaymentMethodId(config);
  const bookBody = new URLSearchParams({
    book_token: bookToken,
    struct_payment_method: JSON.stringify({ id: paymentId }),
  });

  const bookRes = await fetch(`${BASE_URL}/3/book`, {
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

  const result = await bookRes.json();
  return {
    ok: true,
    confirmationId: result.resy_token ?? result.reservation_id,
    bookedTime: slot.displayTime,
    message: "Reservation confirmed on Resy!",
  };
}

export async function getResyConfigFromEnv() {
  const email = process.env.RESY_EMAIL;
  const password = process.env.RESY_PASSWORD;
  const apiKey = process.env.RESY_API_KEY || DEFAULT_RESY_API_KEY;

  if (process.env.RESY_AUTH_TOKEN) {
    return { apiKey, authToken: process.env.RESY_AUTH_TOKEN };
  }

  if (!email || !password) {
    throw new Error("Set RESY_EMAIL and RESY_PASSWORD (or RESY_AUTH_TOKEN) in GitHub Secrets");
  }

  return loginResy(email, password, apiKey);
}
