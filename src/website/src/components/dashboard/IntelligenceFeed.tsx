'use client';

import { useState, useEffect, useRef } from 'react';
import type { ChatMessage } from '@/lib/types';

interface IntelligenceFeedProps {
  messages: ChatMessage[];
}

type FeedBadge = 'info' | 'warn' | 'tip' | 'live';

interface FeedItem {
  id: string;
  badge: FeedBadge;
  title: string;
  subtitle: string;
  ts: number;
}

const INITIAL_FEED: FeedItem[] = [
  { id: '1', badge: 'info', title: 'Design review with the product team', subtitle: 'Meeting', ts: Date.now() - 120000 },
  { id: '2', badge: 'warn', title: '2 tasks are overdue — "Polish voice..."', subtitle: 'Overdue', ts: Date.now() - 240000 },
  { id: '3', badge: 'tip',  title: '3 pull requests awaiting your review', subtitle: 'GitHub', ts: Date.now() - 360000 },
  { id: '4', badge: 'tip',  title: 'Your deep-work block is 2–4 PM. Noti...', subtitle: 'Focus', ts: Date.now() - 480000 },
  { id: '5', badge: 'live', title: 'CPU usage at 15%', subtitle: 'System load nominal', ts: Date.now() - 600000 },
  { id: '6', badge: 'warn', title: '2 tasks overdue', subtitle: 'Review the board and reschedule...', ts: Date.now() - 720000 },
];

const BADGE_STYLES: Record<FeedBadge, string> = {
  info: 'badge badge-info',
  warn: 'badge badge-warn',
  tip:  'badge badge-tip',
  live: 'badge badge-live',
};

const ITEM_ICONS: Record<FeedBadge, string> = {
  info: '📋',
  warn: '⚠',
  tip:  '💡',
  live: '📊',
};

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

export default function IntelligenceFeed({ messages }: IntelligenceFeedProps) {
  const [feed, setFeed] = useState<FeedItem[]>(INITIAL_FEED);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Add new messages from WS as feed items
  useEffect(() => {
    if (messages.length === 0) return;
    const last = messages[messages.length - 1];
    if (last.role === 'assistant' && last.content) {
      setFeed(prev => {
        const newItem: FeedItem = {
          id: last.id,
          badge: 'info',
          title: last.content.slice(0, 60) + (last.content.length > 60 ? '...' : ''),
          subtitle: 'JARVIS Response',
          ts: last.timestamp,
        };
        return [newItem, ...prev].slice(0, 20);
      });
    }
  }, [messages]);

  // Auto-scroll to top when new items arrive
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [feed]);

  return (
    <div className="dashboard-panel flex flex-col" role="region" aria-label="Live Intelligence Feed">
      <div className="panel-header">
        <span>Live Intelligence Feed</span>
        <div className="flex items-center gap-1.5">
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{
              background: 'var(--jarvis-error)',
              boxShadow: '0 0 4px rgba(255,68,68,0.8)',
              animation: 'statusPulse 1s ease-in-out infinite',
            }}
            aria-hidden="true"
          />
          <span className="text-[9px] font-bold tracking-widest" style={{ color: 'var(--jarvis-error)' }}>
            LIVE
          </span>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto jarvis-scrollbar p-2 space-y-1.5"
        role="log"
        aria-live="polite"
        aria-label="Intelligence feed items"
      >
        {feed.map((item, i) => (
          <div
            key={item.id}
            className="flex gap-2.5 px-2.5 py-2 rounded animate-fade-in"
            style={{
              background: 'rgba(0, 14, 32, 0.5)',
              border: '1px solid rgba(0, 212, 255, 0.06)',
              animationDelay: `${i * 0.05}s`,
              transition: 'border-color 0.2s',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(0,212,255,0.12)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(0,212,255,0.06)'; }}
          >
            {/* Icon */}
            <div
              className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0 text-xs"
              style={{ background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.1)' }}
              aria-hidden="true"
            >
              {ITEM_ICONS[item.badge]}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="text-[11px] text-jarvis-text/85 leading-snug truncate">{item.title}</div>
              <div className="flex items-center justify-between mt-0.5 gap-2">
                <span className="text-[9px] text-jarvis-text-dim/50 truncate">{item.subtitle}</span>
                <span className="text-[9px] text-jarvis-text-dim/35 flex-shrink-0">{timeAgo(item.ts)}</span>
              </div>
            </div>

            {/* Badge */}
            <span className={`${BADGE_STYLES[item.badge]} flex-shrink-0 self-start`} aria-label={`${item.badge} notification`}>
              {item.badge.toUpperCase()}
            </span>
          </div>
        ))}
      </div>

      <div className="px-3 py-2 border-t border-jarvis-cyan/[0.05]">
        <button
          className="text-[10px] font-medium tracking-wide"
          style={{ color: 'var(--jarvis-cyan)', opacity: 0.7 }}
        >
          View All Intelligence ›
        </button>
      </div>
    </div>
  );
}
