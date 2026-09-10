'use client';

import { useEffect, useRef } from 'react';
import { X, Cpu, MemoryStick, Wifi, WifiOff } from 'lucide-react';
import { ServerStatus } from '@/lib/types';

interface StatsWidgetProps {
  serverStatus: ServerStatus;
  connected: boolean;
  onClose: () => void;
}

export default function StatsWidget({ serverStatus, connected, onClose }: StatsWidgetProps) {
  const autoHideRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    autoHideRef.current = setTimeout(onClose, 10000);
    return () => {
      if (autoHideRef.current) clearTimeout(autoHideRef.current);
    };
  }, [onClose]);

  function resetTimer() {
    if (autoHideRef.current) clearTimeout(autoHideRef.current);
    autoHideRef.current = setTimeout(onClose, 10000);
  }

  return (
    <div
      role="dialog"
      aria-label="System statistics"
      aria-modal="false"
      onMouseMove={resetTimer}
      style={{
        width: 220,
        background: 'rgba(6,10,18,0.92)',
        border: '1px solid rgba(0,200,255,0.15)',
        borderRadius: 10,
        backdropFilter: 'blur(24px)',
        boxShadow: '0 8px 40px rgba(0,0,0,0.6), 0 0 20px rgba(0,200,255,0.06)',
        zIndex: 60,
        animation: 'fadeInUp 0.2s ease',
      }}
    >
      {/* Header — drag handle */}
      <div
        data-drag-handle="true"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          borderBottom: '1px solid rgba(0,200,255,0.08)',
          cursor: 'grab',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: 'rgba(0,200,255,0.55)',
          }}
        >
          SYSTEM
        </span>
        <button
          onClick={onClose}
          aria-label="Close stats"
          style={{
            background: 'none',
            border: 'none',
            color: 'rgba(255,255,255,0.35)',
            cursor: 'pointer',
            padding: 4,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <X size={14} />
        </button>
      </div>

      {/* Stats rows */}
      <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <StatRow
          icon={connected ? <Wifi size={13} /> : <WifiOff size={13} />}
          label="Gateway"
          value={connected ? 'connected' : 'offline'}
          valueColor={connected ? 'var(--jarvis-success)' : 'var(--jarvis-error)'}
        />
        {serverStatus.uptime_seconds !== undefined && (
          <StatRow
            icon={<Cpu size={13} />}
            label="Uptime"
            value={formatUptime(serverStatus.uptime_seconds)}
          />
        )}
        {serverStatus.active_tasks !== undefined && (
          <StatRow
            icon={<MemoryStick size={13} />}
            label="Active tasks"
            value={String(serverStatus.active_tasks)}
          />
        )}
        {serverStatus.memory_entries !== undefined && (
          <StatRow
            icon={<MemoryStick size={13} />}
            label="Memories"
            value={String(serverStatus.memory_entries)}
          />
        )}
        {serverStatus.uptime_seconds === undefined && (
          <p
            style={{
              fontSize: 11,
              color: 'rgba(255,255,255,0.2)',
              fontFamily: 'var(--font-mono)',
              textAlign: 'center',
            }}
          >
            No data from server
          </p>
        )}
      </div>
    </div>
  );
}

function StatRow({
  icon,
  label,
  value,
  valueColor,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: 12,
      }}
    >
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          color: 'rgba(255,255,255,0.4)',
        }}
      >
        {icon}
        {label}
      </span>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: valueColor ?? 'rgba(0,200,255,0.8)',
        }}
      >
        {value}
      </span>
    </div>
  );
}

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
