"use client";
import { useState, useEffect, useCallback } from "react";

interface SelfUpdateStatus {
  next_run: string | null;
  github_repos_seen: number;
  mcp_plugins_found: number;
  last_changes?: string[];
}

const BRAIN_URL = process.env.NEXT_PUBLIC_BRAIN_URL || "http://localhost:8001";

export default function SelfUpdateWidget() {
  const [status, setStatus] = useState<SelfUpdateStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${BRAIN_URL}/api/self-update/status`);
      if (!res.ok) throw new Error("offline");
      setStatus(await res.json());
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const id = setInterval(fetchStatus, 30000);
    return () => clearInterval(id);
  }, [fetchStatus]);

  const triggerNow = async () => {
    setRunning(true);
    try {
      await fetch(`${BRAIN_URL}/api/self-update/trigger`, { method: "POST" });
      setTimeout(fetchStatus, 3000);
    } catch {
      setError(true);
    } finally {
      setTimeout(() => setRunning(false), 5000);
    }
  };

  const formatTime = (iso: string | null) => {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return iso;
    }
  };

  return (
    <div className="bg-black/40 border border-cyan-900/40 rounded-lg p-4 text-sm font-mono">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-cyan-400 font-semibold">
          <span>🧠</span>
          <span>Self-Improvement Agent</span>
        </div>
        {!error && (
          <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
        )}
      </div>

      {loading && (
        <div className="space-y-2 animate-pulse">
          <div className="h-3 bg-cyan-900/30 rounded w-3/4" />
          <div className="h-3 bg-cyan-900/30 rounded w-1/2" />
        </div>
      )}

      {error && !loading && (
        <p className="text-amber-400 text-xs">Agent offline</p>
      )}

      {!loading && !error && status && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2 text-xs text-gray-400">
            <span>Next run</span>
            <span className="text-cyan-300">{formatTime(status.next_run)}</span>
            <span>Repos scouted</span>
            <span className="text-cyan-300">{status.github_repos_seen}</span>
            <span>MCP plugins</span>
            <span className="text-cyan-300">{status.mcp_plugins_found}</span>
          </div>

          {status.last_changes && status.last_changes.length > 0 && (
            <div className="mt-2 pt-2 border-t border-cyan-900/30">
              <p className="text-gray-500 text-xs mb-1">Recent changes</p>
              <ul className="space-y-1">
                {status.last_changes.slice(0, 5).map((c, i) => (
                  <li key={i} className="text-gray-300 text-xs truncate">• {c}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <button
        onClick={triggerNow}
        disabled={running}
        className="mt-3 w-full py-1.5 rounded border border-cyan-700/50 text-cyan-400 text-xs hover:bg-cyan-900/20 disabled:opacity-50 transition-colors"
      >
        {running ? "Running..." : "Run Now"}
      </button>
    </div>
  );
}
