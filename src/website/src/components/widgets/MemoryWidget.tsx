'use client';

import { useState, useEffect } from 'react';
import { X, Brain, RefreshCw } from 'lucide-react';

interface MemoryEntry {
  id: string;
  content: string;
  timestamp?: number;
}

interface MemoryWidgetProps {
  onClose: () => void;
}

function getApiBase(): string {
  if (typeof window === 'undefined') return '';
  return `${window.location.origin}/gateway`;
}

export default function MemoryWidget({ onClose }: MemoryWidgetProps) {
  const [entries, setEntries] = useState<MemoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchMemories() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${getApiBase()}/dashboard/memory`, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw = await res.json() as Record<string, unknown>[];
      const normalized = (Array.isArray(raw) ? raw : []).map(m => ({
        id: String(m.id ?? Math.random()),
        content: String(m.memory ?? m.content ?? ''),
        timestamp: typeof m.timestamp === 'number' ? m.timestamp : undefined,
      }));
      setEntries(normalized);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load memories');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void fetchMemories(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const recent = entries.slice(-8);

  return (
    <div
      role="dialog"
      aria-label="JARVIS memory"
      aria-modal="false"
      style={{
        width: 'min(400px, calc(100vw - 32px))',
        background: 'rgba(6,10,18,0.94)',
        border: '1px solid rgba(0,200,255,0.15)',
        borderRadius: 10,
        backdropFilter: 'blur(24px)',
        boxShadow: '0 8px 40px rgba(0,0,0,0.7), 0 0 20px rgba(0,200,255,0.06)',
        zIndex: 60,
        animation: 'fadeInUp 0.2s ease',
      }}
    >
      <div
        data-drag-handle="true"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 14px', borderBottom: '1px solid rgba(0,200,255,0.08)',
          cursor: 'grab',
        }}
      >
        <span style={{
          display: 'flex', alignItems: 'center', gap: 6,
          fontFamily: 'var(--font-mono)', fontSize: 10,
          letterSpacing: '0.2em', textTransform: 'uppercase',
          color: 'rgba(0,200,255,0.55)',
        }}>
          <Brain size={12} />
          MEMORY
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={() => void fetchMemories()}
            aria-label="Refresh memories"
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', padding: 4, display: 'flex' }}
          >
            <RefreshCw size={12} />
          </button>
          <button onClick={onClose} aria-label="Close memory"
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', padding: 4, display: 'flex' }}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      <div
        className="jarvis-scrollbar"
        style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto' }}
      >
        {loading && (
          <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12, textAlign: 'center', fontFamily: 'var(--font-mono)', padding: '16px 0' }}>
            Loading...
          </p>
        )}
        {!loading && error && (
          <p style={{ color: 'rgba(239,68,68,0.7)', fontSize: 12, textAlign: 'center', fontFamily: 'var(--font-mono)', padding: '16px 0' }}>
            {error}
          </p>
        )}
        {!loading && !error && recent.length === 0 && (
          <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12, textAlign: 'center', fontFamily: 'var(--font-mono)', padding: '16px 0' }}>
            No memories yet
          </p>
        )}
        {recent.map(entry => (
          <div key={entry.id} style={{
            padding: '8px 10px',
            background: 'rgba(0,200,255,0.04)',
            border: '1px solid rgba(0,200,255,0.08)',
            borderRadius: 6, fontSize: 12,
            color: 'var(--jarvis-text)', lineHeight: 1.5,
          }}>
            <p style={{ margin: 0 }}>{entry.content}</p>
            {entry.timestamp && (
              <p style={{ margin: '4px 0 0', fontSize: 10, color: 'rgba(255,255,255,0.25)', fontFamily: 'var(--font-mono)' }}>
                {new Date(entry.timestamp).toLocaleTimeString()}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
