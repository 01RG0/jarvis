'use client'
import { useEffect, useState, useCallback } from 'react'

interface ProviderModel {
  alias: string
  model: string
  provider: string
  key_env: string
  key_set: boolean
}

interface RouterSettings {
  routing_strategy: string
  num_retries: number
  timeout: number
  allowed_fails: number
  cooldown_time: number
}

interface ProvidersData {
  models: ProviderModel[]
  fallbacks: Record<string, string[]>
  router_settings: RouterSettings
}

interface SpendRow {
  model: string
  calls: number
  total_cost: number
  total_tokens: number
  avg_ms: number
}

interface TestResult {
  ok: boolean
  alias: string
  latency_ms: number
  response?: string
  error?: string
  model_used?: string
}

const BRAIN = 'http://localhost:8001'

const PROVIDER_COLORS: Record<string, string> = {
  groq:        '#f97316',
  gemini:      '#4285f4',
  anthropic:   '#c27803',
  deepseek:    '#7c3aed',
  openai:      '#10b981',
  perplexity:  '#06b6d4',
  xai:         '#a855f7',
  mistral:     '#ec4899',
  together_ai: '#84cc16',
  fireworks:   '#f43f5e',
}

const ALL_PROVIDERS = [
  { id: 'groq',        label: 'Groq',         models: ['groq/llama-3.1-8b-instant','groq/llama-3.3-70b-versatile','groq/mixtral-8x7b-32768'] },
  { id: 'gemini',      label: 'Gemini',        models: ['gemini/gemini-1.5-flash','gemini/gemini-1.5-pro','gemini/gemini-2.0-flash'] },
  { id: 'anthropic',   label: 'Anthropic',     models: ['anthropic/claude-3-5-sonnet-20241022','anthropic/claude-3-haiku-20240307','anthropic/claude-opus-4-5'] },
  { id: 'deepseek',    label: 'DeepSeek',      models: ['deepseek/deepseek-chat','deepseek/deepseek-r1'] },
  { id: 'openai',      label: 'OpenAI',        models: ['openai/gpt-4o','openai/gpt-4o-mini','openai/o1-mini'] },
  { id: 'perplexity',  label: 'Perplexity',    models: ['perplexity/sonar-pro','perplexity/sonar'] },
  { id: 'xai',         label: 'xAI / Grok',    models: ['xai/grok-2','xai/grok-3'] },
  { id: 'mistral',     label: 'Mistral',       models: ['mistral/mistral-large-latest','mistral/mistral-small-latest'] },
]

const KEY_ENV_MAP: Record<string, string> = {
  groq: 'GROQ_API_KEY', gemini: 'GEMINI_API_KEY', anthropic: 'ANTHROPIC_API_KEY',
  deepseek: 'DEEPSEEK_API_KEY', openai: 'OPENAI_API_KEY', perplexity: 'PERPLEXITY_API_KEY',
  xai: 'XAI_API_KEY', mistral: 'MISTRAL_API_KEY', together_ai: 'TOGETHERAI_API_KEY',
}

const ALIAS_OPTIONS = ['jarvis-fast','jarvis-balanced','jarvis-smart','jarvis-coder','jarvis-vision','jarvis-cheap','jarvis-reason']

export default function ProvidersWidget() {
  const [data, setData] = useState<ProvidersData | null>(null)
  const [spend, setSpend] = useState<SpendRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState<'models'|'fallbacks'|'settings'|'spend'>('models')
  const [testing, setTesting] = useState<Record<string, TestResult | 'loading'>>({})
  const [dirty, setDirty] = useState(false)
  const [expandedFallback, setExpandedFallback] = useState<string | null>(null)
  const [addModelOpen, setAddModelOpen] = useState(false)
  const [newModel, setNewModel] = useState({ alias: 'jarvis-custom', provider: 'groq', model: '' })

  const load = useCallback(async () => {
    try {
      const [pd, sd] = await Promise.all([
        fetch(`${BRAIN}/api/providers`).then(r => r.json()),
        fetch(`${BRAIN}/api/providers/spend`).then(r => r.json()),
      ])
      setData(pd)
      setSpend(sd)
    } catch { /* brain offline */ }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const save = async () => {
    if (!data) return
    setSaving(true)
    try {
      const res = await fetch(`${BRAIN}/api/providers`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (res.ok) setDirty(false)
    } catch { /* ignore */ }
    setSaving(false)
  }

  const testAlias = async (alias: string) => {
    setTesting(p => ({ ...p, [alias]: 'loading' }))
    try {
      const res = await fetch(`${BRAIN}/api/providers/test/${alias}`, { method: 'POST' })
      const result: TestResult = await res.json()
      setTesting(p => ({ ...p, [alias]: result }))
    } catch (e) {
      setTesting(p => ({ ...p, [alias]: { ok: false, alias, latency_ms: 0, error: String(e) } }))
    }
  }

  const updateModel = (idx: number, field: keyof ProviderModel, value: string | boolean) => {
    if (!data) return
    const models = [...data.models]
    models[idx] = { ...models[idx], [field]: value }
    setData({ ...data, models })
    setDirty(true)
  }

  const removeModel = (idx: number) => {
    if (!data) return
    const models = data.models.filter((_, i) => i !== idx)
    setData({ ...data, models })
    setDirty(true)
  }

  const moveFallback = (alias: string, fromIdx: number, dir: -1 | 1) => {
    if (!data) return
    const fb = [...(data.fallbacks[alias] || [])]
    const toIdx = fromIdx + dir
    if (toIdx < 0 || toIdx >= fb.length) return
    ;[fb[fromIdx], fb[toIdx]] = [fb[toIdx], fb[fromIdx]]
    setData({ ...data, fallbacks: { ...data.fallbacks, [alias]: fb } })
    setDirty(true)
  }

  const removeFallback = (alias: string, fbAlias: string) => {
    if (!data) return
    setData({ ...data, fallbacks: { ...data.fallbacks, [alias]: data.fallbacks[alias].filter(f => f !== fbAlias) } })
    setDirty(true)
  }

  const addFallback = (alias: string, fbAlias: string) => {
    if (!data || !fbAlias || data.fallbacks[alias]?.includes(fbAlias)) return
    setData({ ...data, fallbacks: { ...data.fallbacks, [alias]: [...(data.fallbacks[alias] || []), fbAlias] } })
    setDirty(true)
  }

  const addNewModel = () => {
    if (!data || !newModel.model) return
    const key_env = KEY_ENV_MAP[newModel.provider] || `${newModel.provider.toUpperCase()}_API_KEY`
    const model: ProviderModel = {
      alias: newModel.alias, model: newModel.model,
      provider: newModel.provider, key_env,
      key_set: false,
    }
    setData({ ...data, models: [...data.models, model] })
    setAddModelOpen(false)
    setDirty(true)
  }

  const updateSettings = (field: keyof RouterSettings, value: string | number) => {
    if (!data) return
    setData({ ...data, router_settings: { ...data.router_settings, [field]: value } })
    setDirty(true)
  }

  const c = {
    bg:      'rgba(13,18,28,0.97)',
    border:  'rgba(0,168,255,0.15)',
    accent:  '#00a8ff',
    text:    '#c8d6e5',
    muted:   'rgba(200,214,229,0.4)',
    row:     'rgba(0,168,255,0.04)',
    rowHov:  'rgba(0,168,255,0.08)',
    input:   'rgba(0,168,255,0.07)',
    danger:  '#f43f5e',
    success: '#00e676',
    warn:    '#fbbf24',
  }

  const hdr = (
    <div data-drag-handle="true" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px 8px', borderBottom:`1px solid ${c.border}`, cursor:'grab', userSelect:'none' }}>
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <span style={{ fontSize:11, letterSpacing:2, color:c.accent, fontFamily:"'Orbitron',sans-serif" }}>AI PROVIDERS</span>
        {dirty && <span style={{ fontSize:10, color:c.warn, background:'rgba(251,191,36,0.12)', padding:'1px 6px', borderRadius:3 }}>UNSAVED</span>}
      </div>
      <div style={{ display:'flex', gap:6 }}>
        <button onClick={load} style={{ fontSize:10, padding:'3px 8px', background:'transparent', border:`1px solid ${c.border}`, color:c.muted, borderRadius:3, cursor:'pointer' }}>↻</button>
        {dirty && (
          <button onClick={save} disabled={saving} style={{ fontSize:10, padding:'3px 10px', background:saving ? c.border : c.accent, border:'none', color:saving ? c.muted : '#000', borderRadius:3, cursor:'pointer', fontWeight:600 }}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        )}
      </div>
    </div>
  )

  const tabs = ['models','fallbacks','settings','spend'] as const
  const tabBar = (
    <div style={{ display:'flex', borderBottom:`1px solid ${c.border}` }}>
      {tabs.map(t => (
        <button key={t} onClick={() => setTab(t)} style={{ flex:1, padding:'6px 4px', fontSize:10, letterSpacing:1, background:'transparent', border:'none', borderBottom: tab===t ? `2px solid ${c.accent}` : '2px solid transparent', color: tab===t ? c.accent : c.muted, cursor:'pointer', textTransform:'uppercase' }}>{t}</button>
      ))}
    </div>
  )

  if (loading) return (
    <div style={{ background:c.bg, border:`1px solid ${c.border}`, borderRadius:8, overflow:'hidden', minWidth:420 }}>
      {hdr}
      <div style={{ padding:24, textAlign:'center', color:c.muted, fontSize:12 }}>Loading providers…</div>
    </div>
  )

  if (!data) return (
    <div style={{ background:c.bg, border:`1px solid ${c.border}`, borderRadius:8, overflow:'hidden', minWidth:420 }}>
      {hdr}
      <div style={{ padding:24, textAlign:'center', color:c.danger, fontSize:12 }}>Brain offline — start <code>src/brain/server.py</code></div>
    </div>
  )

  return (
    <div style={{ background:c.bg, border:`1px solid ${c.border}`, borderRadius:8, overflow:'hidden', minWidth:420, maxHeight:560, display:'flex', flexDirection:'column' }}>
      {hdr}
      {tabBar}
      <div style={{ overflowY:'auto', flex:1 }}>

        {/* MODELS TAB */}
        {tab === 'models' && (
          <div style={{ padding:'8px 0' }}>
            {data.models.map((m, i) => {
              const color = PROVIDER_COLORS[m.provider] || c.accent
              const testRes = testing[m.alias]
              return (
                <div key={m.alias} style={{ padding:'8px 14px', borderBottom:`1px solid ${c.border}`, display:'flex', flexDirection:'column', gap:6 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <div style={{ width:8, height:8, borderRadius:'50%', background: m.key_set ? c.success : c.danger, flexShrink:0 }} title={m.key_set ? `${m.key_env} is set` : `${m.key_env} missing`} />
                    <span style={{ fontSize:11, fontFamily:"'Orbitron',sans-serif", color, minWidth:110 }}>{m.alias}</span>
                    <span style={{ fontSize:10, color:c.muted, flex:1 }}>{m.model}</span>
                    <span style={{ fontSize:9, padding:'2px 6px', borderRadius:3, background:`${color}22`, color, flexShrink:0 }}>{m.provider}</span>
                  </div>
                  <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                    <select value={m.model} onChange={e => updateModel(i, 'model', e.target.value)}
                      style={{ flex:1, fontSize:10, background:c.input, border:`1px solid ${c.border}`, color:c.text, borderRadius:3, padding:'3px 6px' }}>
                      {(ALL_PROVIDERS.find(p => p.id === m.provider)?.models || [m.model]).map(mo => (
                        <option key={mo} value={mo}>{mo}</option>
                      ))}
                      <option value={m.model}>{m.model}</option>
                    </select>
                    <button onClick={() => testAlias(m.alias)} style={{ fontSize:10, padding:'3px 8px', background:`${color}22`, border:`1px solid ${color}44`, color, borderRadius:3, cursor:'pointer', flexShrink:0 }}>
                      {testRes === 'loading' ? '…' : 'Test'}
                    </button>
                    <button onClick={() => removeModel(i)} style={{ fontSize:10, padding:'3px 7px', background:'transparent', border:`1px solid ${c.danger}44`, color:c.danger, borderRadius:3, cursor:'pointer' }}>✕</button>
                  </div>
                  {testRes && testRes !== 'loading' && (
                    <div style={{ fontSize:10, padding:'4px 8px', borderRadius:3, background: testRes.ok ? 'rgba(0,230,118,0.08)' : 'rgba(244,63,94,0.08)', color: testRes.ok ? c.success : c.danger, border:`1px solid ${testRes.ok ? c.success : c.danger}33` }}>
                      {testRes.ok ? `✓ ${testRes.latency_ms}ms — ${testRes.model_used} — "${testRes.response}"` : `✗ ${testRes.error}`}
                    </div>
                  )}
                  {!m.key_set && (
                    <div style={{ fontSize:10, color:c.warn }}>⚠ Set <code style={{ background:'rgba(251,191,36,0.1)', padding:'0 4px', borderRadius:2 }}>{m.key_env}</code> in .env</div>
                  )}
                </div>
              )
            })}

            {/* Add model button */}
            {!addModelOpen ? (
              <div style={{ padding:'10px 14px' }}>
                <button onClick={() => setAddModelOpen(true)} style={{ width:'100%', padding:'7px', fontSize:11, background:'transparent', border:`1px dashed ${c.accent}44`, color:c.accent, borderRadius:4, cursor:'pointer' }}>+ Add Provider</button>
              </div>
            ) : (
              <div style={{ padding:'10px 14px', display:'flex', flexDirection:'column', gap:6 }}>
                <div style={{ fontSize:11, color:c.accent, marginBottom:2 }}>New Provider</div>
                <div style={{ display:'flex', gap:6 }}>
                  <select value={newModel.alias} onChange={e => setNewModel(p => ({ ...p, alias: e.target.value }))}
                    style={{ flex:1, fontSize:10, background:c.input, border:`1px solid ${c.border}`, color:c.text, borderRadius:3, padding:'4px 6px' }}>
                    {ALIAS_OPTIONS.map(a => <option key={a} value={a}>{a}</option>)}
                    <option value="jarvis-custom">jarvis-custom</option>
                  </select>
                  <select value={newModel.provider} onChange={e => setNewModel(p => ({ ...p, provider: e.target.value, model: '' }))}
                    style={{ flex:1, fontSize:10, background:c.input, border:`1px solid ${c.border}`, color:c.text, borderRadius:3, padding:'4px 6px' }}>
                    {ALL_PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                  </select>
                </div>
                <select value={newModel.model} onChange={e => setNewModel(p => ({ ...p, model: e.target.value }))}
                  style={{ fontSize:10, background:c.input, border:`1px solid ${c.border}`, color:c.text, borderRadius:3, padding:'4px 6px' }}>
                  <option value="">— select model —</option>
                  {(ALL_PROVIDERS.find(p => p.id === newModel.provider)?.models || []).map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <div style={{ display:'flex', gap:6 }}>
                  <button onClick={addNewModel} disabled={!newModel.model} style={{ flex:1, padding:'5px', fontSize:11, background: newModel.model ? c.accent : c.border, border:'none', color: newModel.model ? '#000' : c.muted, borderRadius:3, cursor: newModel.model ? 'pointer' : 'not-allowed', fontWeight:600 }}>Add</button>
                  <button onClick={() => setAddModelOpen(false)} style={{ flex:1, padding:'5px', fontSize:11, background:'transparent', border:`1px solid ${c.border}`, color:c.muted, borderRadius:3, cursor:'pointer' }}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* FALLBACKS TAB */}
        {tab === 'fallbacks' && (
          <div style={{ padding:'8px 0' }}>
            {data.models.map(m => {
              const fb = data.fallbacks[m.alias] || []
              const isOpen = expandedFallback === m.alias
              const color = PROVIDER_COLORS[m.provider] || c.accent
              return (
                <div key={m.alias} style={{ borderBottom:`1px solid ${c.border}` }}>
                  <div onClick={() => setExpandedFallback(isOpen ? null : m.alias)}
                    style={{ padding:'9px 14px', display:'flex', alignItems:'center', gap:8, cursor:'pointer', background: isOpen ? c.rowHov : 'transparent' }}>
                    <span style={{ fontSize:11, fontFamily:"'Orbitron',sans-serif", color, flex:1 }}>{m.alias}</span>
                    <span style={{ fontSize:10, color:c.muted }}>{fb.length > 0 ? fb.join(' → ') : 'no fallback'}</span>
                    <span style={{ color:c.muted, fontSize:10 }}>{isOpen ? '▲' : '▼'}</span>
                  </div>
                  {isOpen && (
                    <div style={{ padding:'0 14px 10px', display:'flex', flexDirection:'column', gap:4 }}>
                      {fb.map((f, fi) => (
                        <div key={f} style={{ display:'flex', alignItems:'center', gap:6, padding:'4px 8px', background:c.row, borderRadius:3 }}>
                          <span style={{ fontSize:10, color:c.muted, width:14 }}>{fi+1}.</span>
                          <span style={{ flex:1, fontSize:10, color:c.text }}>{f}</span>
                          <button onClick={() => moveFallback(m.alias, fi, -1)} disabled={fi===0} style={{ fontSize:10, background:'transparent', border:'none', color: fi===0 ? c.border : c.accent, cursor: fi===0 ? 'default' : 'pointer' }}>↑</button>
                          <button onClick={() => moveFallback(m.alias, fi, 1)} disabled={fi===fb.length-1} style={{ fontSize:10, background:'transparent', border:'none', color: fi===fb.length-1 ? c.border : c.accent, cursor: fi===fb.length-1 ? 'default' : 'pointer' }}>↓</button>
                          <button onClick={() => removeFallback(m.alias, f)} style={{ fontSize:10, background:'transparent', border:'none', color:c.danger, cursor:'pointer' }}>✕</button>
                        </div>
                      ))}
                      <div style={{ display:'flex', gap:6, marginTop:4 }}>
                        <select defaultValue="" onChange={e => { if (e.target.value) addFallback(m.alias, e.target.value); e.target.value = '' }}
                          style={{ flex:1, fontSize:10, background:c.input, border:`1px solid ${c.border}`, color:c.text, borderRadius:3, padding:'4px 6px' }}>
                          <option value="">+ add fallback…</option>
                          {data.models.filter(mm => mm.alias !== m.alias && !fb.includes(mm.alias)).map(mm => (
                            <option key={mm.alias} value={mm.alias}>{mm.alias}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* SETTINGS TAB */}
        {tab === 'settings' && (
          <div style={{ padding:'14px' }}>
            {([
              { key: 'routing_strategy', label: 'Routing Strategy', type: 'select', options: ['latency-based-routing','simple-shuffle','least-busy','usage-based-routing'] },
              { key: 'num_retries',   label: 'Retries',       type: 'number' },
              { key: 'timeout',       label: 'Timeout (s)',   type: 'number' },
              { key: 'allowed_fails', label: 'Allowed Fails', type: 'number' },
              { key: 'cooldown_time', label: 'Cooldown (s)',  type: 'number' },
            ] as const).map(({ key, label, type, options }: any) => (
              <div key={key} style={{ display:'flex', alignItems:'center', marginBottom:10, gap:12 }}>
                <label style={{ fontSize:11, color:c.muted, width:130, flexShrink:0 }}>{label}</label>
                {type === 'select' ? (
                  <select value={String((data.router_settings as any)[key])} onChange={e => updateSettings(key as keyof RouterSettings, e.target.value)}
                    style={{ flex:1, fontSize:11, background:c.input, border:`1px solid ${c.border}`, color:c.text, borderRadius:3, padding:'5px 8px' }}>
                    {options.map((o: string) => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input type="number" value={(data.router_settings as any)[key]}
                    onChange={e => updateSettings(key as keyof RouterSettings, Number(e.target.value))}
                    style={{ flex:1, fontSize:11, background:c.input, border:`1px solid ${c.border}`, color:c.text, borderRadius:3, padding:'5px 8px' }} />
                )}
              </div>
            ))}
          </div>
        )}

        {/* SPEND TAB */}
        {tab === 'spend' && (
          <div style={{ padding:'8px 0' }}>
            {spend.length === 0 ? (
              <div style={{ padding:20, textAlign:'center', color:c.muted, fontSize:11 }}>No spend data yet</div>
            ) : (
              <>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 50px 80px 70px 60px', padding:'4px 14px 6px', fontSize:9, color:c.muted, letterSpacing:1, textTransform:'uppercase', borderBottom:`1px solid ${c.border}` }}>
                  <span>Model</span><span>Calls</span><span>Total $</span><span>Tokens</span><span>Avg ms</span>
                </div>
                {spend.map(row => (
                  <div key={row.model} style={{ display:'grid', gridTemplateColumns:'1fr 50px 80px 70px 60px', padding:'7px 14px', borderBottom:`1px solid ${c.border}`, fontSize:10 }}>
                    <span style={{ color:c.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{row.model}</span>
                    <span style={{ color:c.muted }}>{row.calls}</span>
                    <span style={{ color: row.total_cost > 0.01 ? c.warn : c.success }}>${row.total_cost.toFixed(5)}</span>
                    <span style={{ color:c.muted }}>{row.total_tokens.toLocaleString()}</span>
                    <span style={{ color:c.muted }}>{row.avg_ms}</span>
                  </div>
                ))}
                <div style={{ padding:'8px 14px', fontSize:10, color:c.muted, borderTop:`1px solid ${c.border}` }}>
                  Total: <span style={{ color:c.warn }}>${spend.reduce((s, r) => s + r.total_cost, 0).toFixed(5)}</span>
                  &nbsp;·&nbsp;{spend.reduce((s, r) => s + r.calls, 0)} calls
                </div>
              </>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
