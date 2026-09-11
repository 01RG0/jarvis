'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Mic, MicOff, Volume2 } from 'lucide-react';

function getVoiceUrl(): string {
  if (process.env.NEXT_PUBLIC_VOICE_URL) return process.env.NEXT_PUBLIC_VOICE_URL;
  if (typeof window !== 'undefined') {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}/voice-pipeline/`;
  }
  return 'wss://localhost/voice-pipeline/';
}

const MIC_SAMPLE_RATE = 16000;   // what we capture and send to STT
const TTS_SAMPLE_RATE = 24000;   // what Groq Orpheus outputs
const RECONNECT_DELAY_MS = 3000;

const VOICES = ['autumn', 'diana', 'hannah', 'austin', 'daniel', 'troy'] as const;
type VoiceName = typeof VOICES[number];

type Status = 'idle' | 'listening' | 'processing' | 'speaking' | 'error' | 'reconnecting';

interface Line {
  id: number;
  role: 'user' | 'jarvis';
  text: string;
}

let _lid = 0;

const STATUS_LABEL: Record<Status, string> = {
  idle:         'OFFLINE',
  listening:    'LISTENING',
  processing:   'PROCESSING',
  speaking:     'SPEAKING',
  error:        'ERROR',
  reconnecting: 'RECONNECTING',
};

const STATUS_COLOR: Record<Status, string> = {
  idle:         'rgba(148,163,184,0.4)',
  listening:    'rgba(0,255,136,0.9)',
  processing:   'rgba(251,191,36,0.9)',
  speaking:     'rgba(0,168,255,0.9)',
  error:        'rgba(239,68,68,0.9)',
  reconnecting: 'rgba(251,191,36,0.5)',
};

export default function VoicePage() {
  const [status, setStatus]         = useState<Status>('idle');
  const [lines, setLines]           = useState<Line[]>([]);
  const [micAllowed, setMicAllowed] = useState<boolean | null>(null);
  const [muted, setMuted]           = useState(false);
  const [voice, setVoice]           = useState<VoiceName>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('jarvis-voice') as VoiceName | null;
      if (saved && VOICES.includes(saved)) return saved;
    }
    return 'daniel';
  });

  const wsRef          = useRef<WebSocket | null>(null);
  const audioCtxRef    = useRef<AudioContext | null>(null);
  const sourceRef      = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef   = useRef<ScriptProcessorNode | null>(null);
  const streamRef      = useRef<MediaStream | null>(null);
  const bottomRef      = useRef<HTMLDivElement>(null);
  const mutedRef       = useRef(false);
  const activeRef      = useRef(false);
  const nextPlayRef    = useRef(0);          // next scheduled TTS start time (seconds)
  const reconnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const voiceRef = useRef<VoiceName>(voice);
  useEffect(() => { mutedRef.current = muted; }, [muted]);
  useEffect(() => { voiceRef.current = voice; localStorage.setItem('jarvis-voice', voice); }, [voice]);

  function addLine(role: 'user' | 'jarvis', text: string) {
    setLines(prev => [...prev.slice(-49), { id: ++_lid, role, text }]);
  }

  // ── Audio capture ─────────────────────────────────────────────────────────

  const stopAudio = useCallback(() => {
    processorRef.current?.disconnect();
    sourceRef.current?.disconnect();
    processorRef.current = null;
    sourceRef.current    = null;
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  const startAudio = useCallback(async () => {
    if (processorRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: MIC_SAMPLE_RATE, channelCount: 1, echoCancellation: true, noiseSuppression: true },
        video: false,
      });
      streamRef.current = stream;
      const ctx = audioCtxRef.current!;
      const src = ctx.createMediaStreamSource(stream);
      sourceRef.current = src;
      const proc = ctx.createScriptProcessor(2048, 1, 1);  // power-of-2; 2048 ≈ 128ms @ 16kHz
      processorRef.current = proc;
      proc.onaudioprocess = (e) => {
        if (mutedRef.current) return;
        if (wsRef.current?.readyState !== WebSocket.OPEN) return;
        const float32 = e.inputBuffer.getChannelData(0);
        const int16   = new Int16Array(float32.length);
        for (let i = 0; i < float32.length; i++) {
          int16[i] = Math.max(-32768, Math.min(32767, Math.round(float32[i] * 32767)));
        }
        wsRef.current.send(int16.buffer);
      };
      src.connect(proc);
      // Route through a muted gain node — keeps the audio graph active without echoing mic to speakers
      const sink = ctx.createGain();
      sink.gain.value = 0;
      proc.connect(sink);
      sink.connect(ctx.destination);
    } catch (err) {
      console.error('[voice] mic/audio init failed:', err);
      setStatus('error');
    }
  }, []);

  // ── WebSocket (persistent, auto-reconnects) ───────────────────────────────

  const connect = useCallback(() => {
    if (!activeRef.current) return;
    if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) return;

    const voiceUrl = getVoiceUrl();
    setStatus('reconnecting');
    console.log('[voice] connecting to', voiceUrl);
    const ws = new WebSocket(voiceUrl);
    ws.binaryType = 'arraybuffer';
    wsRef.current = ws;

    ws.onopen = () => {
      nextPlayRef.current = 0;
      setStatus('listening');
      ws.send(JSON.stringify({ type: 'config', voice: voiceRef.current }));
      startAudio();
    };

    ws.onmessage = (e) => {
      if (typeof e.data === 'string') {
        try {
          const msg = JSON.parse(e.data) as { type?: string; text?: string };
          if (msg.type === 'transcript' && msg.text) { addLine('user', msg.text); setStatus('processing'); }
          if (msg.type === 'response'   && msg.text) { addLine('jarvis', msg.text); setStatus('speaking'); }
          if (msg.type === 'done')                    { setStatus('listening'); }
        } catch { /* ignore */ }
      } else {
        playAudioChunk(e.data as ArrayBuffer);
        setStatus('speaking');
      }
    };

    ws.onclose = () => {
      stopAudio();
      if (!activeRef.current) return;
      setStatus('reconnecting');
      reconnTimerRef.current = setTimeout(connect, RECONNECT_DELAY_MS);
    };

    ws.onerror = (e) => { console.error('[voice] WS error', e); ws.close(); };
  }, [startAudio, stopAudio]);

  const disconnect = useCallback(() => {
    activeRef.current = false;
    if (reconnTimerRef.current) { clearTimeout(reconnTimerRef.current); reconnTimerRef.current = null; }
    wsRef.current?.close();
    wsRef.current = null;
    stopAudio();
    setStatus('idle');
  }, [stopAudio]);

  // ── TTS playback ──────────────────────────────────────────────────────────

  function playAudioChunk(buffer: ArrayBuffer) {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const int16   = new Int16Array(buffer);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768;
    // TTS_SAMPLE_RATE (24kHz) — must match Groq Orpheus output, not mic input rate
    const ab  = ctx.createBuffer(1, float32.length, TTS_SAMPLE_RATE);
    ab.getChannelData(0).set(float32);
    const src = ctx.createBufferSource();
    src.buffer = ab;
    src.connect(ctx.destination);
    // Schedule chunks sequentially — never let two chunks overlap or start at "now"
    const now = ctx.currentTime;
    const startAt = Math.max(nextPlayRef.current, now + 0.02);
    src.start(startAt);
    nextPlayRef.current = startAt + ab.duration;
    src.onended = () => {
      // Only transition to listening once the whole TTS response has finished
      if (nextPlayRef.current <= ctx.currentTime + 0.05) {
        nextPlayRef.current = 0;
        setStatus(s => s === 'speaking' ? 'listening' : s);
      }
    };
  }

  // ── Init / cleanup ────────────────────────────────────────────────────────

  const init = useCallback(async () => {
    try {
      // probe mic permission
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      stream.getTracks().forEach(t => t.stop());
      setMicAllowed(true);
      audioCtxRef.current = new AudioContext({ sampleRate: MIC_SAMPLE_RATE });
      activeRef.current   = true;
      connect();
    } catch (err) {
      console.error('[voice] getUserMedia failed:', err);
      setMicAllowed(false);
      setStatus('error');
    }
  }, [connect]);

  useEffect(() => {
    return () => {
      disconnect();
      audioCtxRef.current?.close();
    };
  }, [disconnect]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  const orb = STATUS_COLOR[status];
  const pulsing = status === 'listening' || status === 'speaking';

  return (
    <div style={{
      minHeight: '100vh',
      background: 'rgba(3,6,12,0.97)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Rajdhani','Fira Code',monospace",
      color: 'rgba(224,240,255,0.85)',
      gap: 32,
      padding: 24,
    }}>

      {/* Orb */}
      <div style={{ position: 'relative', width: 160, height: 160 }}>
        {pulsing && (
          <>
            <div style={{ position: 'absolute', inset: -16, borderRadius: '50%', border: `1px solid ${orb}`, opacity: 0.3, animation: 'orbPulse 1.5s ease-out infinite' }} />
            <div style={{ position: 'absolute', inset: -32, borderRadius: '50%', border: `1px solid ${orb}`, opacity: 0.15, animation: 'orbPulse 1.5s ease-out 0.4s infinite' }} />
          </>
        )}
        <div style={{
          width: 160, height: 160, borderRadius: '50%',
          background: `radial-gradient(circle at 35% 35%, ${orb}, rgba(0,40,80,0.9) 70%)`,
          boxShadow: `0 0 40px ${orb}40, 0 0 80px ${orb}20`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.4s ease',
        }}>
          {status === 'speaking'   ? <Volume2 size={36} color="rgba(255,255,255,0.8)" /> :
           status === 'listening'  ? <Mic size={36} color={muted ? 'rgba(239,68,68,0.8)' : 'rgba(255,255,255,0.9)'} /> :
           status === 'processing' ? <Mic size={36} color="rgba(251,191,36,0.9)" /> :
                                     <MicOff size={32} color="rgba(148,163,184,0.5)" />}
        </div>
      </div>

      {/* Status */}
      <div style={{ fontSize: 11, letterSpacing: '0.4em', color: orb }}>
        {muted && status === 'listening' ? 'MUTED' : STATUS_LABEL[status]}
      </div>

      {/* Voice selector — available before mic is enabled */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
        {VOICES.map(v => (
          <button
            key={v}
            onClick={() => setVoice(v)}
            style={{
              background: voice === v ? 'rgba(0,168,255,0.18)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${voice === v ? 'rgba(0,168,255,0.5)' : 'rgba(255,255,255,0.08)'}`,
              borderRadius: 6,
              color: voice === v ? 'rgba(0,168,255,0.9)' : 'rgba(148,163,184,0.5)',
              padding: '5px 12px',
              fontSize: 9,
              letterSpacing: '0.25em',
              cursor: 'pointer',
              textTransform: 'uppercase',
            }}
          >
            {v}
          </button>
        ))}
      </div>

      {/* Permission gate */}
      {micAllowed === null && (
        <button
          onClick={init}
          style={{
            background: 'rgba(0,168,255,0.1)',
            border: '1px solid rgba(0,168,255,0.3)',
            borderRadius: 8,
            color: 'rgba(0,168,255,0.9)',
            padding: '12px 28px',
            fontSize: 13,
            letterSpacing: '0.2em',
            cursor: 'pointer',
          }}
        >
          ENABLE MICROPHONE
        </button>
      )}

      {micAllowed === false && (
        <div style={{ color: 'rgba(239,68,68,0.8)', fontSize: 12, letterSpacing: '0.15em' }}>
          MICROPHONE ACCESS DENIED — CHECK BROWSER SETTINGS
        </div>
      )}

      {/* Mute / disconnect controls */}
      {micAllowed && status !== 'idle' && (
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={() => setMuted(v => !v)}
            style={{
              background: muted ? 'rgba(239,68,68,0.15)' : 'rgba(0,168,255,0.06)',
              border: `1px solid ${muted ? 'rgba(239,68,68,0.4)' : 'rgba(0,168,255,0.2)'}`,
              borderRadius: 8,
              color: muted ? 'rgba(239,68,68,0.9)' : 'rgba(0,168,255,0.5)',
              padding: '8px 20px',
              fontSize: 10,
              letterSpacing: '0.3em',
              cursor: 'pointer',
            }}
          >
            {muted ? 'UNMUTE' : 'MUTE'}
          </button>

          <button
            onClick={disconnect}
            style={{
              background: 'rgba(100,0,0,0.1)',
              border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 8,
              color: 'rgba(239,68,68,0.5)',
              padding: '8px 20px',
              fontSize: 10,
              letterSpacing: '0.3em',
              cursor: 'pointer',
            }}
          >
            DISCONNECT
          </button>
        </div>
      )}

      {/* Transcript */}
      {lines.length > 0 && (
        <div style={{
          width: '100%', maxWidth: 560,
          background: 'rgba(0,10,20,0.6)',
          border: '1px solid rgba(0,168,255,0.08)',
          borderRadius: 10,
          maxHeight: 280,
          overflowY: 'auto',
          padding: '12px 0',
        }}>
          {lines.map(l => (
            <div key={l.id} style={{ padding: '4px 16px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{
                fontSize: 9, letterSpacing: '0.2em',
                color: l.role === 'jarvis' ? 'rgba(0,168,255,0.6)' : 'rgba(0,255,136,0.5)',
                minWidth: 44, paddingTop: 2, flexShrink: 0,
              }}>
                {l.role === 'jarvis' ? 'JARVIS' : 'YOU'}
              </span>
              <span style={{ fontSize: 13, lineHeight: 1.5, color: 'rgba(200,220,240,0.8)' }}>
                {l.text}
              </span>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      )}

      {status === 'listening' && !muted && (
        <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.3)', letterSpacing: '0.2em' }}>
          ALWAYS LISTENING · SPEAK NATURALLY
        </div>
      )}

      <style>{`
        @keyframes orbPulse {
          0%   { transform: scale(1);   opacity: 0.4; }
          100% { transform: scale(1.6); opacity: 0;   }
        }
      `}</style>
    </div>
  );
}
