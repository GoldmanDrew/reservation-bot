import Database from "better-sqlite3";
import path from "path";
import { getDataDir } from "./data-dir";
import type { CreateSnipeInput, JobLog, JobStatus, SnipeJob } from "./types";

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;

  const dataDir = getDataDir();
  const dbPath = path.join(dataDir, "snipes.db");
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS snipe_jobs (
      id TEXT PRIMARY KEY,
      platform TEXT NOT NULL,
      venue_id TEXT NOT NULL,
      restaurant_name TEXT NOT NULL,
      target_date TEXT NOT NULL,
      party_size INTEGER NOT NULL,
      preferred_times TEXT NOT NULL,
      mode TEXT NOT NULL,
      drop_at TEXT,
      poll_interval_ms INTEGER NOT NULL DEFAULT 30000,
      dry_run INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'created',
      result_json TEXT,
      error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS job_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id TEXT NOT NULL,
      message TEXT NOT NULL,
      level TEXT NOT NULL DEFAULT 'info',
      created_at TEXT NOT NULL,
      FOREIGN KEY (job_id) REFERENCES snipe_jobs(id)
    );

    CREATE INDEX IF NOT EXISTS idx_jobs_status ON snipe_jobs(status);
    CREATE INDEX IF NOT EXISTS idx_logs_job ON job_logs(job_id);
  `);

  return db;
}

export function createJob(input: CreateSnipeInput, id: string): SnipeJob {
  const now = new Date().toISOString();
  const database = getDb();

  database
    .prepare(
      `INSERT INTO snipe_jobs (
        id, platform, venue_id, restaurant_name, target_date, party_size,
        preferred_times, mode, drop_at, poll_interval_ms, dry_run, status,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'created', ?, ?)`
    )
    .run(
      id,
      input.platform,
      input.venueId,
      input.restaurantName,
      input.targetDate,
      input.partySize,
      JSON.stringify(input.preferredTimes),
      input.mode,
      input.dropAt ?? null,
      input.pollIntervalMs ?? (input.mode === "drop" ? 200 : 30000),
      input.dryRun ? 1 : 0,
      now,
      now
    );

  return getJob(id)!;
}

export function getJob(id: string): SnipeJob | null {
  const row = getDb()
    .prepare("SELECT * FROM snipe_jobs WHERE id = ?")
    .get(id) as SnipeJob | undefined;
  return row ?? null;
}

export function listJobs(): SnipeJob[] {
  return getDb()
    .prepare("SELECT * FROM snipe_jobs ORDER BY created_at DESC")
    .all() as SnipeJob[];
}

export function listActiveJobs(): SnipeJob[] {
  return getDb()
    .prepare(
      `SELECT * FROM snipe_jobs
       WHERE status IN ('created', 'armed', 'polling', 'booking')
       ORDER BY created_at ASC`
    )
    .all() as SnipeJob[];
}

export function updateJobStatus(
  id: string,
  status: JobStatus,
  extras?: { error?: string; resultJson?: string }
) {
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `UPDATE snipe_jobs SET status = ?, error = ?, result_json = ?, updated_at = ? WHERE id = ?`
    )
    .run(
      status,
      extras?.error ?? null,
      extras?.resultJson ?? null,
      now,
      id
    );
}

export function addJobLog(
  jobId: string,
  message: string,
  level: JobLog["level"] = "info"
) {
  getDb()
    .prepare(
      "INSERT INTO job_logs (job_id, message, level, created_at) VALUES (?, ?, ?, ?)"
    )
    .run(jobId, message, level, new Date().toISOString());
}

export function getJobLogs(jobId: string, sinceId = 0): JobLog[] {
  return getDb()
    .prepare(
      "SELECT * FROM job_logs WHERE job_id = ? AND id > ? ORDER BY id ASC"
    )
    .all(jobId, sinceId) as JobLog[];
}

export function deleteJob(id: string) {
  getDb().prepare("DELETE FROM job_logs WHERE job_id = ?").run(id);
  getDb().prepare("DELETE FROM snipe_jobs WHERE id = ?").run(id);
}

export function parsePreferredTimes(job: SnipeJob): string[] {
  return JSON.parse(job.preferred_times) as string[];
}
