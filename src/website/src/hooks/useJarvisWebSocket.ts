'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { ChatMessage, OrbState, ServerStatus } from '@/lib/types';
import { WidgetId } from '@/hooks/useWidgetManager';

const GW_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || 'ws://localhost:8080';
const GW_TOKEN = process.env.NEXT_PUBLIC_GATEWAY_TOKEN || 'dev-token';

let audioCtxRef: AudioContext | null = null;

export function unlockAudio() {
  if (!audioCtxRef || audioCtxRef.state === 'closed') {
    audioCtxRef = new AudioContext();
  }
  if (audioCtxRef.state === 'suspended') {
    audioCtxRef.resume();
  }
}

type WidgetAction = 'show' | 'hide' | 'toggle';

interface WidgetCommand {
  action: WidgetAction;
  widget: WidgetId;
}

interface UseJarvisWebSocketOptions {
  onWidgetCommand?: (cmd: WidgetCommand) => void;
}

export function useJarvisWebSocket(options?: UseJarvisWebSocketOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [connected, setConnected] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [orbState, setOrbState] = useState<OrbState>('idle');
  const [serverStatus, setServerStatus] = useState<ServerStatus>({ connected: false });

  const wsRef = useRef<WebSocket | null>(null);
  const pendingRef = useRef<Map<string, (msg: ChatMessage) => void>>(new Map());
  const retriesRef = useRef(0);
  const onWidgetCommandRef = useRef(options?.onWidgetCommand);

  useEffect(() => {
    onWidgetCommandRef.current = options?.onWidgetCommand;
  }, [options?.onWidgetCommand]);

  const VALID_WIDGETS: ReadonlySet<string> = new Set(['chat', 'stats', 'memory', 'settings']);
  const VALID_ACTIONS: ReadonlySet<string> = new Set(['show', 'hide', 'toggle']);

  const connect = useCallback(() => {
    const url = `${GW_URL}/ws?token=${GW_TOKEN}`;
    console.log('[jarvis] connecting to', `${GW_URL}/ws`);
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[jarvis] WebSocket connected');
      setConnected(true);
      setOrbState('idle');
      setServerStatus(s => ({ ...s, connected: true }));
      retriesRef.current = 0;
    };

    ws.onclose = (e) => {
      console.warn('[jarvis] WebSocket closed', e.code, e.reason);
      setConnected(false);
      setOrbState('error');
      setServerStatus(s => ({ ...s, connected: false }));
      if (retriesRef.current < 5) {
        retriesRef.current++;
        console.log(`[jarvis] retry ${retriesRef.current}/5 in ${2000 * retriesRef.current}ms`);
        setTimeout(connect, 2000 * retriesRef.current);
      }
    };

    ws.onerror = (e) => { console.error('[jarvis] WebSocket error', e); setOrbState('error'); };

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data as string) as Record<string, unknown>;

        // Widget control messages
        if (
          data.type === 'widget' &&
          typeof data.action === 'string' &&
          typeof data.widget === 'string' &&
          VALID_ACTIONS.has(data.action) &&
          VALID_WIDGETS.has(data.widget)
        ) {
          onWidgetCommandRef.current?.({
            action: data.action as WidgetAction,
            widget: data.widget as WidgetId,
          });
          return;
        }

        // Chat reply messages
        if (typeof data.id === 'string') {
          const resolve = pendingRef.current.get(data.id);
          if (resolve) {
            pendingRef.current.delete(data.id);
            const content =
              typeof data.error === 'string'
                ? `Error: ${data.error}`
                : typeof data.result === 'string'
                ? data.result
                : '';
            const reply: ChatMessage = {
              id: data.id + '-reply',
              role: 'assistant',
              content,
              timestamp: Date.now(),
            };
            resolve(reply);
          }
        }
      } catch { /* ignore malformed frames */ }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    connect();
    return () => wsRef.current?.close();
  }, [connect]);

  const sendMessage = useCallback((text: string) => {
    if (!text.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    const id = crypto.randomUUID();
    const userMsg: ChatMessage = { id, role: 'user', content: text.trim(), timestamp: Date.now() };

    setMessages(prev => [...prev, userMsg]);
    setIsProcessing(true);
    setOrbState('thinking');

    new Promise<ChatMessage>((resolve) => {
      pendingRef.current.set(id, resolve);
      wsRef.current!.send(JSON.stringify({ id, input: text.trim() }));
    }).then((reply) => {
      setMessages(prev => [...prev, reply]);
      setIsProcessing(false);
      setOrbState('idle');
    });
  }, []);

  const clearMessages = useCallback(() => setMessages([]), []);

  return { messages, connected, isProcessing, orbState, serverStatus, sendMessage, clearMessages, wsRef };
}
