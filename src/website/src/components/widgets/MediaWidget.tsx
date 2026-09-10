'use client';

import { useState, useRef } from 'react';
import { X, Upload, Image as ImageIcon, Music, Video, Play, Pause, Volume2 } from 'lucide-react';

type MediaType = 'image' | 'audio' | 'video' | 'none';

export default function MediaWidget({ onClose }: { onClose: () => void }) {
  const [mediaType, setMediaType] = useState<MediaType>('none');
  const [src, setSrc]             = useState<string | null>(null);
  const [fileName, setFileName]   = useState('');
  const [playing, setPlaying]     = useState(false);
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File) {
    const url = URL.createObjectURL(file);
    setSrc(url);
    setFileName(file.name);
    if (file.type.startsWith('image'))      setMediaType('image');
    else if (file.type.startsWith('audio')) setMediaType('audio');
    else if (file.type.startsWith('video')) setMediaType('video');
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function togglePlay() {
    const el = mediaRef.current;
    if (!el) return;
    if (playing) { el.pause(); setPlaying(false); }
    else         { void el.play(); setPlaying(true); }
  }

  return (
    <div style={{
      background: 'rgba(4,8,16,0.97)',
      border: '1px solid rgba(0,168,255,0.15)',
      borderRadius: 10, backdropFilter: 'blur(24px)',
      boxShadow: '0 8px 40px rgba(0,0,0,0.7)',
      width: 360, overflow: 'hidden',
      animation: 'fadeInUp 0.2s ease',
    }}>
      {/* Header */}
      <div data-drag-handle="true" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '9px 14px', borderBottom: '1px solid rgba(0,168,255,0.08)',
        cursor: 'grab', gap: 8,
      }}>
        <span style={{
          fontFamily: "'Rajdhani','Fira Code',monospace", fontSize: 9,
          letterSpacing: '0.28em', textTransform: 'uppercase',
          color: 'rgba(0,168,255,0.45)',
        }}>MEDIA VIEWER</span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={() => inputRef.current?.click()} aria-label="Open file" title="Open file" style={{
            background: 'none', border: 'none', color: 'rgba(0,168,255,0.45)',
            cursor: 'pointer', padding: 3, display: 'flex',
          }}><Upload size={12} /></button>
          <button onClick={onClose} aria-label="Close" style={{
            background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)',
            cursor: 'pointer', padding: 3, display: 'flex',
          }}><X size={13} /></button>
        </div>
      </div>

      <input
        ref={inputRef} type="file"
        accept="image/*,audio/*,video/*"
        style={{ display: 'none' }}
        onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }}
      />

      {/* Drop zone / preview */}
      <div
        onDrop={onDrop}
        onDragOver={e => e.preventDefault()}
        style={{
          minHeight: 200, display: 'flex', alignItems: 'center',
          justifyContent: 'center', flexDirection: 'column',
          padding: 12, gap: 12,
          background: src ? 'transparent' : 'rgba(0,168,255,0.02)',
        }}
      >
        {!src && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', gap: 14, justifyContent: 'center', marginBottom: 10, opacity: 0.35 }}>
              <ImageIcon size={22} color="#00a8ff" />
              <Music     size={22} color="#a855f7" />
              <Video     size={22} color="#00ff88" />
            </div>
            <p style={{
              fontFamily: 'var(--font-mono)', fontSize: 11,
              color: 'rgba(255,255,255,0.25)', letterSpacing: '0.08em',
            }}>
              Drop image / audio / video<br />or click Upload above
            </p>
          </div>
        )}

        {src && mediaType === 'image' && (
          <img src={src} alt={fileName} style={{
            maxWidth: '100%', maxHeight: 280, borderRadius: 6,
            objectFit: 'contain',
          }} />
        )}

        {src && mediaType === 'video' && (
          <video
            ref={mediaRef as React.RefObject<HTMLVideoElement>}
            src={src} controls={false}
            style={{ maxWidth: '100%', maxHeight: 240, borderRadius: 6 }}
            onEnded={() => setPlaying(false)}
          />
        )}

        {src && mediaType === 'audio' && (
          <div style={{ textAlign: 'center' }}>
            <Music size={40} color="rgba(168,85,247,0.6)" />
            <audio ref={mediaRef as React.RefObject<HTMLAudioElement>} src={src} onEnded={() => setPlaying(false)} />
          </div>
        )}
      </div>

      {/* Controls for audio/video */}
      {src && (mediaType === 'audio' || mediaType === 'video') && (
        <div style={{
          padding: '8px 14px', borderTop: '1px solid rgba(0,168,255,0.08)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <button onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'} style={{
            width: 28, height: 28, borderRadius: '50%',
            background: 'rgba(0,168,255,0.15)',
            border: '1px solid rgba(0,168,255,0.3)',
            color: '#00a8ff', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {playing ? <Pause size={12} /> : <Play size={12} />}
          </button>
          <Volume2 size={12} style={{ color: 'rgba(0,168,255,0.35)', flexShrink: 0 }} />
          <input type="range" min={0} max={1} step={0.05} defaultValue={0.8}
            onChange={e => { if (mediaRef.current) mediaRef.current.volume = Number(e.target.value); }}
            style={{ flex: 1, accentColor: '#00a8ff' }}
            aria-label="Volume"
          />
        </div>
      )}

      {/* File name */}
      {fileName && (
        <div style={{
          padding: '4px 14px 8px',
          fontFamily: 'var(--font-mono)', fontSize: 9,
          color: 'rgba(0,168,255,0.25)', letterSpacing: '0.08em',
          borderTop: '1px solid rgba(0,168,255,0.06)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{fileName}</div>
      )}
    </div>
  );
}
