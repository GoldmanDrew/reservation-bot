import {
  addJobLog,
  getJob,
  parsePreferredTimes,
  updateJobStatus,
} from "@/lib/db";
import {
  bookOpenTableSlot,
  bookResySlot,
  checkOpenTableAvailability,
  checkResyAvailability,
} from "@/lib/platforms";
import type { ParsedJobResult, SnipeJob, TimeSlot } from "@/lib/types";
import {
  formatLogTimestamp,
  normalizePreferredTimes,
  parseTimeToMinutes,
  pickBestSlot,
  sleep,
  sleepUntil,
} from "@/lib/utils/time";

const cancelledJobs = new Set<string>();
const runningJobs = new Set<string>();

export function cancelRunningJob(jobId: string) {
  cancelledJobs.add(jobId);
}

export function isJobCancelled(jobId: string): boolean {
  return cancelledJobs.has(jobId);
}

function log(jobId: string, message: string, level: "info" | "warn" | "error" | "success" = "info") {
  const ts = formatLogTimestamp();
  addJobLog(jobId, `[${ts}] ${message}`, level);
}

async function fetchSlots(job: SnipeJob): Promise<TimeSlot[]> {
  const preferred = parsePreferredTimes(job);

  if (job.platform === "resy") {
    return checkResyAvailability(
      job.venue_id,
      job.target_date,
      job.party_size
    );
  }

  return checkOpenTableAvailability(
    job.venue_id,
    job.target_date,
    job.party_size
  );
}

function findMatchingSlot(
  slots: TimeSlot[],
  preferredTimes: string[]
): TimeSlot | null {
  const availableMinutes = slots.map((s) => parseTimeToMinutes(s.time));
  const preferredMinutes = normalizePreferredTimes(preferredTimes);
  const best = pickBestSlot(availableMinutes, preferredMinutes);

  if (best === null) return null;
  return slots.find((s) => parseTimeToMinutes(s.time) === best) ?? null;
}

async function attemptBook(
  job: SnipeJob,
  slot: TimeSlot
): Promise<ParsedJobResult> {
  const dryRun = job.dry_run === 1;

  if (job.platform === "resy") {
    const result = await bookResySlot(slot, job.target_date, job.party_size, dryRun);
    return {
      confirmationId: result.confirmationId,
      bookedTime: result.bookedTime,
      message: result.message,
    };
  }

  const result = await bookOpenTableSlot(
    job.venue_id,
    job.target_date,
    slot,
    job.party_size,
    dryRun
  );
  return {
    confirmationId: result.confirmationId,
    bookedTime: result.bookedTime,
    handoffUrl: result.handoffUrl,
    message: result.message,
  };
}

export async function runSnipeJob(jobId: string): Promise<void> {
  if (runningJobs.has(jobId)) return;
  runningJobs.add(jobId);

  try {
    const job = getJob(jobId);
    if (!job) return;

    log(jobId, `Starting snipe for ${job.restaurant_name} (${job.platform})`);
    updateJobStatus(jobId, "armed");

    if (job.mode === "drop" && job.drop_at) {
      const dropTime = new Date(job.drop_at).getTime();
      const wakeTime = dropTime - 30_000;
      const now = Date.now();

      if (wakeTime > now) {
        log(jobId, `Armed — waiting until ${job.drop_at} (waking 30s early)`);
        await sleepUntil(new Date(wakeTime).toISOString());
      }
    }

    if (isJobCancelled(jobId)) {
      updateJobStatus(jobId, "cancelled");
      log(jobId, "Cancelled before polling started", "warn");
      return;
    }

    updateJobStatus(jobId, "polling");
    log(jobId, "Polling for availability...");

    const preferredTimes = parsePreferredTimes(job);
    const pollInterval = job.mode === "drop" ? 200 : job.poll_interval_ms;
    const dropWindowMs = job.mode === "drop" ? 120_000 : Infinity;
    const pollStart = Date.now();

    while (!isJobCancelled(jobId)) {
      try {
        const slots = await fetchSlots(job);

        if (slots.length > 0) {
          const times = slots.map((s) => s.displayTime).join(", ");
          log(jobId, `Found ${slots.length} slot(s): ${times}`);
        }

        const match = findMatchingSlot(slots, preferredTimes);

        if (match) {
          log(jobId, `Match found: ${match.displayTime} — booking...`, "success");
          updateJobStatus(jobId, "booking");

          const result = await attemptBook(job, match);

          if (result.confirmationId || result.handoffUrl || job.dry_run) {
            updateJobStatus(jobId, "success", {
              resultJson: JSON.stringify(result),
            });
            log(
              jobId,
              result.message ?? `Booked ${result.bookedTime}!`,
              "success"
            );
            if (result.handoffUrl) {
              log(jobId, `Open booking URL: ${result.handoffUrl}`, "info");
            }
            return;
          }

          updateJobStatus(jobId, "failed", {
            error: result.message ?? "Booking failed",
          });
          log(jobId, result.message ?? "Booking failed", "error");
          return;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log(jobId, `Poll error: ${msg}`, "warn");
      }

      if (job.mode === "drop" && Date.now() - pollStart > dropWindowMs) {
        updateJobStatus(jobId, "failed", {
          error: "Drop window passed with no matching slots",
        });
        log(jobId, "Drop window ended — no matching slots found", "error");
        return;
      }

      if (job.mode === "poll") {
        const maxPollMs = 24 * 60 * 60 * 1000;
        if (Date.now() - pollStart > maxPollMs) {
          updateJobStatus(jobId, "failed", {
            error: "Poll timeout after 24 hours",
          });
          log(jobId, "Stopped after 24 hours with no match", "error");
          return;
        }
      }

      await sleep(pollInterval);
    }

    updateJobStatus(jobId, "cancelled");
    log(jobId, "Snipe cancelled", "warn");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    updateJobStatus(jobId, "failed", { error: msg });
    log(jobId, `Fatal error: ${msg}`, "error");
  } finally {
    runningJobs.delete(jobId);
    cancelledJobs.delete(jobId);
  }
}
