'use client';

import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { X, Send } from 'lucide-react';
import { ChatMessage } from '@/lib/types';

interface ChatWidgetProps {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  onClose: () => void;
  isProcessing: boolean;
}

export default function ChatWidget({
  messages,
  onSend,
  onClose,
  isProcessing,
}: ChatWidgetProps) {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function handleSend() {
    const text = input.trim();
    if (!text || isProcessing) return;
    onSend(text);
    setInput('');
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div
      role="dialog"
      aria-label="Chat with JARVIS"
      aria-modal="false"
      style={{
        width: 'min(480px, calc(100vw - 32px))',
        maxHeight: '60vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'rgba(6,10,18,0.92)',
        border: '1px solid rgba(0,200,255,0.15)',
        borderRadius: 10,
        backdropFilter: 'blur(24px)',
        boxShadow: '0 8px 40px rgba(0,0,0,0.6), 0 0 20px rgba(0,200,255,0.06)',
        zIndex: 60,
        animation: 'slideUpIn 0.2s ease',
      }}
    >
      {/* Header — drag handle */}
      <div
        data-drag-handle="true"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          borderBottom: '1px solid rgba(0,200,255,0.08)',
          flexShrink: 0,
          cursor: 'grab',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: 'rgba(0,200,255,0.55)',
          }}
        >
          JARVIS CHAT
        </span>
        <button
          onClick={onClose}
          aria-label="Close chat"
          style={{
            background: 'none',
            border: 'none',
            color: 'rgba(255,255,255,0.35)',
            cursor: 'pointer',
            padding: 4,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <X size={14} />
        </button>
      </div>

      {/* Messages */}
      <div
        className="jarvis-scrollbar"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          minHeight: 120,
        }}
      >
        {messages.length === 0 && (
          <p
            style={{
              color: 'rgba(255,255,255,0.2)',
              fontSize: 12,
              textAlign: 'center',
              margin: 'auto',
              fontFamily: 'var(--font-mono)',
            }}
          >
            Send a message to JARVIS
          </p>
        )}
        {messages.map(msg => (
          <div
            key={msg.id}
            style={{
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            <div
              style={{
                maxWidth: '80%',
                padding: '8px 12px',
                borderRadius: 8,
                fontSize: 13,
                lineHeight: 1.5,
                background:
                  msg.role === 'user'
                    ? 'rgba(0,200,255,0.12)'
                    : 'rgba(255,255,255,0.05)',
                border:
                  msg.role === 'user'
                    ? '1px solid rgba(0,200,255,0.2)'
                    : '1px solid rgba(255,255,255,0.06)',
                color:
                  msg.role === 'user'
                    ? 'var(--jarvis-text)'
                    : 'var(--jarvis-text)',
              }}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {isProcessing && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div
              className="typing-dots"
              style={{
                padding: '8px 12px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 8,
              }}
            >
              <span /><span /><span />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div
        style={{
          padding: '10px 14px',
          borderTop: '1px solid rgba(0,200,255,0.08)',
          display: 'flex',
          gap: 8,
          flexShrink: 0,
        }}
      >
        <input
          className="jarvis-input"
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message JARVIS..."
          disabled={isProcessing}
          aria-label="Type a message"
          style={{ flex: 1, fontSize: 13 }}
          autoFocus
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || isProcessing}
          aria-label="Send message"
          className="jarvis-btn jarvis-btn-primary"
          style={{ padding: '0 12px', flexShrink: 0 }}
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}
