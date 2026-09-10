'use client';

import { useState, useEffect } from 'react';
import type { ServerStatus } from '@/lib/types';

interface TopBarProps {
  connected: boolean;
  serverStatus: ServerStatus;
}

function useClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

function pad2(n: number) { return n.toString().padStart(2, '0'); }

export default function TopBar({ connected, serverStatus }: TopBarProps) {
  const now = useClock();

  const timeStr = now
    ? `${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}`
    : '--:--:--';
  const ampm = now ? (now.getHours() >= 12 ? 'pm' : 'am') : '';

  const dateStr = now
    ? `${DAY_NAMES[now.getDay()]}, ${now.getDate()} ${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`
    : '';

  const systemStatus = connected ? 'OPTIMAL' : 'OFFLINE';
  const statusColor = connected ? 'var(--jarvis-success)' : 'var(--jarvis-error)';

  return (
    <header
      className="flex items-center justify-between px-4 flex-shrink-0"
      style={{
        height: '56px',
        background: 'rgba(0, 8, 20, 0.9)',
        borderBottom: '1px solid rgba(0, 212, 255, 0.07)',
        backdropFilter: 'blur(20px)',
      }}
    >
      {/* Left: System Status */}
      <div className="flex items-center gap-3">
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded"
          style={{
            background: connected
              ? 'rgba(0, 255, 136, 0.06)'
              : 'rgba(255, 68, 68, 0.06)',
            border: `1px solid ${connected ? 'rgba(0,255,136,0.15)' : 'rgba(255,68,68,0.15)'}`,
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{
              background: statusColor,
              boxShadow: `0 0 6px ${statusColor}`,
              animation: connected ? undefined : 'statusPulse 1s ease-in-out infinite',
            }}
          />
          <span
            className="text-[10px] font-semibold tracking-[0.12em] uppercase"
            style={{ color: statusColor }}
          >
            System Status &bull; {systemStatus}
          </span>
        </div>
      </div>

      {/* Center: Date + Clock */}
      <div className="flex flex-col items-center">
        <div className="text-[10px] text-jarvis-text-dim/60 tracking-wider mb-0.5">
          {dateStr}
        </div>
        <div className="flex items-baseline gap-1">
          <span
            className="font-mono font-semibold tracking-widest jarvis-glow"
            style={{ fontSize: '22px', color: 'var(--jarvis-cyan)', letterSpacing: '0.08em' }}
          >
            {timeStr}
          </span>
          <span className="text-jarvis-text-dim/60 text-xs font-mono">{ampm}</span>
        </div>
      </div>

      {/* Right: Search + Icons + User */}
      <div className="flex items-center gap-3">
        {/* Search bar */}
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded"
          style={{
            background: 'rgba(0, 12, 28, 0.6)',
            border: '1px solid rgba(0, 212, 255, 0.08)',
            width: '160px',
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(120,169,198,0.5)" strokeWidth="2" aria-hidden="true">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <span className="text-[11px] text-jarvis-text-dim/40 flex-1">Search...</span>
          <span
            className="text-[9px] px-1 rounded"
            style={{ background: 'rgba(0,212,255,0.06)', color: 'rgba(0,212,255,0.35)', border: '1px solid rgba(0,212,255,0.1)' }}
          >
            ⌘K
          </span>
        </div>

        {/* Grid view */}
        <button
          className="jarvis-btn jarvis-btn-ghost w-8 h-8 p-0"
          aria-label="Grid view"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
            <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
          </svg>
        </button>

        {/* Notifications */}
        <button
          className="jarvis-btn jarvis-btn-ghost w-8 h-8 p-0 relative"
          aria-label="Notifications"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          <span
            className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full"
            style={{ background: 'var(--jarvis-error)', boxShadow: '0 0 4px rgba(255,68,68,0.6)' }}
          />
        </button>

        {/* Settings */}
        <button
          className="jarvis-btn jarvis-btn-ghost w-8 h-8 p-0"
          aria-label="Settings"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>

        {/* User */}
        <div className="flex items-center gap-2">
          <div className="flex flex-col items-end">
            <span className="text-[11px] text-jarvis-text/90 font-medium">Operator</span>
            <span className="text-[9px] text-jarvis-text-dim/50 tracking-wider uppercase">Commander</span>
          </div>
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
            style={{
              background: 'linear-gradient(135deg, rgba(0,100,200,0.5), rgba(0,50,120,0.4))',
              border: '1px solid rgba(0,212,255,0.2)',
              color: 'var(--jarvis-cyan)',
            }}
          >
            O
          </div>
        </div>
      </div>
    </header>
  );
}
