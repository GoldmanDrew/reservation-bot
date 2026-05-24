"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SearchInput } from "@/components/SearchInput";
import type { RestaurantResult, SnipeMode } from "@/lib/types";
import { suggestDropTime } from "@/lib/utils/time";

export function SnipeForm() {
  const router = useRouter();
  const [restaurant, setRestaurant] = useState<RestaurantResult | null>(null);
  const [targetDate, setTargetDate] = useState("");
  const [partySize, setPartySize] = useState(2);
  const [times, setTimes] = useState(["19:00", "19:30", "20:00"]);
  const [newTime, setNewTime] = useState("");
  const [mode, setMode] = useState<SnipeMode>("drop");
  const [dropAt, setDropAt] = useState("");
  const [pollInterval, setPollInterval] = useState(30);
  const [dryRun, setDryRun] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function handleDateChange(date: string) {
    setTargetDate(date);
    if (date && mode === "drop") {
      setDropAt(suggestDropTime(date));
    }
  }

  function addTime() {
    if (!newTime.trim()) return;
    if (!times.includes(newTime.trim())) {
      setTimes([...times, newTime.trim()]);
    }
    setNewTime("");
  }

  function removeTime(t: string) {
    setTimes(times.filter((x) => x !== t));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!restaurant) {
      setError("Select a restaurant");
      return;
    }
    if (!targetDate || times.length === 0) {
      setError("Date and at least one preferred time required");
      return;
    }
    if (mode === "drop" && !dropAt) {
      setError("Drop time required for drop snipe mode");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/snipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: restaurant.platform,
          venueId: restaurant.venueId,
          restaurantName: restaurant.name,
          targetDate,
          partySize,
          preferredTimes: times,
          mode,
          dropAt: mode === "drop" ? dropAt : undefined,
          pollIntervalMs: mode === "poll" ? pollInterval * 1000 : 200,
          dryRun,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create snipe");

      router.push("/jobs");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="card space-y-5">
        <h2 className="text-lg font-semibold text-white">New Snipe</h2>

        <SearchInput
          selected={restaurant}
          onSelect={setRestaurant}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-300">
              Date
            </label>
            <input
              type="date"
              className="input"
              value={targetDate}
              onChange={(e) => handleDateChange(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-300">
              Party size
            </label>
            <select
              className="input"
              value={partySize}
              onChange={(e) => setPartySize(parseInt(e.target.value, 10))}
            >
              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                <option key={n} value={n}>
                  {n} {n === 1 ? "guest" : "guests"}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-300">
            Preferred times (priority order)
          </label>
          <div className="mb-2 flex flex-wrap gap-2">
            {times.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1 rounded-full bg-surface-border px-3 py-1 text-sm"
              >
                {t}
                <button
                  type="button"
                  onClick={() => removeTime(t)}
                  className="text-gray-500 hover:text-red-400"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              className="input"
              placeholder="19:00 or 7:00 PM"
              value={newTime}
              onChange={(e) => setNewTime(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTime())}
            />
            <button type="button" className="btn-secondary shrink-0" onClick={addTime}>
              Add
            </button>
          </div>
        </div>
      </div>

      <div className="card space-y-4">
        <h3 className="font-medium text-white">Snipe mode</h3>

        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            className={`rounded-lg border p-4 text-left transition-colors ${
              mode === "drop"
                ? "border-accent bg-accent/10"
                : "border-surface-border hover:border-gray-600"
            }`}
            onClick={() => setMode("drop")}
          >
            <div className="font-medium text-white">Drop snipe</div>
            <div className="mt-1 text-xs text-gray-500">
              Fire at exact release time (e.g. 30 days out at 9am)
            </div>
          </button>
          <button
            type="button"
            className={`rounded-lg border p-4 text-left transition-colors ${
              mode === "poll"
                ? "border-accent bg-accent/10"
                : "border-surface-border hover:border-gray-600"
            }`}
            onClick={() => setMode("poll")}
          >
            <div className="font-medium text-white">Keep watching</div>
            <div className="mt-1 text-xs text-gray-500">
              Poll for cancellations until a slot opens
            </div>
          </button>
        </div>

        {mode === "drop" ? (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-300">
              Drop time (when slots release)
            </label>
            <input
              type="datetime-local"
              className="input"
              value={dropAt}
              onChange={(e) => setDropAt(e.target.value)}
            />
            <p className="mt-1 text-xs text-gray-500">
              Auto-suggested as 30 days before your date at 9:00 AM. Bot wakes 30s early and polls every 200ms.
            </p>
          </div>
        ) : (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-300">
              Poll interval
            </label>
            <select
              className="input"
              value={pollInterval}
              onChange={(e) => setPollInterval(parseInt(e.target.value, 10))}
            >
              <option value={5}>Every 5 seconds</option>
              <option value={15}>Every 15 seconds</option>
              <option value={30}>Every 30 seconds</option>
              <option value={60}>Every 60 seconds</option>
            </select>
          </div>
        )}

        <label className="flex items-center gap-2 text-sm text-gray-400">
          <input
            type="checkbox"
            checked={dryRun}
            onChange={(e) => setDryRun(e.target.checked)}
            className="rounded"
          />
          Dry run (don&apos;t actually book — test timing only)
        </label>
      </div>

      {error && (
        <div className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <button type="submit" className="btn-primary w-full" disabled={submitting}>
        {submitting ? "Starting snipe..." : "Start Snipe"}
      </button>
    </form>
  );
}
