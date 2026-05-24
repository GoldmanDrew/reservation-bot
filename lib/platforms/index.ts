import type { Platform, RestaurantResult } from "@/lib/types";
import {
  resolveOpenTableBySlug,
  searchOpenTableRestaurants,
} from "./opentable";
import { resolveResyVenueBySlug, searchResyRestaurants } from "./resy";

export async function searchAllRestaurants(
  query: string,
  lat = 40.7128,
  lon = -74.006
): Promise<RestaurantResult[]> {
  const [resyResults, otResults] = await Promise.allSettled([
    searchResyRestaurants(query, lat, lon),
    searchOpenTableRestaurants(query, lat, lon),
  ]);

  const results: RestaurantResult[] = [];

  if (resyResults.status === "fulfilled") {
    results.push(...resyResults.value);
  }
  if (otResults.status === "fulfilled") {
    results.push(...otResults.value);
  }

  return results;
}

export async function resolveFromUrl(
  platform: Platform,
  slug?: string,
  city?: string,
  venueId?: string
): Promise<RestaurantResult | null> {
  if (platform === "resy" && slug) {
    const cityCode = city?.includes("new-york") ? "ny" : "ny";
    return resolveResyVenueBySlug(slug, cityCode);
  }
  if (platform === "opentable") {
    if (venueId) {
      return {
        platform: "opentable",
        venueId,
        name: slug ?? `Restaurant ${venueId}`,
        slug,
        url: `https://www.opentable.com/r/${slug ?? venueId}`,
      };
    }
    if (slug) return resolveOpenTableBySlug(slug);
  }
  return null;
}

export { checkResyAvailability, bookResySlot } from "./resy";
export {
  checkOpenTableAvailability,
  bookOpenTableSlot,
  buildOpenTableBookingUrl,
} from "./opentable";
