'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { OrbState, ChatMessage } from '@/lib/types';

const ArcReactor = dynamic(() => import('./ArcReactor').then(m => m.ArcReactor ?? m.default), { ssr: false });
const BootScreen = dynamic(() => import('./BootScreen').then(m => m.BootScreen ?? m.default), { ssr: false });

const BOOT_MS = 4500;
const CROSSFADE_MS = 1500;

const stateLabel: Record<OrbState, string> = {
  idle: 'Standing By', listening: 'Listening',
  thinking: 'Processing', speaking: 'Speaking', error: 'Connection Error',
};

const stateColor: Record<OrbState, string> = {
  idle: 'text-jarvis-cyan/40', listening: 'text-jarvis-cyan/70',
  thinking: 'text-jarvis-gold/60', speaking: 'text-jarvis-gold/70', error: 'text-red-400/60',
};

interface Props {
  orbState: OrbState;
  messages: ChatMessage[];
  isProcessing: boolean;
  amplitude?: number;
  isVoiceStreaming: boolean;
  onToggleVoice: () => void;
  voiceSupported: boolean;
  voiceError: string | null;
}

export default function CinematicView({
  orbState, messages, isProcessing, amplitude = 0,
  isVoiceStreaming, onToggleVoice, voiceSupported, voiceError,
}: Props) {
  const [bootElapsed, setBootElapsed] = useState(0);
  const bootStartRef = useRef(Date.now());
  const [showTranscript, setShowTranscript] = useState(true);
  const [transcriptOpacity, setTranscriptOpacity] = useState(1);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let raf: number;
    const tick = () => {
      const elapsed = Date.now() - bootStartRef.current;
      setBootElapsed(elapsed);
      if (elapsed < BOOT_MS + CROSSFADE_MS + 500) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const latestAssistant = [...messages].reverse().find(m => m.role === 'assistant' && m.content);

  useEffect(() => {
    if (!latestAssistant) return;
    setTranscriptOpacity(1);
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    fadeTimerRef.current = setTimeout(() => setTranscriptOpacity(0), 8000);
    return () => { if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current); };
  }, [latestAssistant]);

  const bootProgress = bootElapsed < BOOT_MS
    ? bootElapsed / BOOT_MS
    : 1.0 + (bootElapsed - BOOT_MS) / CROSSFADE_MS;

  const showBoot = bootElapsed < BOOT_MS + CROSSFADE_MS;
  const showActive = bootElapsed > BOOT_MS - CROSSFADE_MS;
  const activeTransition = !showActive ? 0 : Math.min(1, (bootElapsed - (BOOT_MS - CROSSFADE_MS)) / CROSSFADE_MS);

  return (
    <div
      className="relative overflow-hidden bg-black flex-1"
      style={{
        background: 'radial-gradient(circle at 50% 52%, rgba(0,86,112,0.34) 0%, rgba(0,26,48,0.24) 36%, rgba(0,0,0,1) 76%)',
      }}
    >
      {showBoot && (
        <div className="absolute inset-0" style={{ zIndex: 2 }}>
          <BootScreen progress={bootProgress} />
        </div>
      )}

      {showActive && (
        <div className="absolute inset-0" style={{ zIndex: 1, opacity: activeTransition }}>
          <ArcReactor state={orbState} transitionIn={activeTransition} audioAmplitude={amplitude} />
        </div>
      )}

      {/* Scanline overlay */}
      <div className="absolute inset-0 pointer-events-none" style={{
        zIndex: 10, opacity: 0.02,
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,190,255,0.08) 2px, rgba(0,190,255,0.08) 3px)',
        backgroundSize: '100% 4px',
      }} />
      {/* Vignette */}
      <div className="absolute inset-0 pointer-events-none" style={{
        zIndex: 10,
        background: 'radial-gradient(ellipse at center, transparent 42%, rgba(0,0,0,0.42) 100%)',
      }} />
      {/* Top fade */}
      <div className="absolute inset-x-0 top-0 h-24 pointer-events-none" style={{
        zIndex: 10,
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.42) 0%, transparent 100%)',
      }} />

      {/* State label top-right */}
      {!showBoot && (
        <div className="absolute top-4 right-5 flex items-center gap-2.5" style={{ zIndex: 20 }}>
          <div className={`w-1.5 h-1.5 rounded-full ${
            orbState === 'idle' ? 'bg-jarvis-cyan/30' :
            orbState === 'listening' ? 'bg-jarvis-cyan/60 animate-pulse' :
            orbState === 'thinking' ? 'bg-jarvis-gold/50 animate-pulse' :
            orbState === 'speaking' ? 'bg-jarvis-gold/60' : 'bg-red-400/50'
          }`} />
          <span className={`text-[9px] font-mono uppercase tracking-[0.2em] ${stateColor[orbState]} transition-colors duration-500`}>
            {stateLabel[orbState]}
          </span>
          {isProcessing && (
            <div className="typing-dots flex items-center scale-75"><span /><span /><span /></div>
          )}
        </div>
      )}

      {/* Transcript toggle */}
      {!showBoot && (
        <button
          onClick={() => setShowTranscript(v => !v)}
          className={`absolute bottom-6 right-5 w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300 border ${
            showTranscript
              ? 'bg-jarvis-cyan/6 border-jarvis-cyan/12 text-jarvis-cyan/50'
              : 'bg-white/[0.02] border-white/[0.04] text-jarvis-text-dim/20 hover:text-jarvis-text-dim/40'
          }`}
          style={{ zIndex: 20 }}
          title={showTranscript ? 'Hide transcript' : 'Show transcript'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      )}

      {/* Transcript overlay */}
      {!showBoot && showTranscript && latestAssistant && (
        <div
          className="absolute bottom-20 left-1/2 -translate-x-1/2 max-w-[70%] pointer-events-none"
          style={{ zIndex: 20, opacity: transcriptOpacity, transition: 'opacity 1.5s ease-out' }}
        >
          <div className="jarvis-glass-subtle text-center px-5 py-3 rounded-2xl">
            <div className="text-xs leading-relaxed text-jarvis-text/50">
              {latestAssistant.content.length > 200
                ? latestAssistant.content.slice(0, 200) + '...'
                : latestAssistant.content}
            </div>
          </div>
        </div>
      )}

      {/* Voice button */}
      {!showBoot && voiceSupported && (
        <div className="absolute bottom-7 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2.5" style={{ zIndex: 25 }}>
          {voiceError && (
            <div className="jarvis-glass-subtle px-3 py-1.5 rounded-xl">
              <p className="text-[9px] text-red-400/70">{voiceError}</p>
            </div>
          )}
          {isVoiceStreaming && (
            <span className="text-[9px] font-mono uppercase tracking-[0.15em] text-jarvis-cyan/50 animate-fade-in">
              Voice Active
            </span>
          )}
          <button
            onClick={onToggleVoice}
            className={`relative w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 border-2 backdrop-blur-md ${
              isVoiceStreaming
                ? 'bg-red-500/12 border-red-400/40 text-red-400 shadow-[0_0_24px_rgba(239,68,68,0.2)] mic-ring-pulse'
                : 'bg-white/[0.03] border-white/[0.08] text-jarvis-text-dim/40 hover:text-jarvis-cyan hover:border-jarvis-cyan/30 hover:bg-jarvis-cyan/5 hover:shadow-[0_0_20px_rgba(0,190,255,0.12)]'
            } active:scale-95`}
            title={isVoiceStreaming ? 'Stop voice' : 'Start voice'}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
