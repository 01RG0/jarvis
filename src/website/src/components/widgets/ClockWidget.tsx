'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

export default function ClockWidget({ onClose }: { onClose: () => void }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const hh  = String(now.getHours()).padStart(2, '0');
  const mm  = String(now.getMinutes()).padStart(2, '0');
  const ss  = String(now.getSeconds()).padStart(2, '0');
  const day = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' });

  return (
    <div style={{
      background: 'rgba(6,10,18,0.93)',
      border: '1px solid rgba(0,168,255,0.15)',
      borderRadius: 10, backdropFilter: 'blur(24px)',
      boxShadow: '0 8px 40px rgba(0,0,0,0.6), 0 0 20px rgba(0,168,255,0.06)',
      minWidth: 220, overflow: 'hidden',
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
        }}>CLOCK</span>
        <button onClick={onClose} aria-label="Close" style={{
          background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)',
          cursor: 'pointer', padding: 3, display: 'flex',
        }}><X size={13} /></button>
      </div>

      <div style={{ padding: '18px 20px', textAlign: 'center' }}>
        {/* Time */}
        <div style={{
          fontFamily: "'Orbitron','Rajdhani',monospace",
          fontSize: 38, fontWeight: 700, letterSpacing: '0.06em',
          color: '#e0f0ff',
          textShadow: '0 0 20px rgba(0,168,255,0.5)',
          lineHeight: 1,
        }}>
          {hh}<span style={{ opacity: 0.4, animation: 'colonBlink 1s step-end infinite' }}>:</span>{mm}
          <span style={{ fontSize: 22, opacity: 0.55, marginLeft: 4 }}>{ss}</span>
        </div>

        {/* Date */}
        <div style={{
          marginTop: 10, fontFamily: "'Rajdhani','Fira Code',monospace",
          fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase',
          color: 'rgba(0,168,255,0.4)',
        }}>
          {day}
        </div>

        {/* Progress bar for seconds */}
        <div style={{
          marginTop: 14, height: 2, borderRadius: 1,
          background: 'rgba(255,255,255,0.06)',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%', borderRadius: 1,
            width: `${(now.getSeconds() / 60) * 100}%`,
            background: 'linear-gradient(90deg, rgba(0,168,255,0.4), rgba(0,168,255,0.8))',
            transition: 'width 1s linear',
            boxShadow: '0 0 6px rgba(0,168,255,0.5)',
          }} />
        </div>
      </div>
    </div>
  );
}
