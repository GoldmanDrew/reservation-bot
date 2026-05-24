import { listActiveJobs } from "@/lib/db";
import { runSnipeJob } from "./engine";

let started = false;

export function startScheduler() {
  if (started) return;
  started = true;

  console.log("[scheduler] Reservation sniper started");

  // Resume any active jobs on startup
  const active = listActiveJobs();
  for (const job of active) {
    console.log(`[scheduler] Resuming job ${job.id} (${job.restaurant_name})`);
    runSnipeJob(job.id).catch((err) => {
      console.error(`[scheduler] Job ${job.id} failed:`, err);
    });
  }

  // Check for new jobs every 5 seconds
  setInterval(() => {
    const jobs = listActiveJobs();
    for (const job of jobs) {
      if (job.status === "created") {
        runSnipeJob(job.id).catch((err) => {
          console.error(`[scheduler] Job ${job.id} failed:`, err);
        });
      }
    }
  }, 5000);
}

export function launchJob(jobId: string) {
  runSnipeJob(jobId).catch((err) => {
    console.error(`[scheduler] Job ${jobId} failed:`, err);
  });
}
