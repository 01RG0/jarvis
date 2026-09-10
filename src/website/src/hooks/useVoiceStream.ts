'use client';

import { useRef, useState, useCallback } from 'react';

const GW_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || 'ws://localhost:8080';
const GW_TOKEN = process.env.NEXT_PUBLIC_GATEWAY_TOKEN || 'dev-token';

export function useVoiceStream(onOrbState?: (state: 'listening' | 'speaking' | 'idle') => void) {
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const voiceWsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const start = useCallback(async () => {
    if (isStreaming) return;
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const ws = new WebSocket(`${GW_URL}/voice?token=${GW_TOKEN}`);
      voiceWsRef.current = ws;
      ws.binaryType = 'arraybuffer';

      ws.onopen = () => {
        setIsStreaming(true);
        onOrbState?.('listening');
        const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
        mediaRecorderRef.current = recorder;
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) ws.send(e.data);
        };
        recorder.start(100);
      };

      ws.onmessage = async (e) => {
        if (!(e.data instanceof ArrayBuffer) || e.data.byteLength === 0) return;
        try {
          if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
            audioCtxRef.current = new AudioContext({ sampleRate: 24000 });
          }
          const ctx = audioCtxRef.current;
          if (ctx.state === 'suspended') await ctx.resume();
          onOrbState?.('speaking');
          const decoded = await ctx.decodeAudioData(e.data.slice(0));
          const src = ctx.createBufferSource();
          src.buffer = decoded;
          src.connect(ctx.destination);
          src.start();
          src.onended = () => onOrbState?.('listening');
        } catch { /* non-audio frame */ }
      };

      ws.onclose = () => {
        setIsStreaming(false);
        onOrbState?.('idle');
        stream.getTracks().forEach(t => t.stop());
      };

      ws.onerror = () => setError('Voice connection failed');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Microphone access denied');
    }
  }, [isStreaming, onOrbState]);

  const stop = useCallback(() => {
    mediaRecorderRef.current?.stop();
    voiceWsRef.current?.close();
    streamRef.current?.getTracks().forEach(t => t.stop());
    setIsStreaming(false);
    onOrbState?.('idle');
  }, [onOrbState]);

  const isSupported = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

  return { isStreaming, error, start, stop, isSupported };
}
