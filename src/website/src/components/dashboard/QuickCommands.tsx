'use client';

interface QuickCommandsProps {
  onStartVoice: () => void;
  connected: boolean;
}

interface Command {
  id: string;
  icon: React.ReactNode;
  label: string;
  action?: string;
  accent?: string;
  borderColor?: string;
}

export default function QuickCommands({ onStartVoice, connected }: QuickCommandsProps) {
  const commands: Command[] = [
    {
      id: 'new-task',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      ),
      label: 'Start New Task',
      accent: 'var(--jarvis-cyan)',
      borderColor: 'rgba(0,212,255,0.18)',
    },
    {
      id: 'calendar',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
      ),
      label: 'Open Calendar',
      accent: 'var(--jarvis-gold)',
      borderColor: 'rgba(255,225,140,0.15)',
    },
    {
      id: 'voice',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
          <line x1="12" y1="19" x2="12" y2="23"/>
          <line x1="8" y1="23" x2="16" y2="23"/>
        </svg>
      ),
      label: 'Start Voice Chat',
      accent: 'var(--jarvis-success)',
      borderColor: 'rgba(0,255,136,0.15)',
    },
    {
      id: 'workflow',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <polygon points="5 3 19 12 5 21 5 3"/>
        </svg>
      ),
      label: 'Run Workflow',
      accent: 'rgba(180,100,255,0.9)',
      borderColor: 'rgba(180,100,255,0.15)',
    },
  ];

  return (
    <div className="dashboard-panel flex flex-col" role="region" aria-label="Quick Commands">
      <div className="panel-header">
        <span>Quick Commands</span>
      </div>

      <div className="flex-1 p-3 flex flex-col gap-2 justify-center">
        {commands.map((cmd) => (
          <button
            key={cmd.id}
            onClick={cmd.id === 'voice' ? onStartVoice : undefined}
            disabled={cmd.id === 'voice' && !connected}
            className="w-full flex items-center gap-3 px-4 py-3 rounded transition-all duration-200 text-left"
            style={{
              background: 'rgba(0, 14, 32, 0.6)',
              border: `1px solid ${cmd.borderColor ?? 'rgba(0,212,255,0.1)'}`,
              color: cmd.accent,
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget;
              el.style.background = `rgba(0, 20, 45, 0.8)`;
              el.style.boxShadow = `0 0 12px rgba(0,212,255,0.06)`;
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget;
              el.style.background = 'rgba(0, 14, 32, 0.6)';
              el.style.boxShadow = 'none';
            }}
            aria-label={cmd.label}
          >
            <div
              className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0"
              style={{
                background: `color-mix(in srgb, ${cmd.accent} 15%, transparent)`,
                border: `1px solid ${cmd.borderColor ?? 'rgba(0,212,255,0.15)'}`,
                color: cmd.accent,
              }}
              aria-hidden="true"
            >
              {cmd.icon}
            </div>
            <span className="text-[12px] font-medium tracking-wide" style={{ color: 'var(--jarvis-text)' }}>
              {cmd.label}
            </span>
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="ml-auto opacity-30"
              aria-hidden="true"
            >
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
        ))}
      </div>
    </div>
  );
}
