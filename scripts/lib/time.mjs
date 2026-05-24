export const DEFAULT_RESY_API_KEY = "VbWk7s3L4KiK5fzlO7JD3Q5EYolJI7n5";

export function parseTimeToMinutes(time) {
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

export function formatMinutesToTime(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function formatMinutesToDisplay(minutes) {
  const h24 = Math.floor(minutes / 60);
  const m = minutes % 60;
  const meridiem = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${meridiem}`;
}

export function normalizePreferredTimes(times) {
  return times.map(parseTimeToMinutes).filter((t) => t >= 0).sort((a, b) => a - b);
}

export function pickBestSlot(availableMinutes, preferredMinutes) {
  if (availableMinutes.length === 0) return null;
  if (preferredMinutes.length === 0) return availableMinutes[0];

  for (const preferred of preferredMinutes) {
    if (availableMinutes.includes(preferred)) return preferred;
  }

  for (const preferred of preferredMinutes) {
    const match = availableMinutes.find((slot) => Math.abs(slot - preferred) <= 15);
    if (match !== undefined) return match;
  }

  return null;
}

export function parseResySlotTime(start) {
  const timePart = start.split(" ")[1] ?? start;
  const [h, m] = timePart.split(":").map(Number);
  return h * 60 + m;
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function suggestDropTime(targetDate, daysBefore = 30) {
  const [year, month, day] = targetDate.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCDate(d.getUTCDate() - daysBefore);
  const dropDate = d.toISOString().slice(0, 10);
  return `${dropDate}T09:00:00`;
}

export function toOpenTableDateTime(date, minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${date}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
}
