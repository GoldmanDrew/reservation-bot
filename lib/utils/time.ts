import { formatInTimeZone } from "date-fns-tz";

export const DEFAULT_TIMEZONE = "America/New_York";

export function parseTimeToMinutes(time: string): number {
  const normalized = time.trim().toUpperCase();
  const match12 = normalized.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match12) return -1;

  let hours = parseInt(match12[1], 10);
  const minutes = parseInt(match12[2], 10);
  const meridiem = match12[3];

  if (meridiem) {
    if (meridiem === "PM" && hours !== 12) hours += 12;
    if (meridiem === "AM" && hours === 12) hours = 0;
  }

  return hours * 60 + minutes;
}

export function formatMinutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function formatMinutesToDisplay(minutes: number): string {
  const h24 = Math.floor(minutes / 60);
  const m = minutes % 60;
  const meridiem = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${meridiem}`;
}

export function normalizePreferredTimes(times: string[]): number[] {
  return times
    .map(parseTimeToMinutes)
    .filter((t) => t >= 0)
    .sort((a, b) => a - b);
}

export function pickBestSlot(
  availableMinutes: number[],
  preferredMinutes: number[]
): number | null {
  if (availableMinutes.length === 0) return null;
  if (preferredMinutes.length === 0) return availableMinutes[0];

  for (const preferred of preferredMinutes) {
    if (availableMinutes.includes(preferred)) return preferred;
  }

  for (const preferred of preferredMinutes) {
    const match = availableMinutes.find(
      (slot) => Math.abs(slot - preferred) <= 15
    );
    if (match !== undefined) return match;
  }

  return null;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function sleepUntil(isoTimestamp: string): Promise<void> {
  const target = new Date(isoTimestamp).getTime();
  const now = Date.now();
  const delay = Math.max(0, target - now);
  return sleep(delay);
}

export function suggestDropTime(
  targetDate: string,
  daysBefore = 30,
  hour = 9,
  minute = 0,
  timezone = DEFAULT_TIMEZONE
): string {
  const [year, month, day] = targetDate.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1, day));
  target.setUTCDate(target.getUTCDate() - daysBefore);

  const dropDate = formatInTimeZone(target, timezone, "yyyy-MM-dd");
  const h = String(hour).padStart(2, "0");
  const m = String(minute).padStart(2, "0");
  return `${dropDate}T${h}:${m}:00`;
}

export function parseResySlotTime(start: string): number {
  const timePart = start.split(" ")[1] ?? start;
  const [h, m] = timePart.split(":").map(Number);
  return h * 60 + m;
}

export function toOpenTableDateTime(date: string, minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${date}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
}

export function parseRestaurantUrl(url: string): {
  platform: "resy" | "opentable";
  venueId?: string;
  slug?: string;
  city?: string;
} | null {
  try {
    const parsed = new URL(url);

    if (parsed.hostname.includes("resy.com")) {
      const match = parsed.pathname.match(/\/cities\/([^/]+)\/venues\/([^/?]+)/);
      if (match) {
        return { platform: "resy", slug: match[2], city: match[1] };
      }
    }

    if (parsed.hostname.includes("opentable.com")) {
      const rid = parsed.searchParams.get("rid");
      if (rid) return { platform: "opentable", venueId: rid };

      const slugMatch = parsed.pathname.match(/\/r\/([^/?]+)/);
      if (slugMatch) {
        return { platform: "opentable", slug: slugMatch[1] };
      }
    }
  } catch {
    return null;
  }
  return null;
}

export function formatLogTimestamp(): string {
  return new Date().toLocaleTimeString("en-US", { hour12: false });
}
