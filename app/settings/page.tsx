"use client";

import { useEffect, useState } from "react";

interface AuthState {
  resy: { connected: boolean; valid?: boolean; email?: string; fromEnv?: boolean };
  opentable: { connected: boolean; valid?: boolean; email?: string; fromEnv?: boolean };
}

export default function SettingsPage() {
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [resyEmail, setResyEmail] = useState("");
  const [resyPassword, setResyPassword] = useState("");
  const [otCookies, setOtCookies] = useState("");
  const [otCsrf, setOtCsrf] = useState("");
  const [otEmail, setOtEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadAuth() {
    const [resyRes, otRes] = await Promise.all([
      fetch("/api/auth/resy"),
      fetch("/api/auth/opentable"),
    ]);
    const resyData = await resyRes.json();
    const otData = await otRes.json();
    setAuth({
      resy: resyData.resy ?? resyData,
      opentable: otData.opentable ?? otData,
    });
  }

  useEffect(() => {
    loadAuth();
  }, []);

  async function connectResy(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/auth/resy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resyEmail, password: resyPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMessage("Resy connected successfully");
      setResyPassword("");
      await loadAuth();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Resy login failed");
    } finally {
      setLoading(false);
    }
  }

  async function disconnectResy() {
    await fetch("/api/auth/resy", { method: "DELETE" });
    await loadAuth();
    setMessage("Resy disconnected");
  }

  async function connectOpenTable(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/auth/opentable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cookies: otCookies,
          csrfToken: otCsrf || undefined,
          email: otEmail || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMessage(
        data.valid
          ? "OpenTable session saved and verified"
          : "OpenTable session saved (verification failed — may still work for search)"
      );
      await loadAuth();
    } catch (err) {
      setError(err instanceof Error ? err.message : "OpenTable setup failed");
    } finally {
      setLoading(false);
    }
  }

  async function disconnectOpenTable() {
    await fetch("/api/auth/opentable", { method: "DELETE" });
    await loadAuth();
    setMessage("OpenTable disconnected");
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Settings</h2>
        <p className="mt-1 text-gray-500">
          Connect your accounts. Credentials are stored locally in{" "}
          <code className="text-gray-400">data/credentials.json</code> only.
        </p>
      </div>

      {message && (
        <div className="rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm text-green-300">
          {message}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-white">Resy</h3>
            <p className="text-sm text-gray-500">
              Required for Resy snipes. Full auto-booking supported.
            </p>
          </div>
          {auth?.resy.connected && (
            <span className="text-sm text-success">
              ✓ {auth.resy.email ?? "Connected"}
              {auth.resy.valid === false && " (token may be expired)"}
              {auth.resy.fromEnv && " · from env"}
            </span>
          )}
        </div>

        {auth?.resy.connected ? (
          <button type="button" className="btn-secondary" onClick={disconnectResy}>
            Disconnect Resy
          </button>
        ) : (
          <form onSubmit={connectResy} className="space-y-3">
            <input
              className="input"
              type="email"
              placeholder="Resy email"
              value={resyEmail}
              onChange={(e) => setResyEmail(e.target.value)}
              required
            />
            <input
              className="input"
              type="password"
              placeholder="Resy password"
              value={resyPassword}
              onChange={(e) => setResyPassword(e.target.value)}
              required
            />
            <button type="submit" className="btn-primary" disabled={loading}>
              Connect Resy
            </button>
          </form>
        )}
      </div>

      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-white">OpenTable</h3>
            <p className="text-sm text-gray-500">
              Paste cookies from your browser session. Booking uses a fast handoff URL.
            </p>
          </div>
          {auth?.opentable.connected && (
            <span className="text-sm text-success">
              ✓ {auth.opentable.email ?? "Connected"}
              {auth.opentable.fromEnv && " · from env"}
            </span>
          )}
        </div>

        <details className="text-sm text-gray-500">
          <summary className="cursor-pointer text-gray-400 hover:text-white">
            How to get OpenTable cookies
          </summary>
          <ol className="mt-2 list-inside list-decimal space-y-1 pl-2">
            <li>Log into opentable.com in Chrome</li>
            <li>Open DevTools → Network tab</li>
            <li>Refresh the page</li>
            <li>Click any request to opentable.com</li>
            <li>Copy the full Cookie header value</li>
            <li>Optional: copy x-csrf-token header if present</li>
          </ol>
        </details>

        {auth?.opentable.connected ? (
          <button type="button" className="btn-secondary" onClick={disconnectOpenTable}>
            Disconnect OpenTable
          </button>
        ) : (
          <form onSubmit={connectOpenTable} className="space-y-3">
            <input
              className="input"
              type="email"
              placeholder="Email (optional, for display)"
              value={otEmail}
              onChange={(e) => setOtEmail(e.target.value)}
            />
            <textarea
              className="input min-h-[80px] font-mono text-xs"
              placeholder="Cookie: authCke=...; otuvid=...; ..."
              value={otCookies}
              onChange={(e) => setOtCookies(e.target.value)}
              required
            />
            <input
              className="input font-mono text-xs"
              placeholder="x-csrf-token (optional)"
              value={otCsrf}
              onChange={(e) => setOtCsrf(e.target.value)}
            />
            <button type="submit" className="btn-primary" disabled={loading}>
              Save OpenTable Session
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
