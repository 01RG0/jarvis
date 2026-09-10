'use client';

import type { ServerStatus } from '@/lib/types';

interface AICoreOverviewProps {
  connected: boolean;
  serverStatus: ServerStatus;
}

// Minimal SVG icon components
function IconCore({ color }: { color: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" aria-hidden="true">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  );
}
function IconMemory({ color }: { color: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" aria-hidden="true">
      <ellipse cx="12" cy="5" rx="9" ry="3"/>
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
    </svg>
  );
}
function IconVoice({ color }: { color: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" aria-hidden="true">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
      <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
    </svg>
  );
}
function IconAgents({ color }: { color: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="8" r="4"/>
      <path d="M4 20v-2a8 8 0 0 1 16 0v2"/>
    </svg>
  );
}
function IconLLMs({ color }: { color: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" aria-hidden="true">
      <rect x="2" y="3" width="20" height="14" rx="2"/>
      <path d="M8 21h8M12 17v4"/>
    </svg>
  );
}
function IconSystem({ color }: { color: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  );
}

interface CoreItem {
  id: string;
  iconBg: string;
  iconColor: string;
  label: string;
  value: string;
  statusColor: string;
  dot?: 'active' | 'standby' | 'online' | 'connecting';
}

export default function AICoreOverview({ connected, serverStatus }: AICoreOverviewProps) {
  const memoryCount = serverStatus.memory_entries ?? 3380;

  const items: CoreItem[] = [
    {
      id: 'core',
      iconBg: 'rgba(0,212,255,0.1)',
      iconColor: '#00d4ff',
      label: 'AI Core',
      value: connected ? 'Active' : 'Offline',
      statusColor: connected ? 'var(--jarvis-success)' : 'var(--jarvis-error)',
      dot: connected ? 'active' : 'standby',
    },
    {
      id: 'memory',
      iconBg: 'rgba(100,80,255,0.12)',
      iconColor: '#9988ff',
      label: 'Memory',
      value: `${memoryCount.toLocaleString()} Stored`,
      statusColor: 'rgba(160,140,255,0.7)',
    },
    {
      id: 'voice',
      iconBg: 'rgba(0,255,136,0.08)',
      iconColor: '#00ff88',
      label: 'Voice',
      value: 'Online',
      statusColor: 'var(--jarvis-success)',
      dot: 'online',
    },
    {
      id: 'agents',
      iconBg: 'rgba(0,212,255,0.08)',
      iconColor: 'rgba(0,212,255,0.8)',
      label: 'Agents',
      value: '2 Running',
      statusColor: 'var(--jarvis-cyan)',
      dot: 'active',
    },
    {
      id: 'llms',
      iconBg: 'rgba(255,225,140,0.08)',
      iconColor: '#ffe18c',
      label: 'LLMs',
      value: '4 Connected',
      statusColor: 'var(--jarvis-gold)',
    },
    {
      id: 'system',
      iconBg: 'rgba(0,255,136,0.07)',
      iconColor: '#00ff88',
      label: 'System',
      value: 'Optimal',
      statusColor: 'var(--jarvis-success)',
      dot: 'online',
    },
  ];

  const iconMap: Record<string, (color: string) => React.ReactNode> = {
    core: (c) => <IconCore color={c} />,
    memory: (c) => <IconMemory color={c} />,
    voice: (c) => <IconVoice color={c} />,
    agents: (c) => <IconAgents color={c} />,
    llms: (c) => <IconLLMs color={c} />,
    system: (c) => <IconSystem color={c} />,
  };

  return (
    <div className="dashboard-panel flex flex-col" role="region" aria-label="AI Core Overview">
      <div className="panel-header">
        <span>AI Core Overview</span>
      </div>

      <div className="flex-1 overflow-auto jarvis-scrollbar p-2 space-y-1.5">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded cursor-default"
            style={{
              background: 'rgba(0, 14, 32, 0.5)',
              border: '1px solid rgba(0, 255, 255, 0.07)',
              transition: 'border-color 0.15s ease',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(0,255,255,0.14)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(0,255,255,0.07)';
            }}
          >
            {/* Icon */}
            <div
              className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0"
              style={{ background: item.iconBg, border: `1px solid ${item.iconColor}22` }}
              aria-hidden="true"
            >
              {iconMap[item.id]?.(item.iconColor)}
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
              <div
                className="text-[11px] font-medium"
                style={{ color: 'var(--jarvis-text)', fontFamily: 'Fira Code, monospace' }}
              >
                {item.label}
              </div>
              <div
                className="text-[10px]"
                style={{ color: item.statusColor, fontFamily: 'Fira Code, monospace' }}
              >
                {item.value}
              </div>
            </div>

            {/* Status dot */}
            {item.dot && (
              <span className={`status-dot ${item.dot}`} aria-hidden="true" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
