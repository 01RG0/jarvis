'use client';

import { useState, useEffect } from 'react';

interface TimelineItem {
  id: string;
  time: string;
  ampm: 'am' | 'pm';
  title: string;
  statusLabel: string;
  statusColor: string;
  barFill: number; // 0–1
  done?: boolean;
}

const TIMELINE_ITEMS: TimelineItem[] = [
  {
    id: '1',
    time: '09:30', ampm: 'am',
    title: 'Daily Standup',
    statusLabel: 'Done',
    statusColor: 'var(--jarvis-success)',
    barFill: 1,
    done: true,
  },
  {
    id: '2',
    time: '12:00', ampm: 'pm',
    title: 'Finalize HUD panel spacing',
    statusLabel: 'In 42 min',
    statusColor: 'var(--jarvis-warning)',
    barFill: 0.72,
  },
  {
    id: '3',
    time: '02:00', ampm: 'pm',
    title: 'Deep-work: Voice pipeline',
    statusLabel: 'In 2h 42m',
    statusColor: 'var(--jarvis-cyan)',
    barFill: 0.45,
  },
  {
    id: '4',
    time: '06:30', ampm: 'pm',
    title: 'Design Review — Command Center V1',
    statusLabel: 'In 5h 12m',
    statusColor: 'rgba(120,169,198,0.5)',
    barFill: 0.18,
  },
];

export default function MissionTimeline() {
  const [today, setToday] = useState('Today');

  useEffect(() => {
    const d = new Date();
    setToday(d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }));
  }, []);

  return (
    <div className="dashboard-panel flex flex-col" role="region" aria-label="Mission Timeline">
      <div className="panel-header">
        <span>Mission Timeline</span>
        <span
          className="text-[10px] px-2 py-0.5 rounded"
          style={{
            background: 'rgba(0,212,255,0.06)',
            color: 'rgba(0,212,255,0.5)',
            border: '1px solid rgba(0,212,255,0.1)',
          }}
        >
          {today}
        </span>
      </div>

      <div className="flex-1 overflow-auto jarvis-scrollbar p-3 space-y-2">
        {TIMELINE_ITEMS.map((item) => (
          <div
            key={item.id}
            className="flex gap-3"
            role="article"
            aria-label={`${item.time} ${item.ampm}: ${item.title}`}
          >
            {/* Time */}
            <div className="flex flex-col items-end w-12 flex-shrink-0 pt-0.5">
              <span
                className="text-[10px] font-mono"
                style={{ color: item.done ? 'rgba(120,169,198,0.4)' : 'var(--jarvis-text-dim)' }}
              >
                {item.time}
              </span>
              <span className="text-[8px] text-jarvis-text-dim/30 uppercase">{item.ampm}</span>
            </div>

            {/* Timeline dot + line */}
            <div className="flex flex-col items-center flex-shrink-0">
              <div
                className="w-2 h-2 rounded-full mt-0.5 flex-shrink-0"
                style={{
                  background: item.done ? 'rgba(0,255,136,0.5)' : item.statusColor,
                  boxShadow: item.done ? 'none' : `0 0 4px ${item.statusColor}`,
                }}
                aria-hidden="true"
              />
              <div
                className="w-px flex-1 mt-1"
                style={{ background: 'rgba(0,212,255,0.1)', minHeight: '16px' }}
                aria-hidden="true"
              />
            </div>

            {/* Content */}
            <div className="flex-1 pb-1">
              <div
                className="text-[11px] font-medium leading-snug"
                style={{ color: item.done ? 'rgba(224,240,255,0.45)' : 'var(--jarvis-text)' }}
              >
                {item.title}
              </div>

              {/* Progress bar */}
              <div
                className="mt-1.5 h-0.5 rounded-full overflow-hidden"
                style={{ background: 'rgba(0,212,255,0.08)' }}
                aria-hidden="true"
              >
                <div
                  className="h-full rounded-full transition-all duration-1000"
                  style={{
                    width: `${item.barFill * 100}%`,
                    background: item.done
                      ? 'rgba(0,255,136,0.4)'
                      : `linear-gradient(90deg, ${item.statusColor}, transparent)`,
                  }}
                />
              </div>

              <div className="flex items-center justify-between mt-1">
                <span
                  className="text-[9px]"
                  style={{ color: item.statusColor }}
                >
                  {item.statusLabel}
                </span>
                {item.done && (
                  <span className="badge badge-done text-[8px]">Done</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="px-3 py-2 border-t border-jarvis-cyan/[0.05]">
        <button
          className="text-[10px] font-medium tracking-wide"
          style={{ color: 'var(--jarvis-cyan)', opacity: 0.6 }}
        >
          View Full Schedule ›
        </button>
      </div>
    </div>
  );
}
