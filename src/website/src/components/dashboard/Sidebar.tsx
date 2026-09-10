'use client';

import { useRef, useEffect } from 'react';

interface SidebarProps {
  activeNav?: string;
  onNavChange?: (nav: string) => void;
  isStreaming: boolean;
  onToggleVoice: () => void;
  voiceSupported: boolean;
  connected: boolean;
}

// SVG icon components for nav items
const NavIcons: Record<string, React.FC<{ active: boolean }>> = {
  'command-center': ({ active }) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={active ? '#00ffff' : 'currentColor'} strokeWidth="2" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
      <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
    </svg>
  ),
  'ai-core': ({ active }) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={active ? '#00ffff' : 'currentColor'} strokeWidth="2" aria-hidden="true">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  ),
  'agents': ({ active }) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={active ? '#00ffff' : 'currentColor'} strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="8" r="4"/><path d="M4 20v-2a8 8 0 0 1 16 0v2"/>
    </svg>
  ),
  'tasks': ({ active }) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={active ? '#00ffff' : 'currentColor'} strokeWidth="2" aria-hidden="true">
      <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
      <line x1="8" y1="18" x2="21" y2="18"/>
      <polyline points="3 6 4 7 6 5"/><polyline points="3 12 4 13 6 11"/><polyline points="3 18 4 19 6 17"/>
    </svg>
  ),
  'calendar': ({ active }) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={active ? '#00ffff' : 'currentColor'} strokeWidth="2" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  ),
  'memory': ({ active }) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={active ? '#00ffff' : 'currentColor'} strokeWidth="2" aria-hidden="true">
      <ellipse cx="12" cy="5" rx="9" ry="3"/>
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
    </svg>
  ),
  'conversations': ({ active }) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={active ? '#00ffff' : 'currentColor'} strokeWidth="2" aria-hidden="true">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  ),
  'knowledge': ({ active }) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={active ? '#00ffff' : 'currentColor'} strokeWidth="2" aria-hidden="true">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
    </svg>
  ),
  'tools': ({ active }) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={active ? '#00ffff' : 'currentColor'} strokeWidth="2" aria-hidden="true">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
    </svg>
  ),
  'workflows': ({ active }) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={active ? '#00ffff' : 'currentColor'} strokeWidth="2" aria-hidden="true">
      <polygon points="5 3 19 12 5 21 5 3"/>
    </svg>
  ),
};

interface NavItem {
  id: string;
  label: string;
  badge?: number;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'command-center', label: 'Command Center' },
  { id: 'ai-core', label: 'AI Core' },
  { id: 'agents', label: 'Agents' },
  { id: 'tasks', label: 'Tasks', badge: 3 },
  { id: 'calendar', label: 'Calendar' },
  { id: 'memory', label: 'Memory' },
  { id: 'conversations', label: 'Conversations', badge: 12 },
  { id: 'knowledge', label: 'Knowledge Base' },
  { id: 'tools', label: 'Tools & Skills', badge: 18 },
  { id: 'workflows', label: 'Workflows' },
];

const WAVE_COUNT = 20;
const WAVE_BASE = [3, 5, 8, 12, 10, 7, 14, 9, 6, 11, 8, 5, 13, 7, 4, 10, 12, 6, 9, 14];

export default function Sidebar({
  activeNav = 'command-center',
  onNavChange,
  isStreaming,
  onToggleVoice,
  voiceSupported,
  connected,
}: SidebarProps) {
  const barsRef = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (!isStreaming) return;
    let timerId: ReturnType<typeof setTimeout>;
    const animate = () => {
      barsRef.current.forEach((bar) => {
        if (!bar) return;
        bar.style.height = `${3 + Math.random() * 12}px`;
      });
      timerId = setTimeout(() => requestAnimationFrame(animate), 85);
    };
    requestAnimationFrame(animate);
    return () => clearTimeout(timerId);
  }, [isStreaming]);

  return (
    <aside
      className="sidebar-root flex flex-col h-full select-none"
      role="navigation"
      aria-label="Main navigation"
      style={{ fontFamily: 'var(--font-body)' }}
    >
      {/* Logo */}
      <div
        className="flex items-center gap-3 px-4 py-4"
        style={{ borderBottom: '1px solid rgba(0,255,255,0.07)' }}
      >
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 relative"
          style={{
            background: 'radial-gradient(circle at 40% 40%, rgba(0,100,200,0.4), rgba(0,20,60,0.7))',
            border: '1px solid rgba(0,255,255,0.3)',
            boxShadow: '0 0 14px rgba(0,255,255,0.15)',
          }}
          aria-hidden="true"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00ffff" strokeWidth="2" opacity="0.9">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
        </div>
        <div>
          <div
            className="text-[13px] font-bold tracking-[0.25em]"
            style={{
              fontFamily: 'Fira Code, monospace',
              color: '#00ffff',
              textShadow: '0 0 8px rgba(0,255,255,0.5)',
            }}
          >
            JARVIS
          </div>
          <div
            className="text-[8px] tracking-[0.2em] uppercase"
            style={{ color: 'rgba(0,255,255,0.4)', fontFamily: 'Fira Code, monospace' }}
          >
            Command Center
          </div>
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto jarvis-scrollbar px-2 py-3 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const Icon = NavIcons[item.id] ?? (() => null);
          const isActive = activeNav === item.id;
          return (
            <button
              key={item.id}
              className={`nav-item w-full text-left cursor-pointer`}
              style={{
                ...(isActive
                  ? {
                      background: 'rgba(0,255,255,0.07)',
                      color: '#00ffff',
                      borderLeft: '2px solid rgba(0,255,255,0.6)',
                      paddingLeft: '10px',
                      textShadow: '0 0 6px rgba(0,255,255,0.3)',
                    }
                  : {}),
              }}
              onClick={() => onNavChange?.(item.id)}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon active={isActive} />
              <span
                className="flex-1 text-[11px] tracking-wide"
                style={{ fontFamily: 'var(--font-body)' }}
              >
                {item.label}
              </span>
              {item.badge !== undefined && (
                <span
                  className="text-[9px] font-mono px-1.5 py-0.5 rounded-full flex-shrink-0"
                  style={{
                    background: 'rgba(0,255,255,0.08)',
                    color: 'rgba(0,255,255,0.5)',
                    border: '1px solid rgba(0,255,255,0.12)',
                    fontFamily: 'Fira Code, monospace',
                  }}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Voice Status */}
      <div
        className="p-3"
        style={{
          borderTop: '1px solid rgba(0,255,255,0.07)',
          background: 'rgba(0, 10, 25, 0.4)',
        }}
      >
        <div className="flex items-center justify-between mb-2">
          <span
            className="text-[9px] font-bold tracking-[0.18em] uppercase"
            style={{ fontFamily: 'Fira Code, monospace', color: 'rgba(0,255,255,0.4)' }}
          >
            Voice Status
          </span>
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{
              background: connected ? 'var(--jarvis-success)' : 'var(--jarvis-error)',
              boxShadow: connected ? '0 0 4px rgba(0,255,136,0.6)' : '0 0 4px rgba(255,68,68,0.6)',
            }}
            aria-hidden="true"
          />
        </div>

        {/* Waveform bars */}
        <div className="flex items-end gap-[2px] h-5 mb-3" aria-hidden="true">
          {Array.from({ length: WAVE_COUNT }).map((_, i) => (
            <div
              key={i}
              ref={(el) => { barsRef.current[i] = el; }}
              style={{
                width: '2px',
                height: `${isStreaming ? WAVE_BASE[i] : Math.max(2, WAVE_BASE[i] * 0.22)}px`,
                borderRadius: '1px',
                background: isStreaming
                  ? 'rgba(0,255,255,0.7)'
                  : 'rgba(0,255,255,0.2)',
                transition: isStreaming ? undefined : 'height 0.3s ease',
                flexShrink: 0,
              }}
            />
          ))}
        </div>

        {/* Mic orb button */}
        <div className="flex flex-col items-center gap-2">
          <button
            onClick={onToggleVoice}
            disabled={!voiceSupported}
            aria-label={isStreaming ? 'Stop listening' : 'Start voice input'}
            className="relative w-12 h-12 rounded-full flex items-center justify-center cursor-pointer transition-all duration-200"
            style={{
              background: isStreaming
                ? 'radial-gradient(circle, rgba(0,255,136,0.2), rgba(0,80,60,0.15))'
                : 'radial-gradient(circle, rgba(0,212,255,0.12), rgba(0,30,80,0.1))',
              border: `1px solid ${isStreaming ? 'rgba(0,255,136,0.45)' : 'rgba(0,255,255,0.28)'}`,
              boxShadow: isStreaming
                ? '0 0 16px rgba(0,255,136,0.2)'
                : '0 0 10px rgba(0,255,255,0.1)',
            }}
          >
            {isStreaming && (
              <span
                className="absolute inset-[-4px] rounded-full pointer-events-none"
                style={{
                  border: '1px solid rgba(0,255,136,0.2)',
                  animation: 'ringPulse 1.5s ease-out infinite',
                }}
                aria-hidden="true"
              />
            )}
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke={isStreaming ? 'rgba(0,255,136,0.9)' : 'rgba(0,255,255,0.7)'}
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="23"/>
              <line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
          </button>

          <span
            className="text-[10px] tracking-wide"
            style={{
              color: isStreaming ? 'rgba(0,255,136,0.7)' : 'rgba(0,255,255,0.35)',
              fontFamily: 'Fira Code, monospace',
            }}
          >
            {isStreaming ? 'Listening...' : 'Tap to Speak'}
          </span>

          <button
            className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded cursor-pointer transition-all duration-150"
            style={{
              background: 'rgba(0,255,255,0.04)',
              border: '1px solid rgba(0,255,255,0.1)',
              color: 'rgba(0,255,255,0.4)',
              fontSize: '10px',
              fontFamily: 'Fira Code, monospace',
              letterSpacing: '0.08em',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,255,255,0.08)';
              (e.currentTarget as HTMLButtonElement).style.color = 'rgba(0,255,255,0.6)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,255,255,0.04)';
              (e.currentTarget as HTMLButtonElement).style.color = 'rgba(0,255,255,0.4)';
            }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            Focus Mode
          </button>
        </div>
      </div>
    </aside>
  );
}
