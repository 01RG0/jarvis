'use client';

import { useState } from 'react';
import { X, Globe, RefreshCw, ExternalLink } from 'lucide-react';

const BLOCKED_DOMAINS = [
  'google.com', 'youtube.com', 'facebook.com', 'twitter.com',
  'instagram.com', 'linkedin.com', 'github.com', 'x.com',
];

const PRESETS = [
  { label: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/Main_Page' },
  { label: 'MDN',       url: 'https://developer.mozilla.org' },
  { label: 'Docs',      url: 'https://nextjs.org/docs' },
];

function isBlocked(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    return BLOCKED_DOMAINS.some(d => hostname === d || hostname.endsWith('.' + d));
  } catch {
    return false;
  }
}

export default function WebViewWidget({ onClose }: { onClose: () => void }) {
  const [url, setUrl] = useState('https://en.wikipedia.org/wiki/Main_Page');
  const [inputVal, setInputVal] = useState(url);
  const [key, setKey] = useState(0);

  function navigate(dest: string) {
    const full = dest.startsWith('http') ? dest : `https://${dest}`;
    setUrl(full);
    setInputVal(full);
    setKey(k => k + 1);
  }

  const blocked = isBlocked(url);

  return (
    <div style={{
      background: 'rgba(4,8,16,0.97)',
      border: '1px solid rgba(0,168,255,0.15)',
      borderRadius: 10, backdropFilter: 'blur(24px)',
      boxShadow: '0 8px 40px rgba(0,0,0,0.7)',
      width: 520, display: 'flex', flexDirection: 'column',
      overflow: 'hidden', animation: 'fadeInUp 0.2s ease',
    }}>
      {/* Title bar */}
      <div data-drag-handle="true" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '9px 14px', borderBottom: '1px solid rgba(0,168,255,0.08)',
        cursor: 'grab', gap: 8, flexShrink: 0,
      }}>
        <Globe size={12} style={{ color: 'rgba(0,168,255,0.45)', flexShrink: 0 }} />
        <form style={{ flex: 1 }} onSubmit={e => { e.preventDefault(); navigate(inputVal); }}>
          <input
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            style={{
              width: '100%', background: 'rgba(0,168,255,0.06)',
              border: '1px solid rgba(0,168,255,0.12)', borderRadius: 5,
              color: 'rgba(224,240,255,0.8)', fontSize: 11,
              fontFamily: 'var(--font-mono)', padding: '4px 8px',
              outline: 'none',
            }}
            placeholder="Enter URL..."
            aria-label="URL"
          />
        </form>
        <button onClick={() => setKey(k => k + 1)} aria-label="Reload" style={{
          background: 'none', border: 'none', color: 'rgba(0,168,255,0.4)',
          cursor: 'pointer', padding: 3, display: 'flex', flexShrink: 0,
        }}><RefreshCw size={12} /></button>
        <button onClick={onClose} aria-label="Close" style={{
          background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)',
          cursor: 'pointer', padding: 3, display: 'flex', flexShrink: 0,
        }}><X size={13} /></button>
      </div>

      {/* Presets */}
      <div style={{
        display: 'flex', gap: 6, padding: '6px 14px',
        borderBottom: '1px solid rgba(0,168,255,0.06)', flexShrink: 0,
      }}>
        {PRESETS.map(p => (
          <button key={p.url} onClick={() => navigate(p.url)} style={{
            background: 'rgba(0,168,255,0.06)',
            border: '1px solid rgba(0,168,255,0.10)',
            borderRadius: 4, padding: '3px 8px',
            color: 'rgba(0,168,255,0.55)', fontSize: 9,
            fontFamily: 'var(--font-mono)', cursor: 'pointer',
            letterSpacing: '0.08em', transition: 'all 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,168,255,0.14)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,168,255,0.06)')}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Content area */}
      {blocked ? (
        <div style={{
          height: 380, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 16,
          background: 'rgba(0,0,0,0.3)',
        }}>
          <Globe size={32} style={{ color: 'rgba(0,168,255,0.25)' }} />
          <div style={{ textAlign: 'center' }}>
            <p style={{
              fontFamily: 'var(--font-mono)', fontSize: 12,
              color: 'rgba(255,255,255,0.5)', marginBottom: 6,
            }}>
              This site blocks embedding
            </p>
            <p style={{
              fontFamily: 'var(--font-mono)', fontSize: 10,
              color: 'rgba(0,168,255,0.4)',
            }}>
              {new URL(url).hostname}
            </p>
          </div>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'rgba(0,168,255,0.12)',
              border: '1px solid rgba(0,168,255,0.3)',
              borderRadius: 6, padding: '8px 16px',
              color: '#00a8ff', fontSize: 12,
              fontFamily: 'var(--font-mono)',
              textDecoration: 'none', cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            <ExternalLink size={12} /> Open in new tab
          </a>
        </div>
      ) : (
        <iframe
          key={key}
          src={url}
          style={{
            width: '100%', height: 380, border: 'none',
            background: '#fff', borderRadius: '0 0 10px 10px',
          }}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          title="Web view"
        />
      )}
    </div>
  );
}
