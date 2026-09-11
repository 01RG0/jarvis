'use client';

import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface Stats {
  cpu: number;
  ram: number;
  ram_used_gb: number;
  disk: number;
  net_sent_kb: number;
  net_recv_kb: number;
}

interface SysStat { label: string; value: number; max: number; unit: string; color: string }

function toRows(s: Stats): SysStat[] {
  return [
    { label: 'CPU',   value: s.cpu,          max: 100, unit: '%',  color: '#00a8ff' },
    { label: 'RAM',   value: s.ram,          max: 100, unit: '%',  color: '#a855f7' },
    { label: 'DISK',  value: s.disk,         max: 100, unit: '%',  color: '#fbbf24' },
    { label: 'NET ↑', value: s.net_sent_kb,  max: 1024, unit: 'KB', color: '#00ff88' },
    { label: 'NET ↓', value: s.net_recv_kb,  max: 1024, unit: 'KB', color: '#00e5ff' },
  ];
}

function getBrainWsBase(): string {
  if (process.env.NEXT_PUBLIC_BRAIN_URL) return process.env.NEXT_PUBLIC_BRAIN_URL.replace(/^http/, 'ws');
  if (typeof window !== 'undefined') {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}`;
  }
  return 'ws://localhost:8001';
}
const WS_URL = `${getBrainWsBase()}/ws/stats`;

export default function SysMonWidget({ onClose }: { onClose: () => void }) {
  const [stats, setStats] = useState<SysStat[] | null>(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let dead = false;

    function connect() {
      if (dead) return;
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => setConnected(true);

      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data) as Stats;
          setStats(toRows(data));
        } catch { /* ignore malformed */ }
      };

      ws.onclose = () => {
        setConnected(false);
        if (!dead) retryRef.current = setTimeout(connect, 3000);
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

  const rows = stats ?? [
    { label: 'CPU',   value: 0, max: 100,  unit: '%',  color: '#00a8ff' },
    { label: 'RAM',   value: 0, max: 100,  unit: '%',  color: '#a855f7' },
    { label: 'DISK',  value: 0, max: 100,  unit: '%',  color: '#fbbf24' },
    { label: 'NET ↑', value: 0, max: 1024, unit: 'KB', color: '#00ff88' },
    { label: 'NET ↓', value: 0, max: 1024, unit: 'KB', color: '#00e5ff' },
  ];

  return (
    <div style={{
      background: 'rgba(6,10,18,0.93)',
      border: '1px solid rgba(0,168,255,0.15)',
      borderRadius: 10, backdropFilter: 'blur(24px)',
      boxShadow: '0 8px 40px rgba(0,0,0,0.6), 0 0 20px rgba(0,168,255,0.06)',
      width: 220, overflow: 'hidden',
      animation: 'fadeInUp 0.2s ease',
    }}>
      <div data-drag-handle="true" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '9px 14px', borderBottom: '1px solid rgba(0,168,255,0.08)',
        cursor: 'grab',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            fontFamily: "'Rajdhani','Fira Code',monospace", fontSize: 9,
            letterSpacing: '0.28em', textTransform: 'uppercase',
            color: 'rgba(0,168,255,0.45)',
          }}>SYSTEM</span>
          <div style={{
            width: 5, height: 5, borderRadius: '50%',
            background: connected ? '#00ff88' : '#fbbf24',
            boxShadow: connected ? '0 0 4px #00ff8880' : '0 0 4px #fbbf2480',
          }} />
        </div>
        <button onClick={onClose} aria-label="Close" style={{
          background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)',
          cursor: 'pointer', padding: 3, display: 'flex',
        }}><X size={13} /></button>
      </div>

      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {!connected && !stats && (
          <span style={{ fontFamily: 'monospace', fontSize: 9, color: 'rgba(251,191,36,0.5)', letterSpacing: '0.1em' }}>
            CONNECTING...
          </span>
        )}
        {rows.map(s => (
          <div key={s.label}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', marginBottom: 4,
              fontFamily: "'Fira Code',monospace", fontSize: 10,
            }}>
              <span style={{ color: 'rgba(255,255,255,0.4)', letterSpacing: '0.1em' }}>{s.label}</span>
              <span style={{ color: s.color, fontWeight: 600 }}>
                {Math.round(s.value)}{s.unit}
              </span>
            </div>
            <div style={{
              height: 3, borderRadius: 2,
              background: 'rgba(255,255,255,0.05)', overflow: 'hidden',
            }}>
              <div style={{
                height: '100%', borderRadius: 2,
                width: `${Math.min(100, (s.value / s.max) * 100)}%`,
                background: s.color,
                opacity: 0.75,
                boxShadow: `0 0 6px ${s.color}60`,
                transition: 'width 1.5s ease',
              }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
