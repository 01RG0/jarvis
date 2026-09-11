'use client';

import { useState, useEffect, useRef } from 'react';
import { X, RefreshCw } from 'lucide-react';

type Series = { label: string; color: string; values: number[] };

const SERIES_DEFS: Omit<Series, 'values'>[] = [
  { label: 'CPU %',     color: '#00a8ff' },
  { label: 'RAM %',     color: '#a855f7' },
  { label: 'Net KB/s',  color: '#00ff88' },
];

const MAX_POINTS = 60;
function getBrainWsBase(): string {
  if (process.env.NEXT_PUBLIC_BRAIN_URL) return process.env.NEXT_PUBLIC_BRAIN_URL.replace(/^http/, 'ws');
  if (typeof window !== 'undefined') {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}`;
  }
  return 'ws://localhost:8001';
}
const WS_URL = `${getBrainWsBase()}/ws/stats`;

export default function GraphWidget({ onClose }: { onClose: () => void }) {
  const [series, setSeries] = useState<Series[]>(() =>
    SERIES_DEFS.map(d => ({ ...d, values: Array(MAX_POINTS).fill(0) }))
  );
  const [active, setActive] = useState<number[]>([0, 1, 2]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const prevNetRef = useRef<number>(0);

  // Real data from brain WebSocket
  useEffect(() => {
    function connect() {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;
      ws.onmessage = (e) => {
        try {
          const d = JSON.parse(e.data);
          const sentKB = (d.net_sent_kb ?? 0);
          const netDelta = Math.max(0, sentKB - prevNetRef.current);
          prevNetRef.current = sentKB;
          const netNorm = Math.min(99, netDelta / 10); // scale KB/s to 0-99
          setSeries(prev => prev.map((s, i) => {
            const next = i === 0 ? (d.cpu ?? 0)
                       : i === 1 ? (d.ram ?? 0)
                       : netNorm;
            return { ...s, values: [...s.values.slice(1), next] };
          }));
        } catch { /* ignore parse errors */ }
      };
      ws.onclose = () => setTimeout(connect, 3000);
      ws.onerror = () => ws.close();
    }
    connect();
    return () => wsRef.current?.close();
  }, []);

  // Draw on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;

    ctx.clearRect(0, 0, W, H);

    // Grid lines
    ctx.strokeStyle = 'rgba(0,168,255,0.07)';
    ctx.lineWidth = 1;
    for (let y = 0; y <= 4; y++) {
      const yy = (y / 4) * H;
      ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(W, yy); ctx.stroke();
    }
    for (let x = 0; x <= 5; x++) {
      const xx = (x / 5) * W;
      ctx.beginPath(); ctx.moveTo(xx, 0); ctx.lineTo(xx, H); ctx.stroke();
    }

    // Draw each active series
    series.forEach((s, si) => {
      if (!active.includes(si)) return;
      const pts = s.values;
      const max = Math.max(...pts, 10);

      // Fill area
      ctx.beginPath();
      ctx.moveTo(0, H);
      pts.forEach((v, i) => {
        const x = (i / (MAX_POINTS - 1)) * W;
        const y = H - (v / max) * H * 0.9;
        if (i === 0) ctx.lineTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.lineTo(W, H);
      ctx.closePath();
      const fill = ctx.createLinearGradient(0, 0, 0, H);
      fill.addColorStop(0, s.color + '28');
      fill.addColorStop(1, s.color + '04');
      ctx.fillStyle = fill;
      ctx.fill();

      // Line
      ctx.beginPath();
      pts.forEach((v, i) => {
        const x = (i / (MAX_POINTS - 1)) * W;
        const y = H - (v / max) * H * 0.9;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 1.5;
      ctx.shadowBlur = 6;
      ctx.shadowColor = s.color;
      ctx.stroke();
      ctx.shadowBlur = 0;
    });
  }, [series, active]);

  return (
    <div style={{
      background: 'rgba(6,10,18,0.93)',
      border: '1px solid rgba(0,168,255,0.15)',
      borderRadius: 10, backdropFilter: 'blur(24px)',
      boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
      width: 340, overflow: 'hidden',
      animation: 'fadeInUp 0.2s ease',
    }}>
      <div data-drag-handle="true" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '9px 14px', borderBottom: '1px solid rgba(0,168,255,0.08)',
        cursor: 'grab',
      }}>
        <span style={{
          fontFamily: "'Rajdhani','Fira Code',monospace", fontSize: 9,
          letterSpacing: '0.28em', textTransform: 'uppercase',
          color: 'rgba(0,168,255,0.45)',
        }}>LIVE GRAPH</span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#00ff88', boxShadow: '0 0 4px #00ff8880' }} />
          <span style={{ fontSize: 8, color: 'rgba(0,255,136,0.5)', fontFamily: 'monospace', letterSpacing: '0.1em' }}>LIVE</span>
          <button onClick={onClose} aria-label="Close" style={{
            background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)',
            cursor: 'pointer', padding: 3, display: 'flex', marginLeft: 4,
          }}><X size={13} /></button>
        </div>
      </div>

      {/* Legend toggles */}
      <div style={{ display: 'flex', gap: 8, padding: '8px 14px 0' }}>
        {series.map((s, i) => (
          <button key={s.label}
            onClick={() => setActive(prev =>
              prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]
            )}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              background: active.includes(i) ? `${s.color}18` : 'rgba(255,255,255,0.03)',
              border: `1px solid ${active.includes(i) ? s.color + '40' : 'rgba(255,255,255,0.06)'}`,
              borderRadius: 4, padding: '3px 7px', cursor: 'pointer',
              fontFamily: 'var(--font-mono)', fontSize: 9,
              color: active.includes(i) ? s.color : 'rgba(255,255,255,0.3)',
              transition: 'all 0.15s',
            }}
          >
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: s.color, opacity: active.includes(i) ? 1 : 0.3 }} />
            {s.label}
          </button>
        ))}
      </div>

      {/* Canvas */}
      <div style={{ padding: '10px 14px 12px' }}>
        <canvas
          ref={canvasRef}
          width={312} height={120}
          style={{ width: '100%', height: 120, display: 'block', borderRadius: 4 }}
        />
        {/* Y-axis labels */}
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          marginTop: 4, fontFamily: 'var(--font-mono)', fontSize: 8,
          color: 'rgba(0,168,255,0.25)', letterSpacing: '0.1em',
        }}>
          <span>0</span><span>25</span><span>50</span><span>75</span><span>100</span>
        </div>
      </div>
    </div>
  );
}
