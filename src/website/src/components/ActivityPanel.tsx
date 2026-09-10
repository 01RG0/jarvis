'use client';

import { useRef, useEffect, useState } from 'react';
import { ChatMessage, ServerStatus } from '@/lib/types';

const API_URL = (process.env.NEXT_PUBLIC_GATEWAY_URL || 'ws://localhost:8080')
  .replace(/^ws/, 'http');

interface Props {
  messages: ChatMessage[];
  isProcessing: boolean;
  connected: boolean;
  serverStatus: ServerStatus;
  onClear: () => void;
}

export default function ActivityPanel({ messages, isProcessing, connected, serverStatus, onClear }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [health, setHealth] = useState<Record<string, unknown>>({});

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);

  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch(`${API_URL.replace(':8080', ':8001')}/health`);
        if (r.ok) setHealth(await r.json());
      } catch { /* backend may be down */ }
    };
    load();
    const iv = setInterval(load, 15000);
    return () => clearInterval(iv);
  }, []);

  const visible = messages.filter(m => m.content);
  const uptime = (health.uptime_seconds as number) ?? 0;
  const memCount = (health.memory_entries as number) ?? 0;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Activity log */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.04] bg-jarvis-surface/60 backdrop-blur-lg flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-medium text-jarvis-text-dim/55 uppercase tracking-[0.12em]">Activity Log</span>
          {visible.length > 0 && (
            <span className="text-[9px] text-jarvis-text-dim/25 font-mono tabular-nums">{visible.length}</span>
          )}
        </div>
        <button onClick={onClear} className="jarvis-btn-ghost text-[9px] uppercase tracking-wider px-2 py-1 rounded-md">
          Clear
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-1 jarvis-scrollbar min-h-0">
        {visible.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-jarvis-text-dim/30 font-light">No activity yet.</p>
          </div>
        ) : visible.map(msg => {
          const isUser = msg.role === 'user';
          return (
            <div key={msg.id} className="animate-fade-in py-1.5">
              <div className="flex items-start gap-3">
                <div className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 text-[9px] font-semibold mt-0.5 ${
                  isUser
                    ? 'bg-jarvis-cyan/8 text-jarvis-cyan/50 border border-jarvis-cyan/10'
                    : 'bg-white/[0.03] text-jarvis-text-dim/40 border border-white/[0.05]'
                }`}>
                  {isUser ? 'U' : 'J'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] font-medium text-jarvis-text-dim/50">
                      {isUser ? 'You' : 'JARVIS'}
                    </span>
                    <span className="text-[9px] text-jarvis-text-dim/20 font-mono tabular-nums">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="text-[13px] text-jarvis-text/70 leading-relaxed whitespace-pre-wrap break-words">
                    {msg.content}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {isProcessing && (
          <div className="flex items-center gap-2.5 text-jarvis-text-dim/50 text-xs pl-9 py-2 animate-fade-in">
            <div className="typing-dots flex items-center"><span /><span /><span /></div>
            <span className="text-[10px] font-mono">Processing...</span>
          </div>
        )}
      </div>

      {/* Stats sidebar */}
      <div className="border-t border-white/[0.04] p-3 space-y-3 flex-shrink-0 bg-jarvis-surface/40 backdrop-blur-lg">
        <div className="jarvis-card !p-3">
          <div className="jarvis-card-header !mb-2">System</div>
          <div className="space-y-1.5">
            <Row label="Gateway" value={connected ? 'Online' : 'Offline'} ok={connected} />
            <Row label="Brain" value={(health.status as string) === 'ok' ? 'Online' : (Object.keys(health).length > 0 ? 'Degraded' : 'Offline')} ok={(health.status as string) === 'ok'} />
            <Row label="Uptime" value={uptime ? formatUptime(uptime) : '—'} />
            <Row label="Memory" value={memCount ? `${memCount} entries` : '—'} />
          </div>
        </div>

        <div className="jarvis-card !p-3">
          <div className="jarvis-card-header !mb-2">Session</div>
          <div className="space-y-1.5">
            <Row label="Messages" value={String(visible.length)} />
            <Row label="User" value={String(visible.filter(m => m.role === 'user').length)} />
            <Row label="JARVIS" value={String(visible.filter(m => m.role === 'assistant').length)} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] text-jarvis-text-dim/45">{label}</span>
      <span className={`text-[10px] font-mono tabular-nums ${ok === true ? 'text-jarvis-cyan/60' : ok === false ? 'text-red-400/60' : 'text-jarvis-text/55'}`}>
        {value}
      </span>
    </div>
  );
}

function formatUptime(s: number): string {
  if (s < 60) return `${Math.round(s)}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}
