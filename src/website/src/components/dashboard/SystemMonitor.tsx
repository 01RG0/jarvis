'use client';

import { useEffect, useState } from 'react';
import type { ServerStatus } from '@/lib/types';

interface SystemMonitorProps {
  serverStatus: ServerStatus;
}

interface GaugeProps {
  label: string;
  value: number;
  color: string;
  trackColor?: string;
}

const RADIUS = 32;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function CircularGauge({ label, value, color, trackColor = 'rgba(0,212,255,0.06)' }: GaugeProps) {
  const [animatedValue, setAnimatedValue] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setAnimatedValue(value), 100);
    return () => clearTimeout(timer);
  }, [value]);

  const offset = CIRCUMFERENCE - (animatedValue / 100) * CIRCUMFERENCE;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-20 h-20 flex items-center justify-center">
        <svg
          width="80"
          height="80"
          viewBox="0 0 80 80"
          className="absolute inset-0 -rotate-90"
          aria-hidden="true"
        >
          {/* Track */}
          <circle
            cx="40"
            cy="40"
            r={RADIUS}
            fill="none"
            stroke={trackColor}
            strokeWidth="5"
          />
          {/* Fill */}
          <circle
            cx="40"
            cy="40"
            r={RADIUS}
            fill="none"
            stroke={color}
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
            style={{
              transition: 'stroke-dashoffset 1.2s cubic-bezier(0.16, 1, 0.3, 1)',
              filter: `drop-shadow(0 0 4px ${color})`,
            }}
          />
        </svg>

        {/* Center value */}
        <div className="flex flex-col items-center z-10">
          <span
            className="font-bold font-mono jarvis-glow-sm"
            style={{ fontSize: '16px', color, lineHeight: '1' }}
          >
            {value}%
          </span>
        </div>
      </div>

      <span
        className="text-[10px] font-semibold tracking-[0.12em] uppercase"
        style={{ color: 'rgba(120,169,198,0.6)' }}
      >
        {label}
      </span>
    </div>
  );
}

export default function SystemMonitor({ serverStatus }: SystemMonitorProps) {
  const cpu = 15;
  const ram = 54;
  const disk = 40;

  return (
    <div className="dashboard-panel flex flex-col" role="region" aria-label="System Monitor">
      <div className="panel-header">
        <span>System Monitor</span>
      </div>

      <div className="flex-1 flex items-center justify-around p-4">
        <CircularGauge
          label="CPU"
          value={cpu}
          color="rgba(0,212,255,0.85)"
        />
        <CircularGauge
          label="RAM"
          value={ram}
          color="rgba(0,255,180,0.85)"
        />
        <CircularGauge
          label="Disk"
          value={disk}
          color="rgba(100,180,255,0.85)"
        />
      </div>

      {serverStatus.uptime_seconds !== undefined && (
        <div className="px-3 pb-2 flex justify-center">
          <span className="text-[9px] text-jarvis-text-dim/40 tracking-wider">
            Uptime: {Math.floor(serverStatus.uptime_seconds / 3600)}h{' '}
            {Math.floor((serverStatus.uptime_seconds % 3600) / 60)}m
          </span>
        </div>
      )}
    </div>
  );
}
