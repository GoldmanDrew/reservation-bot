"use client";

import { useCallback, useEffect, useState } from "react";
import type { JobLog, SnipeJob } from "@/lib/types";

const STATUS_COLORS: Record<string, string> = {
  created: "text-gray-400",
  armed: "text-warning",
  polling: "text-accent",
  booking: "text-warning",
  success: "text-success",
  failed: "text-danger",
  cancelled: "text-gray-500",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`text-sm font-medium uppercase ${STATUS_COLORS[status] ?? "text-gray-400"}`}>
      {status}
    </span>
  );
}

function JobCard({ job, onRefresh }: { job: SnipeJob; onRefresh: () => void }) {
  const [logs, setLogs] = useState<JobLog[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [lastLogId, setLastLogId] = useState(0);

  const fetchLogs = useCallback(async () => {
    const res = await fetch(`/api/snipes/${job.id}`);
    if (res.ok) {
      const data = await res.json();
      setLogs(data.logs ?? []);
      const maxId = Math.max(0, ...(data.logs ?? []).map((l: JobLog) => l.id));
      setLastLogId(maxId);
    }
  }, [job.id]);

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(async () => {
      const res = await fetch(`/api/logs?jobId=${job.id}&since=${lastLogId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.logs?.length) {
          setLogs((prev) => [...prev, ...data.logs]);
          const maxId = Math.max(...data.logs.map((l: JobLog) => l.id));
          setLastLogId(maxId);
        }
      }
      onRefresh();
    }, 2000);
    return () => clearInterval(interval);
  }, [job.id, lastLogId, fetchLogs, onRefresh]);

  async function handleCancel() {
    await fetch(`/api/snipes/${job.id}/cancel`, { method: "POST" });
    onRefresh();
  }

  async function handleDelete() {
    await fetch(`/api/snipes/${job.id}`, { method: "DELETE" });
    onRefresh();
  }

  const preferredTimes = JSON.parse(job.preferred_times) as string[];
  const result = job.result_json ? JSON.parse(job.result_json) : null;
  const isActive = ["created", "armed", "polling", "booking"].includes(job.status);

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-white">{job.restaurant_name}</h3>
            <span className={job.platform === "resy" ? "badge-resy" : "badge-opentable"}>
              {job.platform}
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            {job.target_date} · {job.party_size} guests · {preferredTimes.join(", ")}
          </p>
          <p className="mt-1 text-sm text-gray-500">
            {job.mode === "drop"
              ? `Drop snipe at ${job.drop_at ?? "—"}`
              : `Polling every ${job.poll_interval_ms / 1000}s`}
            {job.dry_run ? " · DRY RUN" : ""}
          </p>
        </div>
        <StatusBadge status={job.status} />
      </div>

      {result && (
        <div className="mt-3 rounded-lg bg-success/10 px-3 py-2 text-sm text-green-300">
          {result.message}
          {result.handoffUrl && (
            <a
              href={result.handoffUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-2 underline"
            >
              Complete booking →
            </a>
          )}
        </div>
      )}

      {job.error && (
        <div className="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-sm text-red-300">
          {job.error}
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          className="btn-secondary text-xs"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Hide log" : "View log"} ({logs.length})
        </button>
        {isActive && (
          <button type="button" className="btn-danger text-xs" onClick={handleCancel}>
            Cancel
          </button>
        )}
        {!isActive && (
          <button type="button" className="btn-secondary text-xs" onClick={handleDelete}>
            Remove
          </button>
        )}
      </div>

      {expanded && (
        <div className="mt-3 max-h-48 overflow-auto rounded-lg bg-surface p-3 font-mono text-xs">
          {logs.length === 0 ? (
            <span className="text-gray-500">No logs yet...</span>
          ) : (
            logs.map((log) => (
              <div
                key={log.id}
                className={
                  log.level === "error"
                    ? "text-red-400"
                    : log.level === "success"
                      ? "text-green-400"
                      : log.level === "warn"
                        ? "text-yellow-400"
                        : "text-gray-400"
                }
              >
                {log.message}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export function JobList() {
  const [jobs, setJobs] = useState<SnipeJob[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/snipes");
    if (res.ok) {
      const data = await res.json();
      setJobs(data.jobs ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (loading) {
    return <div className="text-gray-500">Loading jobs...</div>;
  }

  if (jobs.length === 0) {
    return (
      <div className="card text-center">
        <p className="text-gray-400">No snipes yet.</p>
        <a href="/" className="mt-2 inline-block text-sm text-accent hover:underline">
          Create your first snipe →
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {jobs.map((job) => (
        <JobCard key={job.id} job={job} onRefresh={refresh} />
      ))}
    </div>
  );
}
