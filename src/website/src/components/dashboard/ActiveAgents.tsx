'use client';

import { useRef, useEffect } from 'react';

interface Agent {
  id: string;
  name: string;
  icon: string;
  iconColor: string;
  iconBg: string;
  status: 'active' | 'standby';
}

const AGENTS: Agent[] = [
  { id: 'coding', name: 'Coding Agent', icon: '</>', iconColor: 'var(--jarvis-cyan)', iconBg: 'rgba(0,212,255,0.1)', status: 'active' },
  { id: 'research', name: 'Research Agent', icon: '🔍', iconColor: '#aaddff', iconBg: 'rgba(100,180,255,0.1)', status: 'active' },
  { id: 'memory', name: 'Memory Agent', icon: '◎', iconColor: '#aa88ff', iconBg: 'rgba(120,80,255,0.1)', status: 'active' },
  { id: 'browser', name: 'Browser Agent', icon: '🌐', iconColor: 'rgba(0,212,255,0.6)', iconBg: 'rgba(0,212,255,0.06)', status: 'standby' },
  { id: 'task', name: 'Task Agent', icon: '✓', iconColor: 'rgba(0,212,255,0.5)', iconBg: 'rgba(0,212,255,0.05)', status: 'standby' },
  { id: 'system', name: 'System Agent', icon: '⚙', iconColor: 'var(--jarvis-success)', iconBg: 'rgba(0,255,136,0.06)', status: 'standby' },
];

const WAVE_HEIGHTS = [3, 6, 9, 5, 11, 7, 4, 8, 12, 6, 3, 9, 5, 7];

function WaveformBars({ active }: { active: boolean }) {
  const barsRef = useRef<HTMLDivElement[]>([]);

  useEffect(() => {
    if (!active) return;
    let raf: ReturnType<typeof setTimeout>;
    const animate = () => {
      barsRef.current.forEach((bar) => {
        if (!bar) return;
        bar.style.height = `${2 + Math.random() * 9}px`;
      });
      raf = setTimeout(() => requestAnimationFrame(animate), 90);
    };
    requestAnimationFrame(animate);
    return () => clearTimeout(raf);
  }, [active]);

  return (
    <div className="flex items-end gap-[1.5px] h-3" aria-hidden="true">
      {WAVE_HEIGHTS.map((h, i) => (
        <div
          key={i}
          ref={(el) => { if (el) barsRef.current[i] = el; }}
          style={{
            width: '1.5px',
            height: `${active ? h : Math.max(2, h * 0.25)}px`,
            borderRadius: '1px',
            background: active ? 'var(--jarvis-cyan)' : 'rgba(0,212,255,0.2)',
            animationDelay: active ? `${i * 0.04}s` : undefined,
            transition: 'height 0.15s ease',
            flexShrink: 0,
          }}
        />
      ))}
    </div>
  );
}

export default function ActiveAgents() {
  return (
    <div className="dashboard-panel flex flex-col" role="region" aria-label="Active Agents">
      <div className="panel-header">
        <span>Active Agents</span>
        <button
          className="text-[10px] font-medium tracking-wide"
          style={{ color: 'var(--jarvis-cyan)', opacity: 0.6 }}
        >
          View All ›
        </button>
      </div>

      <div className="flex-1 p-2">
        <div className="grid grid-cols-3 gap-1.5 h-full">
          {AGENTS.map((agent) => (
            <div
              key={agent.id}
              className={`agent-card flex-col items-start gap-1.5 ${agent.status === 'active' ? 'active' : 'standby'}`}
              role="article"
              aria-label={`${agent.name} - ${agent.status}`}
            >
              <div className="flex items-center gap-1.5 w-full">
                {/* Icon */}
                <div
                  className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0 text-xs"
                  style={{ background: agent.iconBg, color: agent.iconColor }}
                  aria-hidden="true"
                >
                  {agent.icon}
                </div>

                {/* Status dot */}
                <div className="flex-1" />
                <span
                  className={`status-dot ${agent.status === 'active' ? 'active' : 'standby'}`}
                  aria-hidden="true"
                />
              </div>

              <div className="w-full">
                <div className="text-[10px] font-medium text-jarvis-text/85 leading-tight">{agent.name}</div>
                <div
                  className="text-[9px] capitalize mt-0.5"
                  style={{
                    color: agent.status === 'active' ? 'var(--jarvis-success)' : 'rgba(120,169,198,0.45)',
                  }}
                >
                  • {agent.status}
                </div>
              </div>

              {/* Mini waveform */}
              <WaveformBars active={agent.status === 'active'} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
