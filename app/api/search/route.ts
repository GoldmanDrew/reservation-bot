import { NextRequest, NextResponse } from "next/server";
import { parseRestaurantUrl } from "@/lib/utils/time";
import { resolveFromUrl, searchAllRestaurants } from "@/lib/platforms";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q");
  if (!q?.trim()) {
    return NextResponse.json({ error: "Query required" }, { status: 400 });
  }

  const query = q.trim();

  if (query.startsWith("http")) {
    const parsed = parseRestaurantUrl(query);
    if (parsed) {
      const resolved = await resolveFromUrl(
        parsed.platform,
        parsed.slug,
        parsed.city,
        parsed.venueId
      );
      if (resolved) {
        return NextResponse.json({ results: [resolved] });
      }
    }
    return NextResponse.json({ results: [] });
  }

  const lat = parseFloat(request.nextUrl.searchParams.get("lat") ?? "40.7128");
  const lon = parseFloat(request.nextUrl.searchParams.get("lon") ?? "-74.006");

  const results = await searchAllRestaurants(query, lat, lon);
  return NextResponse.json({ results });
}
