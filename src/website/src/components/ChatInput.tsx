'use client';

import { useState, useRef, useCallback } from 'react';

interface Props {
  onSubmit: (message: string) => void;
  disabled?: boolean;
  isProcessing?: boolean;
}

export default function ChatInput({ onSubmit, disabled = false, isProcessing = false }: Props) {
  const [message, setMessage] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = useCallback(() => {
    if (!message.trim() || disabled || isProcessing) return;
    onSubmit(message.trim());
    setMessage('');
    inputRef.current?.focus();
  }, [message, disabled, isProcessing, onSubmit]);

  const isBusy = disabled || isProcessing;
  const hasMessage = message.trim().length > 0;

  return (
    <div className="w-full border-t border-white/[0.04] bg-jarvis-surface/80 backdrop-blur-xl px-4 sm:px-6 py-3 flex-shrink-0 safe-bottom">
      <div className="flex items-center gap-2.5 max-w-4xl mx-auto">
        <input
          ref={inputRef}
          type="text"
          value={message}
          onChange={e => setMessage(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
          placeholder={isProcessing ? 'Processing...' : 'Ask JARVIS anything...'}
          disabled={isBusy}
          className="jarvis-input flex-1"
          aria-label="Message input"
          autoComplete="off"
        />
        <button
          onClick={handleSubmit}
          disabled={isBusy || !hasMessage}
          className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 border
            ${hasMessage && !isBusy
              ? 'bg-jarvis-cyan/12 border-jarvis-cyan/25 text-jarvis-cyan hover:bg-jarvis-cyan/18 hover:border-jarvis-cyan/40 hover:shadow-[0_0_12px_rgba(0,212,255,0.15)]'
              : 'bg-white/[0.02] border-white/[0.05] text-jarvis-text-dim/25'
            } disabled:opacity-25 disabled:cursor-not-allowed active:scale-95`}
          aria-label="Send message"
        >
          {isProcessing ? (
            <div className="typing-dots flex items-center scale-75"><span /><span /><span /></div>
          ) : (
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={hasMessage ? 'translate-x-0.5 -translate-y-0.5 transition-transform' : 'transition-transform'}>
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
