export type Platform = "resy" | "opentable";

export type SnipeMode = "drop" | "poll";

export type JobStatus =
  | "created"
  | "armed"
  | "polling"
  | "booking"
  | "success"
  | "failed"
  | "cancelled";

export interface RestaurantResult {
  platform: Platform;
  venueId: string;
  name: string;
  location?: string;
  url?: string;
  slug?: string;
  lat?: number;
  lon?: number;
}

export interface TimeSlot {
  time: string; // HH:mm (24h)
  displayTime: string;
  configId?: string;
  configToken?: string;
  seatingType?: string;
  raw?: unknown;
}

export interface BookResult {
  ok: boolean;
  confirmationId?: string;
  bookedTime?: string;
  message?: string;
  handoffUrl?: string;
}

export interface SnipeJob {
  id: string;
  platform: Platform;
  venue_id: string;
  restaurant_name: string;
  target_date: string;
  party_size: number;
  preferred_times: string; // JSON-encoded string[] in SQLite
  mode: SnipeMode;
  drop_at: string | null;
  poll_interval_ms: number;
  dry_run: number;
  status: JobStatus;
  result_json: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export interface JobLog {
  id: number;
  job_id: string;
  message: string;
  level: "info" | "warn" | "error" | "success";
  created_at: string;
}

export interface ResyCredentials {
  apiKey: string;
  authToken: string;
  email?: string;
}

export interface OpenTableCredentials {
  cookies: string;
  csrfToken?: string;
  email?: string;
}

export interface CreateSnipeInput {
  platform: Platform;
  venueId: string;
  restaurantName: string;
  targetDate: string;
  partySize: number;
  preferredTimes: string[];
  mode: SnipeMode;
  dropAt?: string;
  pollIntervalMs?: number;
  dryRun?: boolean;
}

export interface ParsedJobResult {
  confirmationId?: string;
  bookedTime?: string;
  handoffUrl?: string;
  message?: string;
}
