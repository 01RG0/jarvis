'use client';

import type { ServerStatus } from '@/lib/types';

interface MemoryInsightsProps {
  serverStatus: ServerStatus;
}

// Constellation dots — fixed layout
const DOTS = [
  { x: 60, y: 30, r: 2.5, opacity: 0.9 },
  { x: 120, y: 55, r: 3, opacity: 1 },
  { x: 80, y: 85, r: 2, opacity: 0.6 },
  { x: 160, y: 40, r: 2.5, opacity: 0.8 },
  { x: 200, y: 75, r: 3.5, opacity: 1 },
  { x: 45, y: 60, r: 2, opacity: 0.5 },
  { x: 240, y: 45, r: 2, opacity: 0.65 },
  { x: 180, y: 100, r: 2.5, opacity: 0.7 },
  { x: 140, y: 90, r: 2, opacity: 0.55 },
  { x: 100, y: 30, r: 1.5, opacity: 0.45 },
  { x: 260, y: 80, r: 2, opacity: 0.6 },
  { x: 30, y: 90, r: 1.5, opacity: 0.4 },
  { x: 220, y: 25, r: 1.5, opacity: 0.5 },
  { x: 290, y: 55, r: 2, opacity: 0.5 },
  { x: 310, y: 90, r: 1.5, opacity: 0.4 },
];

const LINES = [
  [0, 1], [1, 3], [3, 4], [4, 6], [1, 2], [2, 8], [8, 7],
  [7, 4], [3, 9], [0, 5], [5, 2], [4, 10], [10, 13], [13, 14],
];

export default function MemoryInsights({ serverStatus }: MemoryInsightsProps) {
  const memories = serverStatus.memory_entries ?? 3380;
  const conversationTurns = 22;
  const toolCalls = 14;

  return (
    <div className="dashboard-panel flex flex-col" role="region" aria-label="Memory Insights">
      <div className="panel-header">
        <span>Memory Insights</span>
      </div>

      <div className="flex-1 flex flex-col">
        {/* Constellation SVG */}
        <div
          className="flex-1 relative overflow-hidden"
          style={{ minHeight: '80px' }}
          aria-hidden="true"
        >
          <svg
            viewBox="0 0 340 120"
            className="absolute inset-0 w-full h-full"
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              <radialGradient id="dot-glow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="rgba(0,212,255,0.9)" />
                <stop offset="100%" stopColor="rgba(0,212,255,0.2)" />
              </radialGradient>
              <filter id="glow-filter">
                <feGaussianBlur stdDeviation="2" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Connection lines */}
            {LINES.map(([a, b], i) => (
              <line
                key={i}
                x1={DOTS[a].x}
                y1={DOTS[a].y}
                x2={DOTS[b].x}
                y2={DOTS[b].y}
                stroke="rgba(0,212,255,0.12)"
                strokeWidth="0.8"
              />
            ))}

            {/* Dots */}
            {DOTS.map((dot, i) => (
              <circle
                key={i}
                cx={dot.x}
                cy={dot.y}
                r={dot.r}
                fill={`rgba(0,212,255,${dot.opacity})`}
                filter="url(#glow-filter)"
                style={{
                  animation: `constellationPulse ${2 + (i % 4) * 0.5}s ease-in-out infinite`,
                  animationDelay: `${i * 0.18}s`,
                }}
              />
            ))}
          </svg>
        </div>

        {/* Stats */}
        <div className="flex items-end justify-between px-4 pb-3 gap-3">
          <div className="flex flex-col">
            <span
              className="text-2xl font-bold font-mono jarvis-glow"
              style={{ color: 'var(--jarvis-cyan)', lineHeight: '1' }}
            >
              {memories.toLocaleString()}
            </span>
            <span className="text-[9px] tracking-wider uppercase text-jarvis-text-dim/50 mt-0.5">
              Memories
            </span>
          </div>

          <div className="flex gap-4">
            <div className="flex flex-col items-center">
              <span className="text-base font-bold font-mono" style={{ color: 'rgba(200,180,255,0.9)' }}>
                {conversationTurns}
              </span>
              <span className="text-[8px] tracking-wide text-jarvis-text-dim/40 text-center leading-tight">
                Conversation<br/>Turns
              </span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-base font-bold font-mono" style={{ color: 'rgba(0,255,180,0.85)' }}>
                {toolCalls}
              </span>
              <span className="text-[8px] tracking-wide text-jarvis-text-dim/40 text-center leading-tight">
                Tool<br/>Calls
              </span>
            </div>
          </div>
        </div>

        <div className="px-3 pb-2 border-t border-jarvis-cyan/[0.05] pt-2">
          <button
            className="text-[10px] font-medium tracking-wide"
            style={{ color: 'var(--jarvis-cyan)', opacity: 0.6 }}
          >
            View Memory Map ›
          </button>
        </div>
      </div>
    </div>
  );
}
