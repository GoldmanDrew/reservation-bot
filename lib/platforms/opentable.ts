import { getOpenTableCredentials, setOpenTableCredentials } from "@/lib/credentials";
import type { BookResult, RestaurantResult, TimeSlot } from "@/lib/types";
import {
  formatMinutesToDisplay,
  formatMinutesToTime,
  toOpenTableDateTime,
} from "@/lib/utils/time";

const OT_ORIGIN = "https://www.opentable.com";

interface OTClientConfig {
  cookies: string;
  csrfToken?: string;
}

function getOTClient(): OTClientConfig {
  const creds = getOpenTableCredentials();
  if (!creds?.cookies) {
    throw new Error("OpenTable not connected. Add session cookies in Settings.");
  }
  return creds;
}

function otHeaders(config: OTClientConfig): HeadersInit {
  return {
    Cookie: config.cookies,
    Origin: OT_ORIGIN,
    Referer: `${OT_ORIGIN}/`,
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    Accept: "application/json",
    ...(config.csrfToken ? { "x-csrf-token": config.csrfToken } : {}),
  };
}

export function saveOpenTableSession(
  cookies: string,
  csrfToken?: string,
  email?: string
) {
  setOpenTableCredentials({ cookies, csrfToken, email });
}

export async function searchOpenTableRestaurants(
  query: string,
  lat = 40.7128,
  lon = -74.006
): Promise<RestaurantResult[]> {
  let config: OTClientConfig;
  try {
    config = getOTClient();
  } catch {
    return [];
  }

  const res = await fetch(
    `${OT_ORIGIN}/dapi/fe/gql?optype=query&opname=Autocomplete`,
    {
      method: "POST",
      headers: {
        ...otHeaders(config),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        operationName: "Autocomplete",
        variables: {
          term: query,
          latitude: lat,
          longitude: lon,
          correlationId: crypto.randomUUID?.() ?? String(Date.now()),
        },
        query: `query Autocomplete($term: String!, $latitude: Float, $longitude: Float, $correlationId: String) {
          autocomplete(term: $term, latitude: $latitude, longitude: $longitude, correlationId: $correlationId) {
            restaurantSuggestions {
              restaurantId
              name
              metroName
              profileUrl
            }
          }
        }`,
      }),
    }
  );

  if (!res.ok) {
    // Fallback: return empty if session invalid
    return [];
  }

  const data = (await res.json()) as {
    data?: {
      autocomplete?: {
        restaurantSuggestions?: Array<{
          restaurantId?: number;
          name?: string;
          metroName?: string;
          profileUrl?: string;
        }>;
      };
    };
  };

  const suggestions = data.data?.autocomplete?.restaurantSuggestions ?? [];
  return suggestions
    .filter((s) => s.restaurantId && s.name)
    .map((s) => ({
      platform: "opentable" as const,
      venueId: String(s.restaurantId),
      name: s.name!,
      location: s.metroName,
      url: s.profileUrl
        ? `${OT_ORIGIN}${s.profileUrl}`
        : `${OT_ORIGIN}/r/${s.restaurantId}`,
    }));
}

export async function resolveOpenTableBySlug(slug: string): Promise<RestaurantResult | null> {
  const config = getOTClient();

  const res = await fetch(
    `${OT_ORIGIN}/dapi/fe/gql?optype=query&opname=RestaurantProfile`,
    {
      method: "POST",
      headers: {
        ...otHeaders(config),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        operationName: "RestaurantProfile",
        variables: { urlSlug: slug },
        query: `query RestaurantProfile($urlSlug: String!) {
          restaurant(urlSlug: $urlSlug) {
            restaurantId
            name
            metro { name }
            urls { profileLink }
          }
        }`,
      }),
    }
  );

  if (!res.ok) return null;

  const data = (await res.json()) as {
    data?: {
      restaurant?: {
        restaurantId?: number;
        name?: string;
        metro?: { name?: string };
        urls?: { profileLink?: string };
      };
    };
  };

  const r = data.data?.restaurant;
  if (!r?.restaurantId || !r.name) return null;

  return {
    platform: "opentable",
    venueId: String(r.restaurantId),
    name: r.name,
    location: r.metro?.name,
    slug,
    url: r.urls?.profileLink
      ? `${OT_ORIGIN}${r.urls.profileLink}`
      : `${OT_ORIGIN}/r/${slug}`,
  };
}

export async function checkOpenTableAvailability(
  venueId: string,
  date: string,
  partySize: number
): Promise<TimeSlot[]> {
  const config = getOTClient();
  const dateTime = `${date}T19:00:00`;

  const res = await fetch(
    `${OT_ORIGIN}/dapi/fe/gql?optype=query&opname=RestaurantsAvailability`,
    {
      method: "POST",
      headers: {
        ...otHeaders(config),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        operationName: "RestaurantsAvailability",
        variables: {
          restaurantIds: [parseInt(venueId, 10)],
          date: dateTime,
          partySize,
          time: "19:00",
        },
        query: `query RestaurantsAvailability($restaurantIds: [Int!]!, $date: String!, $partySize: Int!, $time: String!) {
          availability(restaurantIds: $restaurantIds, date: $date, partySize: $partySize, time: $time) {
            availabilityDays {
              dayOffset
              slots {
                slotHash
                slotAvailabilityToken
                timeOffsetMinutes
                isAvailable
              }
            }
          }
        }`,
      }),
    }
  );

  if (!res.ok) {
    throw new Error(`OpenTable availability check failed (${res.status})`);
  }

  const data = (await res.json()) as {
    data?: {
      availability?: Array<{
        availabilityDays?: Array<{
          slots?: Array<{
            slotHash?: string;
            slotAvailabilityToken?: string;
            timeOffsetMinutes?: number;
            isAvailable?: boolean;
          }>;
        }>;
      }>;
    };
  };

  const days = data.data?.availability?.[0]?.availabilityDays ?? [];
  const allSlots = days.flatMap((d) => d.slots ?? []);

  return allSlots
    .filter((s) => s.isAvailable && s.timeOffsetMinutes !== undefined)
    .map((s) => {
      // timeOffsetMinutes is offset from 19:00 base in some OT responses
      const baseMinutes = 19 * 60;
      const minutes = baseMinutes + (s.timeOffsetMinutes ?? 0);
      return {
        time: formatMinutesToTime(minutes),
        displayTime: formatMinutesToDisplay(minutes),
        configId: s.slotHash,
        configToken: s.slotAvailabilityToken,
        raw: s,
      };
    });
}

export function buildOpenTableBookingUrl(
  venueId: string,
  date: string,
  minutes: number,
  partySize: number
): string {
  const dateTime = encodeURIComponent(toOpenTableDateTime(date, minutes));
  return `${OT_ORIGIN}/booking/details?rid=${venueId}&dateTime=${dateTime}&partySize=${partySize}&reservationType=Standard`;
}

export async function bookOpenTableSlot(
  venueId: string,
  date: string,
  slot: TimeSlot,
  partySize: number,
  dryRun = false
): Promise<BookResult> {
  const minutes = parseInt(slot.time.split(":")[0], 10) * 60 + parseInt(slot.time.split(":")[1], 10);
  const handoffUrl = buildOpenTableBookingUrl(venueId, date, minutes, partySize);

  if (dryRun) {
    return {
      ok: true,
      message: "Dry run — would open booking URL",
      bookedTime: slot.displayTime,
      handoffUrl,
    };
  }

  // OpenTable automated booking is fragile; use instant handoff URL
  if (slot.configToken) {
    const config = getOTClient();
    try {
      const res = await fetch(`${OT_ORIGIN}/dapi/booking/make-reservation`, {
        method: "POST",
        headers: {
          ...otHeaders(config),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          restaurantId: parseInt(venueId, 10),
          partySize,
          dateTime: toOpenTableDateTime(date, minutes),
          slotAvailabilityToken: slot.configToken,
          slotHash: slot.configId,
        }),
      });

      if (res.ok) {
        const data = (await res.json()) as { confirmationNumber?: string };
        return {
          ok: true,
          confirmationId: data.confirmationNumber,
          bookedTime: slot.displayTime,
          message: "Reservation confirmed on OpenTable",
        };
      }
    } catch {
      // Fall through to handoff
    }
  }

  return {
    ok: true,
    bookedTime: slot.displayTime,
    handoffUrl,
    message: "Slot found — complete booking in browser (OpenTable handoff)",
  };
}

export async function verifyOpenTableAuth(): Promise<boolean> {
  try {
    const config = getOTClient();
    const res = await fetch(`${OT_ORIGIN}/dapi/user/profile`, {
      headers: otHeaders(config),
    });
    return res.ok;
  } catch {
    return false;
  }
}
