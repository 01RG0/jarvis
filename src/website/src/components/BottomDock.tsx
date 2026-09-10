'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, MessageSquare, BarChart2, Settings, Brain, Plus, Clock, StickyNote, Monitor, TrendingUp, Globe, ScrollText, Film, Cpu } from 'lucide-react';
import { WidgetId, SpawnableType } from '@/hooks/useWidgetManager';

interface BottomDockProps {
  onToggleWidget: (id: WidgetId) => void;
  activeWidgets: Record<WidgetId, boolean>;
  isMicOn: boolean;
  onToggleMic: () => void;
  onSpawn: (type: SpawnableType) => void;
}

interface DockButton {
  id: string;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  isActive?: boolean;
}

const HIDE_DELAY = 3500;
const BOTTOM_ZONE = 120; // px from bottom that triggers reveal

export default function BottomDock({
  onToggleWidget,
  activeWidgets,
  isMicOn,
  onToggleMic,
  onSpawn,
}: BottomDockProps) {
  const [spawnOpen, setSpawnOpen] = useState(false);
  const [visible, setVisible] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleHide = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setVisible(false), HIDE_DELAY);
  }, []);

  const reveal = useCallback(() => {
    setVisible(true);
    scheduleHide();
  }, [scheduleHide]);

  useEffect(() => {
    scheduleHide();

    function handleMouseMove(e: MouseEvent) {
      if (e.clientY >= window.innerHeight - BOTTOM_ZONE) {
        reveal();
      }
    }

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [reveal, scheduleHide]);

  const buttons: DockButton[] = [
    {
      id: 'mic',
      icon: isMicOn ? <MicOff size={15} /> : <Mic size={15} />,
      label: isMicOn ? 'Stop voice  [V]' : 'Start voice  [V]',
      onClick: onToggleMic,
      isActive: isMicOn,
    },
    {
      id: 'chat',
      icon: <MessageSquare size={15} />,
      label: 'Chat  [C]',
      onClick: () => onToggleWidget('chat'),
      isActive: activeWidgets.chat,
    },
    {
      id: 'stats',
      icon: <BarChart2 size={15} />,
      label: 'System stats  [S]',
      onClick: () => onToggleWidget('stats'),
      isActive: activeWidgets.stats,
    },
    {
      id: 'settings',
      icon: <Settings size={15} />,
      label: 'Settings',
      onClick: () => onToggleWidget('settings'),
      isActive: activeWidgets.settings,
    },
    {
      id: 'memory',
      icon: <Brain size={15} />,
      label: 'Memory  [M]',
      onClick: () => onToggleWidget('memory'),
      isActive: activeWidgets.memory,
    },
  ];

  const spawnItems: { type: SpawnableType; label: string; icon: React.ReactNode }[] = [
    { type: 'clock',   label: 'Clock',       icon: <Clock      size={13} /> },
    { type: 'notes',   label: 'Notes',       icon: <StickyNote size={13} /> },
    { type: 'sysmon',  label: 'Sys Monitor', icon: <Monitor    size={13} /> },
    { type: 'graph',   label: 'Live Graph',  icon: <TrendingUp size={13} /> },
    { type: 'webview', label: 'Web Viewer',  icon: <Globe      size={13} /> },
    { type: 'logs',    label: 'Logs',        icon: <ScrollText size={13} /> },
    { type: 'media',     label: 'Media',      icon: <Film       size={13} /> },
    { type: 'providers', label: 'AI Providers',icon: <Cpu        size={13} /> },
  ];

  return (
    <nav
      aria-label="JARVIS controls"
      onMouseEnter={reveal}
      style={{
        position: 'fixed',
        bottom: 28,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: 10,
        alignItems: 'center',
        zIndex: 50,
        opacity: visible ? 1 : 0.07,
        transition: 'opacity 0.6s ease',
        padding: '8px 16px',
        borderRadius: 999,
        background: visible ? 'rgba(0,0,0,0.30)' : 'transparent',
        backdropFilter: visible ? 'blur(12px)' : 'none',
        border: visible ? '1px solid rgba(0,168,255,0.08)' : '1px solid transparent',
      }}
    >
      {buttons.map(btn => (
        <button
          key={btn.id}
          onClick={btn.onClick}
          aria-label={btn.label}
          aria-pressed={btn.isActive}
          title={btn.label}
          style={{
            width: 32, height: 32, borderRadius: '50%',
            background: btn.isActive ? 'rgba(0,168,255,0.18)' : 'rgba(0,0,0,0.35)',
            border: btn.isActive ? '1px solid rgba(0,168,255,0.50)' : '1px solid rgba(255,255,255,0.07)',
            color: btn.isActive ? '#00a8ff' : 'rgba(255,255,255,0.38)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', transition: 'all 0.18s ease',
            boxShadow: btn.isActive ? '0 0 10px rgba(0,168,255,0.28)' : 'none',
            flexShrink: 0,
          }}
          onMouseEnter={e => {
            const el = e.currentTarget;
            el.style.color = '#00a8ff';
            el.style.borderColor = 'rgba(0,168,255,0.42)';
            el.style.background = 'rgba(0,168,255,0.14)';
          }}
          onMouseLeave={e => {
            const el = e.currentTarget;
            if (btn.isActive) {
              el.style.color = '#00a8ff';
              el.style.borderColor = 'rgba(0,168,255,0.50)';
              el.style.background = 'rgba(0,168,255,0.18)';
            } else {
              el.style.color = 'rgba(255,255,255,0.38)';
              el.style.borderColor = 'rgba(255,255,255,0.07)';
              el.style.background = 'rgba(0,0,0,0.35)';
            }
          }}
        >
          {btn.icon}
        </button>
      ))}

      {/* Divider */}
      <div style={{ width: 1, height: 16, background: 'rgba(0,168,255,0.12)' }} />

      {/* Spawn widget "+" button */}
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setSpawnOpen(v => !v)}
          aria-label="Add widget"
          title="Add widget"
          aria-expanded={spawnOpen}
          style={{
            width: 32, height: 32, borderRadius: '50%',
            background: spawnOpen ? 'rgba(0,168,255,0.18)' : 'rgba(0,0,0,0.35)',
            border: spawnOpen ? '1px solid rgba(0,168,255,0.5)' : '1px solid rgba(255,255,255,0.07)',
            color: spawnOpen ? '#00a8ff' : 'rgba(255,255,255,0.38)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', transition: 'all 0.18s ease', flexShrink: 0,
          }}
        >
          <Plus size={15} />
        </button>

        {/* Spawn popup */}
        {spawnOpen && (
          <div style={{
            position: 'absolute', bottom: 42, left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(4,8,18,0.96)',
            border: '1px solid rgba(0,168,255,0.18)',
            borderRadius: 8, backdropFilter: 'blur(20px)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            overflow: 'hidden', minWidth: 150,
            animation: 'fadeInUp 0.15s ease',
            zIndex: 100,
          }}>
            <div style={{
              padding: '6px 12px 5px',
              borderBottom: '1px solid rgba(0,168,255,0.08)',
              fontFamily: "'Rajdhani','Fira Code',monospace",
              fontSize: 8, letterSpacing: '0.28em',
              color: 'rgba(0,168,255,0.4)', textTransform: 'uppercase',
            }}>Add widget</div>
            {spawnItems.map(item => (
              <button key={item.type}
                onClick={() => { onSpawn(item.type); setSpawnOpen(false); reveal(); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  width: '100%', padding: '9px 14px',
                  background: 'none', border: 'none',
                  color: 'rgba(224,240,255,0.75)',
                  fontSize: 12, fontFamily: 'var(--font-mono)',
                  cursor: 'pointer', transition: 'background 0.12s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,168,255,0.08)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
}
