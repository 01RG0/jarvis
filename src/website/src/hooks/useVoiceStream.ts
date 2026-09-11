'use client';

import { useRef, useState, useCallback } from 'react';

const SAMPLE_RATE = 16000;

function getGatewayUrl(): string {
  if (process.env.NEXT_PUBLIC_GATEWAY_URL) return process.env.NEXT_PUBLIC_GATEWAY_URL;
  if (typeof window !== 'undefined') {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}/gateway`;
  }
  return 'ws://localhost:8080';
}

const GW_TOKEN = process.env.NEXT_PUBLIC_GATEWAY_TOKEN || 'dev-token';

export function useVoiceStream(onOrbState?: (state: 'listening' | 'speaking' | 'idle') => void) {
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wsRef        = useRef<WebSocket | null>(null);
  const audioCtxRef  = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef    = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef    = useRef<MediaStream | null>(null);

  const stop = useCallback(() => {
    processorRef.current?.disconnect();
    sourceRef.current?.disconnect();
    processorRef.current = null;
    sourceRef.current    = null;
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    wsRef.current?.close();
    wsRef.current = null;
    setIsStreaming(false);
    onOrbState?.('idle');
  }, [onOrbState]);

  const start = useCallback(async () => {
    if (isStreaming) return;
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: SAMPLE_RATE, channelCount: 1, echoCancellation: true, noiseSuppression: true },
        video: false,
      });
      streamRef.current = stream;

      const ctx = new AudioContext({ sampleRate: SAMPLE_RATE });
      audioCtxRef.current = ctx;

      const gwUrl = `${getGatewayUrl()}/voice?token=${GW_TOKEN}`;
      console.log('[voice] connecting to', gwUrl);
      const ws = new WebSocket(gwUrl);
      wsRef.current = ws;
      ws.binaryType = 'arraybuffer';

      ws.onopen = () => {
        setIsStreaming(true);
        onOrbState?.('listening');

        const src  = ctx.createMediaStreamSource(stream);
        sourceRef.current = src;
        const proc = ctx.createScriptProcessor(2048, 1, 1);
        processorRef.current = proc;
        proc.onaudioprocess = (e) => {
          if (ws.readyState !== WebSocket.OPEN) return;
          const float32 = e.inputBuffer.getChannelData(0);
          const int16   = new Int16Array(float32.length);
          for (let i = 0; i < float32.length; i++) {
            int16[i] = Math.max(-32768, Math.min(32767, Math.round(float32[i] * 32767)));
          }
          ws.send(int16.buffer);
        };
        src.connect(proc);
        proc.connect(ctx.destination);
      };

      ws.onmessage = (e) => {
        if (!(e.data instanceof ArrayBuffer) || e.data.byteLength === 0) return;
        const int16   = new Int16Array(e.data);
        const float32 = new Float32Array(int16.length);
        for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768;
        const ab  = ctx.createBuffer(1, float32.length, SAMPLE_RATE);
        ab.getChannelData(0).set(float32);
        const src = ctx.createBufferSource();
        src.buffer = ab;
        src.connect(ctx.destination);
        onOrbState?.('speaking');
        src.start();
        src.onended = () => onOrbState?.('listening');
      };

      ws.onclose = () => {
        processorRef.current?.disconnect();
        sourceRef.current?.disconnect();
        processorRef.current = null;
        sourceRef.current    = null;
        stream.getTracks().forEach(t => t.stop());
        setIsStreaming(false);
        onOrbState?.('idle');
      };

      ws.onerror = () => {
        console.error('[voice] WebSocket error');
        setError('Voice connection failed');
      };
    } catch (err) {
      console.error('[voice] start failed:', err);
      setError(err instanceof Error ? err.message : 'Microphone access denied');
    }
  }, [isStreaming, onOrbState]);

  const isSupported = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

  return { isStreaming, error, start, stop, isSupported };
}
