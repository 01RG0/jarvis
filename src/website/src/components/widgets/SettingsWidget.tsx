'use client';

import { useEffect, useState } from 'react';
import { X, Volume2, Mic, Palette } from 'lucide-react';

type TtsProvider = 'piper' | 'kokoro' | 'elevenlabs' | 'cartesia' | 'fish_audio';

const ORPHEUS_VOICES = ['autumn', 'diana', 'hannah', 'austin', 'daniel', 'troy'] as const;
type OrpheusVoice = typeof ORPHEUS_VOICES[number];

interface Theme { label: string; ring: string; bg: string; cssVar: string }

const THEMES: Theme[] = [
  { label: 'Arc Blue',    ring: '#00a8ff', bg: '#131820', cssVar: '0,168,255'  },
  { label: 'Cyan',        ring: '#00e5ff', bg: '#0d1a1f', cssVar: '0,229,255'  },
  { label: 'Iron Gold',   ring: '#fbbf24', bg: '#181408', cssVar: '251,191,36' },
  { label: 'Emerald',     ring: '#00ff88', bg: '#0a1a10', cssVar: '0,255,136'  },
  { label: 'Violet',      ring: '#a855f7', bg: '#130d1a', cssVar: '168,85,247' },
];

const ls = (key: string) =>
  typeof window !== 'undefined' ? localStorage.getItem(key) : null;

interface SettingsWidgetProps {
  onClose: () => void;
}

export default function SettingsWidget({ onClose }: SettingsWidgetProps) {
  const [ttsProvider, setTtsProvider] = useState<TtsProvider>(
    () => (ls('jarvis_tts') as TtsProvider) ?? 'piper'
  );
  const [voiceMode, setVoiceMode] = useState(
    () => ls('jarvis_voice_mode') === 'true'
  );
  const [orpheusVoice, setOrpheusVoice] = useState<OrpheusVoice>(
    () => (ls('jarvis-voice') as OrpheusVoice | null) ?? 'daniel'
  );
  const [brightness, setBrightness] = useState(
    () => Number(ls('jarvis_brightness') ?? 100)
  );
  const [theme, setTheme] = useState(
    () => Number(ls('jarvis_theme') ?? 0)
  );

  useEffect(() => { localStorage.setItem('jarvis_tts', ttsProvider); }, [ttsProvider]);
  useEffect(() => { localStorage.setItem('jarvis_voice_mode', String(voiceMode)); }, [voiceMode]);
  useEffect(() => { localStorage.setItem('jarvis-voice', orpheusVoice); }, [orpheusVoice]);
  useEffect(() => { localStorage.setItem('jarvis_brightness', String(brightness)); }, [brightness]);
  useEffect(() => { localStorage.setItem('jarvis_theme', String(theme)); }, [theme]);

  function applyTheme(idx: number) {
    setTheme(idx);
    const t = THEMES[idx];
    document.documentElement.style.setProperty('--jarvis-cyan',     t.ring);
    document.documentElement.style.setProperty('--jarvis-glow',     t.ring);
    document.documentElement.style.setProperty('--hud-cyan',        t.ring);
    document.documentElement.style.setProperty('--jarvis-cyan-dim', t.ring);
    document.body.style.setProperty('--theme-rgb', t.cssVar);
  }

  // Restore theme CSS vars on mount
  useEffect(() => {
    applyTheme(theme);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const providers: { id: TtsProvider; label: string }[] = [
    { id: 'piper',      label: 'Piper (local)'    },
    { id: 'kokoro',     label: 'Kokoro (local)'   },
    { id: 'elevenlabs', label: 'ElevenLabs'        },
    { id: 'cartesia',   label: 'Cartesia'          },
    { id: 'fish_audio', label: 'Fish Audio'        },
  ];

  return (
    <div
      role="dialog"
      aria-label="JARVIS settings"
      aria-modal="false"
      style={{
        width: 'min(360px, calc(100vw - 32px))',
        background: 'rgba(6,10,18,0.94)',
        border: '1px solid rgba(0,200,255,0.15)',
        borderRadius: 10,
        backdropFilter: 'blur(24px)',
        boxShadow: '0 8px 40px rgba(0,0,0,0.7), 0 0 20px rgba(0,200,255,0.06)',
        animation: 'fadeInUp 0.2s ease',
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
          cursor: 'grab',
        }}
      >
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10, letterSpacing: '0.2em',
          textTransform: 'uppercase', color: 'rgba(0,200,255,0.55)',
        }}>
          SETTINGS
        </span>
        <button onClick={onClose} aria-label="Close settings" style={{
          background: 'none', border: 'none',
          color: 'rgba(255,255,255,0.35)', cursor: 'pointer',
          padding: 4, display: 'flex', alignItems: 'center',
        }}>
          <X size={14} />
        </button>
      </div>

      <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: 18 }}>

        {/* Color theme */}
        <div>
          <label style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 11, color: 'rgba(0,200,255,0.55)',
            fontFamily: 'var(--font-mono)', letterSpacing: '0.12em',
            textTransform: 'uppercase', marginBottom: 10,
          }}>
            <Palette size={12} /> Color Theme
          </label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {THEMES.map((t, i) => (
              <button
                key={t.label}
                onClick={() => applyTheme(i)}
                title={t.label}
                aria-pressed={theme === i}
                style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: t.ring,
                  border: theme === i
                    ? `2px solid ${t.ring}`
                    : '2px solid rgba(255,255,255,0.1)',
                  boxShadow: theme === i ? `0 0 10px ${t.ring}60` : 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  outline: theme === i ? `2px solid rgba(255,255,255,0.25)` : 'none',
                  outlineOffset: 2,
                }}
              />
            ))}
          </div>
          <p style={{
            marginTop: 6, fontSize: 10,
            color: 'rgba(255,255,255,0.25)', fontFamily: 'var(--font-mono)',
          }}>
            {THEMES[theme].label}
          </p>
        </div>

        {/* TTS Provider */}
        <div>
          <label style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 11, color: 'rgba(0,200,255,0.55)',
            fontFamily: 'var(--font-mono)', letterSpacing: '0.12em',
            textTransform: 'uppercase', marginBottom: 8,
          }}>
            <Volume2 size={12} /> TTS Provider
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {providers.map(p => (
              <button
                key={p.id}
                onClick={() => setTtsProvider(p.id)}
                aria-pressed={ttsProvider === p.id}
                style={{
                  background:  ttsProvider === p.id ? 'rgba(0,200,255,0.12)' : 'rgba(255,255,255,0.03)',
                  border:      ttsProvider === p.id ? '1px solid rgba(0,200,255,0.3)' : '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 6,
                  color:       ttsProvider === p.id ? '#00c8ff' : 'rgba(255,255,255,0.45)',
                  padding: '7px 12px', fontSize: 12, textAlign: 'left',
                  cursor: 'pointer', transition: 'all 0.15s ease',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Orpheus voice picker */}
        <div>
          <label style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 11, color: 'rgba(0,200,255,0.55)',
            fontFamily: 'var(--font-mono)', letterSpacing: '0.12em',
            textTransform: 'uppercase', marginBottom: 8,
          }}>
            <Mic size={12} /> JARVIS Voice
          </label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {ORPHEUS_VOICES.map(v => (
              <button
                key={v}
                onClick={() => setOrpheusVoice(v)}
                aria-pressed={orpheusVoice === v}
                style={{
                  background:  orpheusVoice === v ? 'rgba(0,200,255,0.15)' : 'rgba(255,255,255,0.03)',
                  border:      orpheusVoice === v ? '1px solid rgba(0,200,255,0.4)' : '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 6,
                  color:       orpheusVoice === v ? '#00c8ff' : 'rgba(255,255,255,0.4)',
                  padding: '5px 11px', fontSize: 11,
                  fontFamily: 'var(--font-mono)', letterSpacing: '0.08em',
                  cursor: 'pointer', transition: 'all 0.15s ease',
                  textTransform: 'capitalize',
                }}
              >
                {v}
              </button>
            ))}
          </div>
          <p style={{ marginTop: 5, fontSize: 10, color: 'rgba(255,255,255,0.2)', fontFamily: 'var(--font-mono)' }}>
            Takes effect on next voice session
          </p>
        </div>

        {/* Voice mode toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <label htmlFor="voice-mode-toggle" style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 11, color: 'rgba(0,200,255,0.55)',
            fontFamily: 'var(--font-mono)', letterSpacing: '0.12em',
            textTransform: 'uppercase', cursor: 'pointer',
          }}>
            <Mic size={12} /> Voice Mode
          </label>
          <button
            id="voice-mode-toggle" role="switch" aria-checked={voiceMode}
            onClick={() => setVoiceMode(v => !v)}
            style={{
              width: 40, height: 22, borderRadius: 11,
              background:  voiceMode ? 'rgba(0,200,255,0.4)' : 'rgba(255,255,255,0.1)',
              border:      voiceMode ? '1px solid rgba(0,200,255,0.6)' : '1px solid rgba(255,255,255,0.15)',
              cursor: 'pointer', position: 'relative', transition: 'all 0.2s ease',
            }}
          >
            <span style={{
              position: 'absolute', top: 3, left: voiceMode ? 20 : 3,
              width: 14, height: 14, borderRadius: '50%',
              background: voiceMode ? '#00c8ff' : 'rgba(255,255,255,0.4)',
              transition: 'all 0.2s ease',
              boxShadow: voiceMode ? '0 0 6px rgba(0,200,255,0.6)' : 'none',
            }} />
          </button>
        </div>

        {/* Brightness */}
        <div>
          <label htmlFor="brightness-slider" style={{
            display: 'block', fontSize: 11, color: 'rgba(0,200,255,0.55)',
            fontFamily: 'var(--font-mono)', letterSpacing: '0.12em',
            textTransform: 'uppercase', marginBottom: 8,
          }}>
            HUD Brightness — {brightness}%
          </label>
          <input
            id="brightness-slider" type="range" min={30} max={100}
            value={brightness} onChange={e => setBrightness(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#00c8ff' }}
            aria-label="UI brightness"
          />
        </div>
      </div>
    </div>
  );
}
