'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import type { ChatMessage } from '@/lib/types';

const ChatInput = dynamic(() => import('@/components/ChatInput'), { ssr: false });

interface BottomBarProps {
  isStreaming: boolean;
  onToggleVoice: () => void;
  connected: boolean;
  onSendMessage: (text: string) => void;
  isProcessing: boolean;
}

const WAVE_HEIGHTS = [3, 5, 9, 7, 12, 8, 14, 10, 6, 11, 9, 7, 13, 8, 5, 10, 12, 6, 9, 14, 8, 5, 11, 7, 4, 10, 12, 7, 9, 14];

export default function BottomBar({ isStreaming, onToggleVoice, connected, onSendMessage, isProcessing }: BottomBarProps) {
  const barsRef = useRef<(HTMLDivElement | null)[]>([]);
  const [showTextInput, setShowTextInput] = useState(false);

  useEffect(() => {
    if (!isStreaming) return;
    let timerId: ReturnType<typeof setTimeout>;
    const animate = () => {
      barsRef.current.forEach((bar) => {
        if (!bar) return;
        bar.style.height = `${2 + Math.random() * 18}px`;
      });
      timerId = setTimeout(() => requestAnimationFrame(animate), 70);
    };
    requestAnimationFrame(animate);
    return () => clearTimeout(timerId);
  }, [isStreaming]);

  const handleSend = useCallback((text: string) => {
    onSendMessage(text);
    setShowTextInput(false);
  }, [onSendMessage]);

  return (
    <>
      {/* Text input overlay — hidden by default */}
      {showTextInput && (
        <div
          className="fixed bottom-[50px] left-[192px] right-0 z-40 p-3"
          style={{
            background: 'rgba(0, 8, 20, 0.95)',
            borderTop: '1px solid rgba(0,255,255,0.15)',
            backdropFilter: 'blur(16px)',
          }}
        >
          <div className="flex items-center gap-2">
            <ChatInput
              onSubmit={handleSend}
              disabled={!connected}
              isProcessing={isProcessing}
            />
            <button
              onClick={() => setShowTextInput(false)}
              className="jarvis-btn jarvis-btn-ghost w-8 h-8 p-0 flex-shrink-0"
              aria-label="Close text input"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>
      )}

      <footer
        className="flex items-center justify-between px-4 flex-shrink-0"
        style={{
          height: '50px',
          background: 'rgba(0, 6, 16, 0.95)',
          borderTop: '1px solid rgba(0, 255, 255, 0.07)',
          backdropFilter: 'blur(20px)',
        }}
        role="contentinfo"
      >
        {/* Left: Location + Weather + Network */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(0,212,255,0.5)" strokeWidth="2" aria-hidden="true">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
            <div className="flex flex-col">
              <span className="text-[8px] font-semibold tracking-wider uppercase" style={{ color: 'rgba(120,169,198,0.5)' }}>
                Location
              </span>
              <span className="text-[10px]" style={{ color: 'rgba(224,240,255,0.6)', fontFamily: 'Fira Code, monospace' }}>
                Jarvis Server
              </span>
            </div>
          </div>

          <div className="w-px h-5" style={{ background: 'rgba(0,212,255,0.08)' }} aria-hidden="true" />

          <div className="flex items-center gap-1.5">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(0,212,255,0.5)" strokeWidth="2" aria-hidden="true">
              <path d="M12 2L8 7H3l3.5 3-1.5 5 5-3 5 3-1.5-5L17 7h-5z"/>
            </svg>
            <div className="flex flex-col">
              <span className="text-[8px] font-semibold tracking-wider uppercase" style={{ color: 'rgba(120,169,198,0.5)' }}>
                Weather
              </span>
              <span className="text-[10px]" style={{ color: 'rgba(224,240,255,0.6)', fontFamily: 'Fira Code, monospace' }}>
                28°C Overcast
              </span>
            </div>
          </div>

          <div className="w-px h-5" style={{ background: 'rgba(0,212,255,0.08)' }} aria-hidden="true" />

          <div className="flex items-center gap-1.5">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(0,212,255,0.5)" strokeWidth="2" aria-hidden="true">
              <path d="M5 12.55a11 11 0 0 1 14.08 0"/>
              <path d="M1.42 9a16 16 0 0 1 21.16 0"/>
              <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
              <circle cx="12" cy="20" r="1" fill="currentColor"/>
            </svg>
            <div className="flex flex-col">
              <span className="text-[8px] font-semibold tracking-wider uppercase" style={{ color: 'rgba(120,169,198,0.5)' }}>
                Network
              </span>
              <span className="text-[10px]" style={{ color: 'var(--jarvis-success)', fontFamily: 'Fira Code, monospace' }}>
                Excellent
              </span>
            </div>
          </div>
        </div>

        {/* Center: TALK TO JARVIS button + waveform */}
        <div className="flex items-center gap-3">
          {/* Waveform left */}
          <div
            className="flex items-center gap-[2px] h-5"
            aria-hidden="true"
          >
            {WAVE_HEIGHTS.slice(0, 15).map((h, i) => (
              <div
                key={i}
                ref={(el) => { barsRef.current[i] = el; }}
                style={{
                  width: '2px',
                  height: `${isStreaming ? h : Math.max(2, h * 0.2)}px`,
                  borderRadius: '1px',
                  background: isStreaming ? 'var(--jarvis-cyan)' : 'rgba(0,212,255,0.2)',
                  transition: isStreaming ? undefined : 'height 0.3s ease',
                  animationDelay: `${i * 0.05}s`,
                  flexShrink: 0,
                }}
              />
            ))}
          </div>

          <div className="flex flex-col items-center gap-0.5">
            <button
              onClick={onToggleVoice}
              disabled={!connected}
              className={`jarvis-btn jarvis-btn-talk rounded-lg ${isStreaming ? 'active' : ''}`}
              aria-label={isStreaming ? 'Stop voice — currently listening' : 'Start talking to JARVIS'}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                <line x1="12" y1="19" x2="12" y2="23"/>
                <line x1="8" y1="23" x2="16" y2="23"/>
              </svg>
              Talk to Jarvis
            </button>
            <span
              className="text-[9px] tracking-wide"
              style={{ color: isStreaming ? 'var(--jarvis-success)' : 'rgba(0,212,255,0.35)' }}
            >
              {isStreaming ? 'Listening...' : 'I am listening...'}
            </span>
          </div>

          {/* Waveform right */}
          <div
            className="flex items-center gap-[2px] h-5"
            aria-hidden="true"
          >
            {WAVE_HEIGHTS.slice(15).map((h, i) => (
              <div
                key={i}
                ref={(el) => { barsRef.current[i + 15] = el; }}
                style={{
                  width: '2px',
                  height: `${isStreaming ? h : Math.max(2, h * 0.2)}px`,
                  borderRadius: '1px',
                  background: isStreaming ? 'var(--jarvis-cyan)' : 'rgba(0,212,255,0.2)',
                  transition: isStreaming ? undefined : 'height 0.3s ease',
                  animationDelay: `${i * 0.05}s`,
                  flexShrink: 0,
                }}
              />
            ))}
          </div>
        </div>

        {/* Right: Text input toggle + Executive Briefing */}
        <div className="flex items-center gap-2">
          {/* Keyboard / text fallback button */}
          <button
            onClick={() => setShowTextInput(s => !s)}
            className="jarvis-btn jarvis-btn-ghost w-8 h-8 p-0"
            aria-label="Toggle text input"
            aria-expanded={showTextInput}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <rect x="2" y="4" width="20" height="16" rx="2"/>
              <path d="M8 8h.01M12 8h.01M16 8h.01M8 12h.01M12 12h.01M16 12h.01M7 16h10"/>
            </svg>
          </button>

          <button
            className="jarvis-btn jarvis-btn-primary text-[11px] flex items-center gap-2"
            style={{ letterSpacing: '0.06em' }}
            aria-label="Start executive briefing"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
            Executive Briefing
          </button>
        </div>
      </footer>
    </>
  );
}
