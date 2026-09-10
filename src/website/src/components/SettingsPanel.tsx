'use client'

interface Props {
  open: boolean
  onClose: () => void
  gatewayUrl: string
  model: string
  onModelChange: (m: string) => void
  voiceEnabled: boolean
  onVoiceToggle: () => void
  connected: boolean
}

const MODELS = [
  { id: 'groq/llama-3.1-8b-instant', label: 'Llama 3.1 8B (fast)' },
  { id: 'gemini/gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
  { id: 'gemini/gemini-1.5-pro', label: 'Gemini 1.5 Pro (smart)' },
]

export default function SettingsPanel({ open, onClose, gatewayUrl, model, onModelChange, voiceEnabled, onVoiceToggle, connected }: Props) {
  return (
    <>
      {/* backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 40,
          background: 'rgba(0,0,0,0.5)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 300ms',
        }}
      />
      {/* panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 50,
        width: 300,
        background: 'rgba(8,12,24,0.97)',
        borderLeft: '1px solid rgba(30,80,160,0.4)',
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 350ms cubic-bezier(0.4,0,0.2,1)',
        display: 'flex', flexDirection: 'column', gap: 0,
        padding: '24px 20px',
        overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
          <span style={{ fontSize: 13, letterSpacing: '0.18em', color: '#7dd3fc', textTransform: 'uppercase' }}>Settings</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 20, padding: 4 }}>✕</button>
        </div>

        {/* connection status */}
        <Section label="Connection">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: connected ? '#22c55e' : '#ef4444', boxShadow: connected ? '0 0 6px #22c55e' : '0 0 6px #ef4444' }} />
            <span style={{ fontSize: 12, color: '#9ca3af' }}>{connected ? 'Gateway connected' : 'Gateway offline'}</span>
          </div>
          <div style={{ marginTop: 8, fontSize: 11, color: '#4b5563', fontFamily: 'monospace', wordBreak: 'break-all' }}>{gatewayUrl}</div>
        </Section>

        {/* model selector */}
        <Section label="LLM Model">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {MODELS.map(m => (
              <button
                key={m.id}
                onClick={() => onModelChange(m.id)}
                style={{
                  padding: '8px 12px', borderRadius: 6, fontSize: 12, textAlign: 'left',
                  border: `1px solid ${model === m.id ? 'rgba(125,211,252,0.6)' : 'rgba(55,65,81,0.6)'}`,
                  background: model === m.id ? 'rgba(14,90,180,0.2)' : 'transparent',
                  color: model === m.id ? '#bae6fd' : '#9ca3af',
                  cursor: 'pointer', transition: 'all 200ms',
                }}
              >
                {m.label}
                {model === m.id && <span style={{ float: 'right', color: '#38bdf8' }}>✓</span>}
              </button>
            ))}
          </div>
        </Section>

        {/* voice toggle */}
        <Section label="Voice Mode">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: '#9ca3af' }}>Enable microphone input</span>
            <Toggle on={voiceEnabled} onToggle={onVoiceToggle} />
          </div>
          <p style={{ fontSize: 11, color: '#4b5563', marginTop: 6 }}>
            Requires browser microphone permission. Audio is streamed to gateway.
          </p>
        </Section>

        {/* about */}
        <Section label="About">
          <div style={{ fontSize: 11, color: '#4b5563', lineHeight: 1.6 }}>
            <div>Jarvis v0.2 — Phase 2</div>
            <div>Brain: LangGraph + LiteLLM</div>
            <div>Memory: Mem0 + ChromaDB</div>
            <div>Gateway: Node.js WebSocket</div>
          </div>
        </Section>
      </div>
    </>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 10, letterSpacing: '0.15em', color: '#4b5563', textTransform: 'uppercase', marginBottom: 10 }}>{label}</div>
      {children}
    </div>
  )
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      style={{
        width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
        background: on ? 'rgba(14,90,180,0.8)' : 'rgba(55,65,81,0.6)',
        position: 'relative', transition: 'background 200ms',
      }}
    >
      <div style={{
        position: 'absolute', top: 3, left: on ? 23 : 3,
        width: 18, height: 18, borderRadius: '50%',
        background: on ? '#38bdf8' : '#6b7280',
        transition: 'left 200ms, background 200ms',
        boxShadow: on ? '0 0 6px #38bdf8' : 'none',
      }} />
    </button>
  )
}
