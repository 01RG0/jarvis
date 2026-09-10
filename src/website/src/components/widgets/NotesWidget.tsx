'use client';

import { useState, useEffect } from 'react';
import { X, Trash2 } from 'lucide-react';

const STORAGE_KEY = 'jarvis-notes';

export default function NotesWidget({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) ?? ''; } catch { return ''; }
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, text); } catch {}
  }, [text]);

  return (
    <div style={{
      background: 'rgba(6,10,18,0.93)',
      border: '1px solid rgba(0,168,255,0.15)',
      borderRadius: 10, backdropFilter: 'blur(24px)',
      boxShadow: '0 8px 40px rgba(0,0,0,0.6), 0 0 20px rgba(0,168,255,0.06)',
      width: 280, display: 'flex', flexDirection: 'column',
      animation: 'fadeInUp 0.2s ease', overflow: 'hidden',
    }}>
      <div data-drag-handle="true" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '9px 14px', borderBottom: '1px solid rgba(0,168,255,0.08)',
        cursor: 'grab', flexShrink: 0,
      }}>
        <span style={{
          fontFamily: "'Rajdhani','Fira Code',monospace", fontSize: 9,
          letterSpacing: '0.28em', textTransform: 'uppercase',
          color: 'rgba(0,168,255,0.45)',
        }}>NOTES</span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={() => setText('')} aria-label="Clear notes" title="Clear" style={{
            background: 'none', border: 'none', color: 'rgba(255,255,255,0.2)',
            cursor: 'pointer', padding: 3, display: 'flex',
          }}><Trash2 size={12} /></button>
          <button onClick={onClose} aria-label="Close" style={{
            background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)',
            cursor: 'pointer', padding: 3, display: 'flex',
          }}><X size={13} /></button>
        </div>
      </div>

      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Type notes here..."
        aria-label="Notes"
        style={{
          flex: 1, minHeight: 140,
          background: 'transparent',
          border: 'none', outline: 'none', resize: 'none',
          color: 'rgba(224,240,255,0.85)',
          fontFamily: "'Fira Code',monospace",
          fontSize: 12, lineHeight: 1.6,
          padding: '12px 14px',
          caretColor: '#00a8ff',
        }}
      />

      <div style={{
        padding: '4px 14px 8px', textAlign: 'right',
        fontFamily: "'Fira Code',monospace", fontSize: 9,
        color: 'rgba(0,168,255,0.25)', letterSpacing: '0.1em',
        flexShrink: 0,
      }}>
        {text.length} chars · auto-saved
      </div>
    </div>
  );
}
