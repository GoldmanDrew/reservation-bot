import {
  formatMinutesToDisplay,
  formatMinutesToTime,
  toOpenTableDateTime,
} from "./time.mjs";

const OT_ORIGIN = "https://www.opentable.com";

function otHeaders(config) {
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

export function getOpenTableConfigFromEnv() {
  const cookies = process.env.OPENTABLE_COOKIES;
  if (!cookies?.trim()) {
    throw new Error(
      "Set OPENTABLE_COOKIES in GitHub Secrets (paste Cookie header from logged-in opentable.com)"
    );
  }
  return {
    cookies: cookies.trim(),
    csrfToken: process.env.OPENTABLE_CSRF_TOKEN,
  };
}

export async function verifyOpenTableAuth(config) {
  const res = await fetch(`${OT_ORIGIN}/dapi/user/profile`, {
    headers: otHeaders(config),
  });
  return res.ok;
}

export async function searchOpenTableRestaurants(config, query, lat = 40.7128, lon = -74.006) {
  const res = await fetch(
    `${OT_ORIGIN}/dapi/fe/gql?optype=query&opname=Autocomplete`,
    {
      method: "POST",
      headers: { ...otHeaders(config), "Content-Type": "application/json" },
      body: JSON.stringify({
        operationName: "Autocomplete",
        variables: {
          term: query,
          latitude: lat,
          longitude: lon,
          correlationId: String(Date.now()),
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
    throw new Error(`OpenTable search failed (${res.status}) — refresh OPENTABLE_COOKIES`);
  }

  const data = await res.json();
  const suggestions = data.data?.autocomplete?.restaurantSuggestions ?? [];
  return suggestions
    .filter((s) => s.restaurantId && s.name)
    .map((s) => {
      const slug = s.profileUrl?.replace(/^\/r\//, "").split("?")[0];
      return {
        platform: "opentable",
        venueId: String(s.restaurantId),
        name: s.name,
        slug,
        location: s.metroName,
        url: s.profileUrl ? `${OT_ORIGIN}${s.profileUrl}` : `${OT_ORIGIN}/r/${slug ?? s.restaurantId}`,
      };
    });
}

export async function resolveOpenTableBySlug(slug, config = null) {
  config = config ?? getOpenTableConfigFromEnv();

  const res = await fetch(
    `${OT_ORIGIN}/dapi/fe/gql?optype=query&opname=RestaurantProfile`,
    {
      method: "POST",
      headers: { ...otHeaders(config), "Content-Type": "application/json" },
      body: JSON.stringify({
        operationName: "RestaurantProfile",
        variables: { urlSlug: slug },
        query: `query RestaurantProfile($urlSlug: String!) {
          restaurant(urlSlug: $urlSlug) {
            restaurantId
            name
            urls { profileLink }
            metro { name }
          }
        }`,
      }),
    }
  );

  if (!res.ok) return null;

  const data = await res.json();
  const r = data.data?.restaurant;
  if (!r?.restaurantId || !r.name) return null;

  return {
    platform: "opentable",
    venueId: String(r.restaurantId),
    venue_id: String(r.restaurantId),
    name: r.name,
    slug,
    location: r.metro?.name,
    url: r.urls?.profileLink ? `${OT_ORIGIN}${r.urls.profileLink}` : `${OT_ORIGIN}/r/${slug}`,
  };
}

export async function checkOpenTableAvailability(config, venueId, date, partySize) {
  const dateTime = `${date}T19:00:00`;

  const res = await fetch(
    `${OT_ORIGIN}/dapi/fe/gql?optype=query&opname=RestaurantsAvailability`,
    {
      method: "POST",
      headers: { ...otHeaders(config), "Content-Type": "application/json" },
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
    const text = await res.text();
    throw new Error(
      `OpenTable availability failed (${res.status}) — cookies may be expired. ${text.slice(0, 120)}`
    );
  }

  const data = await res.json();
  const days = data.data?.availability?.[0]?.availabilityDays ?? [];
  const allSlots = days.flatMap((d) => d.slots ?? []);
  const baseMinutes = 19 * 60;

  return allSlots
    .filter((s) => s.isAvailable && s.timeOffsetMinutes !== undefined)
    .map((s) => {
      const minutes = baseMinutes + (s.timeOffsetMinutes ?? 0);
      return {
        time: formatMinutesToTime(minutes),
        displayTime: formatMinutesToDisplay(minutes),
        configId: s.slotHash,
        configToken: s.slotAvailabilityToken,
      };
    });
}

export function buildOpenTableBookingUrl(venueId, date, minutes, partySize) {
  const dateTime = encodeURIComponent(toOpenTableDateTime(date, minutes));
  return `${OT_ORIGIN}/booking/details?rid=${venueId}&dateTime=${dateTime}&partySize=${partySize}&reservationType=Standard`;
}

export async function bookOpenTableSlot(config, venueId, date, slot, partySize, dryRun = false) {
  const [h, m] = slot.time.split(":").map(Number);
  const minutes = h * 60 + m;
  const handoffUrl = buildOpenTableBookingUrl(venueId, date, minutes, partySize);

  if (dryRun) {
    return {
      ok: true,
      message: "Dry run — would notify with booking URL",
      bookedTime: slot.displayTime,
      handoffUrl,
    };
  }

  if (slot.configToken) {
    try {
      const res = await fetch(`${OT_ORIGIN}/dapi/booking/make-reservation`, {
        method: "POST",
        headers: { ...otHeaders(config), "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId: parseInt(venueId, 10),
          partySize,
          dateTime: toOpenTableDateTime(date, minutes),
          slotAvailabilityToken: slot.configToken,
          slotHash: slot.configId,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        return {
          ok: true,
          confirmationId: data.confirmationNumber,
          bookedTime: slot.displayTime,
          message: "Reservation confirmed on OpenTable!",
        };
      }
    } catch {
      // fall through to handoff
    }
  }

  return {
    ok: true,
    bookedTime: slot.displayTime,
    handoffUrl,
    message: "Slot found — open booking URL to confirm (OpenTable handoff)",
  };
}
