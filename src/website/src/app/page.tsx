'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { OrbState } from '@/lib/types';
import { useJarvisWebSocket } from '@/hooks/useJarvisWebSocket';
import { useVoiceStream } from '@/hooks/useVoiceStream';
import { useWidgetManager, WidgetId } from '@/hooks/useWidgetManager';
import BottomDock from '@/components/BottomDock';
import HudCorners from '@/components/HudCorners';
import DraggableWidget from '@/components/DraggableWidget';
import ChatWidget from '@/components/widgets/ChatWidget';
import StatsWidget from '@/components/widgets/StatsWidget';
import MemoryWidget from '@/components/widgets/MemoryWidget';
import SettingsWidget from '@/components/widgets/SettingsWidget';
import ClockWidget   from '@/components/widgets/ClockWidget';
import NotesWidget   from '@/components/widgets/NotesWidget';
import SysMonWidget  from '@/components/widgets/SysMonWidget';
import GraphWidget   from '@/components/widgets/GraphWidget';
import WebViewWidget from '@/components/widgets/WebViewWidget';
import LogsWidget      from '@/components/widgets/LogsWidget';
import MediaWidget     from '@/components/widgets/MediaWidget';
import ProvidersWidget   from '@/components/widgets/ProvidersWidget';
import SelfUpdateWidget from '@/components/widgets/SelfUpdateWidget';

const OrbRing = dynamic(() => import('@/components/OrbRing'), { ssr: false });

// Right-click context menu
function OrbContextMenu({
  x, y, onClose, onAction,
}: {
  x: number; y: number;
  onClose: () => void;
  onAction: (action: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [onClose]);

  const items = [
    { label: 'Chat',         action: 'chat',     key: 'C' },
    { label: 'System stats', action: 'stats',    key: 'S' },
    { label: 'Memory',       action: 'memory',   key: 'M' },
    { label: 'Settings',     action: 'settings', key: '' },
  ];

  return (
    <div
      ref={ref}
      role="menu"
      style={{
        position: 'fixed',
        left: x, top: y,
        background: 'rgba(4,8,18,0.95)',
        border: '1px solid rgba(0,168,255,0.18)',
        borderRadius: 8,
        backdropFilter: 'blur(20px)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.6), 0 0 16px rgba(0,168,255,0.06)',
        overflow: 'hidden',
        zIndex: 200,
        minWidth: 160,
      }}
    >
      <div style={{
        padding: '7px 12px 6px',
        borderBottom: '1px solid rgba(0,168,255,0.08)',
        fontFamily: "'Rajdhani','Fira Code',monospace",
        fontSize: 9,
        letterSpacing: '0.28em',
        color: 'rgba(0,168,255,0.45)',
        textTransform: 'uppercase',
      }}>
        JARVIS
      </div>
      {items.map(item => (
        <button
          key={item.action}
          role="menuitem"
          onClick={() => { onAction(item.action); onClose(); }}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            width: '100%',
            padding: '9px 14px',
            background: 'none',
            border: 'none',
            color: 'rgba(224,240,255,0.8)',
            fontSize: 12,
            fontFamily: 'var(--font-mono)',
            cursor: 'pointer',
            textAlign: 'left',
            transition: 'background 0.15s',
            letterSpacing: '0.04em',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,168,255,0.08)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
        >
          <span>{item.label}</span>
          {item.key && (
            <span style={{ fontSize: 9, color: 'rgba(0,168,255,0.4)', letterSpacing: '0.1em' }}>
              [{item.key}]
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

export default function HomePage() {
  const [voiceOrbState, setVoiceOrbState] = useState<OrbState>('idle');
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const widgets = useWidgetManager();

  const handleWidgetCommand = useCallback(
    (cmd: { action: 'show' | 'hide' | 'toggle'; widget: WidgetId }) => {
      if (cmd.action === 'show') widgets.show(cmd.widget);
      else if (cmd.action === 'hide') widgets.hide(cmd.widget);
      else widgets.toggle(cmd.widget);
    },
    [widgets]
  );

  const {
    messages, connected, isProcessing,
    orbState: wsOrbState, serverStatus, sendMessage,
  } = useJarvisWebSocket({ onWidgetCommand: handleWidgetCommand });

  const { isStreaming, start: startVoice, stop: stopVoice } = useVoiceStream(
    vs => setVoiceOrbState(vs)
  );

  const orbState: OrbState = isStreaming ? voiceOrbState : wsOrbState;

  function handleMicToggle() {
    if (isStreaming) stopVoice();
    else void startVoice();
  }

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      switch (e.key.toLowerCase()) {
        case 'c': widgets.toggle('chat');      break;
        case 's': widgets.toggle('stats');    break;
        case 'm': widgets.toggle('memory');   break;
        case 'v': handleMicToggle();          break;
        case 'p': widgets.spawn('providers'); break;
        case 'escape':
          widgets.hide('chat');
          widgets.hide('stats');
          widgets.hide('memory');
          widgets.hide('settings');
          setCtxMenu(null);
          break;
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [widgets, isStreaming]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleOrbContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY });
  }

  function handleContextAction(action: string) {
    widgets.toggle(action as WidgetId);
  }

  return (
    <main
      style={{
        position: 'fixed',
        inset: 0,
        background: '#131820',
        backgroundImage: `
          linear-gradient(rgba(80,160,220,0.07) 1px, transparent 1px),
          linear-gradient(90deg, rgba(80,160,220,0.07) 1px, transparent 1px),
          linear-gradient(rgba(80,160,220,0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(80,160,220,0.03) 1px, transparent 1px)
        `,
        backgroundSize: '150px 150px, 150px 150px, 30px 30px, 30px 30px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {/* Vignette overlay */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          background:
            'radial-gradient(ellipse 80% 80% at 50% 50%, transparent 40%, rgba(0,0,0,0.55) 100%)',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />

      {/* Ambient glow behind orb */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          width: 480,
          height: 480,
          borderRadius: '50%',
          background:
            orbState === 'idle'      ? 'radial-gradient(circle, rgba(0,100,200,0.10) 0%, transparent 70%)' :
            orbState === 'listening' ? 'radial-gradient(circle, rgba(0,200,255,0.18) 0%, transparent 70%)' :
            orbState === 'thinking'  ? 'radial-gradient(circle, rgba(120,80,240,0.18) 0%, transparent 70%)' :
            orbState === 'speaking'  ? 'radial-gradient(circle, rgba(200,150,0,0.14) 0%, transparent 70%)'  :
                                       'radial-gradient(circle, rgba(200,50,50,0.12) 0%, transparent 70%)',
          transition: 'background 1.2s ease',
          pointerEvents: 'none',
          zIndex: 2,
        }}
      />

      {/* HUD corner brackets */}
      <HudCorners />

      {/* Connection dot — top-left, always subtle */}
      <div
        aria-live="polite"
        aria-label={connected ? 'JARVIS connected' : 'JARVIS disconnected'}
        style={{
          position: 'fixed',
          top: 22,
          left: 22,
          width: 5,
          height: 5,
          borderRadius: '50%',
          background: connected ? '#00ff88' : '#ff4444',
          boxShadow: connected
            ? '0 0 5px rgba(0,255,136,0.7)'
            : '0 0 5px rgba(255,68,68,0.6)',
          opacity: 0.5,
          transition: 'all 0.4s ease',
          zIndex: 10,
        }}
      />

      {/* Keyboard hint — faint, top-right */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          top: 22,
          right: 28,
          fontFamily: "'Fira Code',monospace",
          fontSize: 8,
          letterSpacing: '0.18em',
          color: 'rgba(0,168,255,0.18)',
          pointerEvents: 'none',
          zIndex: 10,
          userSelect: 'none',
          textTransform: 'uppercase',
        }}
      >
        C · S · M · V · P · ESC
      </div>

      {/* Center orb area */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 18,
          zIndex: 3,
          position: 'relative',
        }}
        onContextMenu={handleOrbContextMenu}
      >
        <OrbRing state={orbState} size={340} onClick={handleMicToggle} />

        {/* State label */}
        <p
          style={{
            fontFamily: "'Rajdhani','Fira Code',monospace",
            fontSize: 9,
            letterSpacing: '0.42em',
            textTransform: 'uppercase',
            color: 'rgba(0,168,255,0.22)',
            userSelect: 'none',
            opacity: orbState === 'idle' ? 1 : 0,
            transition: 'opacity 1.2s ease',
            marginTop: -4,
          }}
          aria-hidden="true"
        >
          Awaiting command
        </p>
        {orbState !== 'idle' && (
          <p
            style={{
              position: 'absolute',
              bottom: -24,
              fontFamily: "'Rajdhani','Fira Code',monospace",
              fontSize: 9,
              letterSpacing: '0.38em',
              textTransform: 'uppercase',
              color: 'rgba(0,168,255,0.45)',
              userSelect: 'none',
              animation: 'fadeInUp 0.3s ease',
            }}
            aria-live="polite"
          >
            {orbState === 'listening' ? 'Listening...'  :
             orbState === 'thinking'  ? 'Processing...' :
             orbState === 'speaking'  ? 'Speaking...'   : 'Error'}
          </p>
        )}
      </div>

      {/* Right-click context menu */}
      {ctxMenu && (
        <OrbContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          onClose={() => setCtxMenu(null)}
          onAction={handleContextAction}
        />
      )}

      {/* Auto-hide bottom dock */}
      <BottomDock
        onToggleWidget={widgets.toggle}
        activeWidgets={widgets.visibility}
        isMicOn={isStreaming}
        onToggleMic={handleMicToggle}
        onSpawn={widgets.spawn}
      />

      {/* Floating draggable widgets */}
      {widgets.visibility.chat && (
        <DraggableWidget id="chat"
          defaultX={typeof window !== 'undefined' ? window.innerWidth / 2 - 240 : 200}
          defaultY={typeof window !== 'undefined' ? window.innerHeight - 520 : 200}
        >
          <ChatWidget
            messages={messages}
            onSend={sendMessage}
            onClose={() => widgets.hide('chat')}
            isProcessing={isProcessing}
          />
        </DraggableWidget>
      )}
      {widgets.visibility.stats && (
        <DraggableWidget id="stats" defaultX={24} defaultY={24}>
          <StatsWidget
            serverStatus={serverStatus}
            connected={connected}
            onClose={() => widgets.hide('stats')}
          />
        </DraggableWidget>
      )}
      {widgets.visibility.memory && (
        <DraggableWidget id="memory"
          defaultX={typeof window !== 'undefined' ? window.innerWidth / 2 - 200 : 200}
          defaultY={typeof window !== 'undefined' ? window.innerHeight / 2 - 160 : 200}
        >
          <MemoryWidget onClose={() => widgets.hide('memory')} />
        </DraggableWidget>
      )}
      {widgets.visibility.settings && (
        <DraggableWidget id="settings"
          defaultX={typeof window !== 'undefined' ? window.innerWidth / 2 - 180 : 200}
          defaultY={typeof window !== 'undefined' ? window.innerHeight / 2 - 200 : 200}
        >
          <SettingsWidget onClose={() => widgets.hide('settings')} />
        </DraggableWidget>
      )}

      {/* Spawned widget instances */}
      {widgets.spawned.map((w, i) => {
        const offset = i * 24;
        const dx = (typeof window !== 'undefined' ? window.innerWidth  / 2 - 110 : 300) + offset;
        const dy = (typeof window !== 'undefined' ? window.innerHeight / 2 - 120 : 200) + offset;
        const inner =
          w.type === 'clock'   ? <ClockWidget   onClose={() => widgets.despawn(w.instanceId)} /> :
          w.type === 'notes'   ? <NotesWidget   onClose={() => widgets.despawn(w.instanceId)} /> :
          w.type === 'sysmon'  ? <SysMonWidget  onClose={() => widgets.despawn(w.instanceId)} /> :
          w.type === 'graph'   ? <GraphWidget   onClose={() => widgets.despawn(w.instanceId)} /> :
          w.type === 'webview' ? <WebViewWidget onClose={() => widgets.despawn(w.instanceId)} /> :
          w.type === 'logs'    ? <LogsWidget    onClose={() => widgets.despawn(w.instanceId)} /> :
          w.type === 'media'     ? <MediaWidget     onClose={() => widgets.despawn(w.instanceId)} /> :
          w.type === 'providers'   ? <ProvidersWidget /> :
          w.type === 'selfupdate'  ? <SelfUpdateWidget /> :
          null;
        if (!inner) return null;
        return (
          <DraggableWidget key={w.instanceId} id={w.instanceId} defaultX={dx} defaultY={dy}>
            {inner}
          </DraggableWidget>
        );
      })}
    </main>
  );
}
