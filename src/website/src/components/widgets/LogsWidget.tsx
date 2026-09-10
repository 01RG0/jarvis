'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Trash2, Pause, Play } from 'lucide-react';

interface LogLine {
  id: number;
  ts: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG' | 'OK';
  msg: string;
}

let _id = 0;
function makeLog(level: string, msg: string, ts?: string): LogLine {
  return {
    id: ++_id,
    ts: ts ?? new Date().toISOString().slice(11, 23),
    level: level as LogLine['level'],
    msg,
  };
}

const levelColor: Record<LogLine['level'], string> = {
  INFO:  'rgba(0,168,255,0.7)',
  OK:    'rgba(0,255,136,0.7)',
  WARN:  'rgba(251,191,36,0.8)',
  ERROR: 'rgba(239,68,68,0.85)',
  DEBUG: 'rgba(148,163,184,0.5)',
};

const WS_URL = 'ws://localhost:8001/ws/logs';

export default function LogsWidget({ onClose }: { onClose: () => void }) {
  const [lines, setLines] = useState<LogLine[]>([
    makeLog('INFO', 'Connecting to log stream...'),
  ]);
  const [paused, setPaused]   = useState(false);
  const [filter, setFilter]   = useState('');
  const [connected, setConnected] = useState(false);
  const pausedRef  = useRef(paused);
  const bottomRef  = useRef<HTMLDivElement>(null);
  const wsRef      = useRef<WebSocket | null>(null);
  const retryRef   = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { pausedRef.current = paused; }, [paused]);

  useEffect(() => {
    let dead = false;

    function connect() {
      if (dead) return;
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        setLines(prev => [...prev, makeLog('OK', 'Log stream connected')]);
      };

      ws.onmessage = (e) => {
        if (pausedRef.current) return;
        try {
          const data = JSON.parse(e.data) as { ts: string; level: string; msg: string; logger?: string };
          const level = (['INFO','WARN','ERROR','DEBUG','OK'].includes(data.level) ? data.level : 'INFO') as LogLine['level'];
          const label = data.logger ? `[${data.logger}] ` : '';
          setLines(prev => [...prev.slice(-199), makeLog(level, label + data.msg, data.ts)]);
        } catch { /* ignore */ }
      };

      ws.onclose = () => {
        setConnected(false);
        if (!dead) {
          setLines(prev => [...prev, makeLog('WARN', 'Log stream disconnected — retrying...')]);
          retryRef.current = setTimeout(connect, 3000);
        }
      };

      ws.onerror = () => ws.close();
    }

    connect();
    return () => {
      dead = true;
      if (retryRef.current) clearTimeout(retryRef.current);
      wsRef.current?.close();
    };
  }, []);

  useEffect(() => {
    if (!paused) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines, paused]);

  const visible = lines.filter(l =>
    filter === '' ||
    l.msg.toLowerCase().includes(filter.toLowerCase()) ||
    l.level.includes(filter.toUpperCase())
  );

  return (
    <div style={{
      background: 'rgba(3,6,12,0.97)',
      border: '1px solid rgba(0,168,255,0.15)',
      borderRadius: 10, backdropFilter: 'blur(24px)',
      boxShadow: '0 8px 40px rgba(0,0,0,0.7)',
      width: 480, display: 'flex', flexDirection: 'column',
      overflow: 'hidden', animation: 'fadeInUp 0.2s ease',
    }}>
      {/* Header */}
      <div data-drag-handle="true" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '9px 14px', borderBottom: '1px solid rgba(0,168,255,0.08)',
        cursor: 'grab', gap: 8, flexShrink: 0,
      }}>
        <span style={{
          fontFamily: "'Rajdhani','Fira Code',monospace", fontSize: 9,
          letterSpacing: '0.28em', textTransform: 'uppercase',
          color: 'rgba(0,168,255,0.45)',
        }}>JARVIS LOGS</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
          <div style={{
            width: 5, height: 5, borderRadius: '50%',
            background: connected && !paused ? '#00ff88' : paused ? '#fbbf24' : '#ef4444',
            boxShadow: connected && !paused ? '0 0 4px #00ff8880' : paused ? '0 0 4px #fbbf2480' : '0 0 4px #ef444480',
            animation: connected && !paused ? 'statusPulse 1.2s ease-in-out infinite' : 'none',
          }} />
          <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}>
            {!connected ? 'OFFLINE' : paused ? 'PAUSED' : 'LIVE'}
          </span>
        </div>
        <button onClick={() => setPaused(v => !v)} aria-label={paused ? 'Resume' : 'Pause'} style={{
          background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)',
          cursor: 'pointer', padding: 3, display: 'flex',
        }}>{paused ? <Play size={12} /> : <Pause size={12} />}</button>
        <button onClick={() => setLines([])} aria-label="Clear logs" style={{
          background: 'none', border: 'none', color: 'rgba(255,255,255,0.25)',
          cursor: 'pointer', padding: 3, display: 'flex',
        }}><Trash2 size={12} /></button>
        <button onClick={onClose} aria-label="Close" style={{
          background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)',
          cursor: 'pointer', padding: 3, display: 'flex',
        }}><X size={13} /></button>
      </div>

      {/* Filter */}
      <div style={{ padding: '6px 14px', borderBottom: '1px solid rgba(0,168,255,0.06)', flexShrink: 0 }}>
        <input
          value={filter} onChange={e => setFilter(e.target.value)}
          placeholder="Filter logs..."
          style={{
            width: '100%', background: 'rgba(0,168,255,0.05)',
            border: '1px solid rgba(0,168,255,0.10)', borderRadius: 5,
            color: 'rgba(224,240,255,0.7)', fontSize: 11,
            fontFamily: 'var(--font-mono)', padding: '4px 8px', outline: 'none',
          }}
        />
      </div>

      {/* Log lines */}
      <div className="jarvis-scrollbar" style={{
        height: 240, overflowY: 'auto',
        padding: '8px 0', display: 'flex', flexDirection: 'column',
      }}>
        {visible.map(line => (
          <div key={line.id} style={{
            display: 'flex', gap: 10, padding: '1.5px 14px',
            fontFamily: "'Fira Code',monospace", fontSize: 11,
            lineHeight: 1.5,
          }}>
            <span style={{ color: 'rgba(255,255,255,0.18)', flexShrink: 0, fontSize: 10 }}>{line.ts}</span>
            <span style={{
              color: levelColor[line.level], flexShrink: 0,
              fontSize: 9, letterSpacing: '0.08em', paddingTop: 1,
              minWidth: 40, textAlign: 'right',
            }}>{line.level}</span>
            <span style={{ color: 'rgba(200,220,240,0.75)', wordBreak: 'break-all' }}>{line.msg}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div style={{
        padding: '4px 14px 7px', textAlign: 'right',
        fontFamily: 'monospace', fontSize: 8,
        color: 'rgba(0,168,255,0.22)', letterSpacing: '0.1em', flexShrink: 0,
      }}>
        {lines.length} lines · {visible.length} shown
      </div>
    </div>
  );
}
