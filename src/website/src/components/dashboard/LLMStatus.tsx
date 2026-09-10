'use client';

interface Provider {
  id: string;
  name: string;
  status: 'connected' | 'not-linked' | 'no-models';
  statusLabel: string;
  color: string;
  bgColor: string;
}

const PROVIDERS: Provider[] = [
  { id: 'claude', name: 'Claude', status: 'not-linked', statusLabel: 'Not Linked', color: '#cc8844', bgColor: 'rgba(200,120,60,0.1)' },
  { id: 'openai', name: 'OpenAI', status: 'not-linked', statusLabel: 'Not Linked', color: '#88bb88', bgColor: 'rgba(100,180,100,0.08)' },
  { id: 'gemini', name: 'Gemini', status: 'not-linked', statusLabel: 'Not Linked', color: '#4488dd', bgColor: 'rgba(50,120,220,0.1)' },
  { id: 'groq', name: 'Groq', status: 'connected', statusLabel: 'Connected', color: 'var(--jarvis-success)', bgColor: 'rgba(0,255,136,0.07)' },
  { id: 'openrouter', name: 'OpenRouter', status: 'not-linked', statusLabel: 'Not Linked', color: '#9966cc', bgColor: 'rgba(120,80,200,0.08)' },
  { id: 'ollama', name: 'Ollama', status: 'no-models', statusLabel: 'No Models', color: 'rgba(120,169,198,0.4)', bgColor: 'rgba(0,50,80,0.1)' },
  { id: 'claude-code', name: 'Claude Code', status: 'connected', statusLabel: 'Connected', color: 'var(--jarvis-success)', bgColor: 'rgba(0,255,136,0.07)' },
  { id: 'cursor', name: 'Cursor', status: 'connected', statusLabel: 'Connected', color: 'var(--jarvis-success)', bgColor: 'rgba(0,255,136,0.07)' },
  { id: 'copilot', name: 'Copilot', status: 'connected', statusLabel: 'Connected', color: 'var(--jarvis-success)', bgColor: 'rgba(0,255,136,0.07)' },
];

// SVG icons per provider
function ProviderIcon({ id, color }: { id: string; color: string }) {
  const style = { color };
  switch (id) {
    case 'groq':
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={style} aria-hidden="true">
          <path d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm-2-9h4v2h-4z"/>
        </svg>
      );
    case 'openai':
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={style} aria-hidden="true">
          <path d="M20.9 8.1a8 8 0 0 0-.7-2.6 5.9 5.9 0 0 0-5.4-3.4 6 6 0 0 0-5.6 3.8 5.8 5.8 0 0 0-3.9 2.8A6 6 0 0 0 6.2 16a6 6 0 0 0 .5 2.4 5.9 5.9 0 0 0 5.4 3.5 5.8 5.8 0 0 0 5.7-3.8 5.8 5.8 0 0 0 3.8-2.8 6 6 0 0 0-.7-7.2z"/>
        </svg>
      );
    case 'gemini':
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={style} aria-hidden="true">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>
      );
    case 'ollama':
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={style} aria-hidden="true">
          <circle cx="12" cy="12" r="10"/>
          <path d="M8 12h8M12 8v8"/>
        </svg>
      );
    default:
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={style} aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="3"/>
          <circle cx="12" cy="12" r="4"/>
        </svg>
      );
  }
}

export default function LLMStatus() {
  const connectedCount = PROVIDERS.filter(p => p.status === 'connected').length;

  return (
    <div className="dashboard-panel flex flex-col" role="region" aria-label="LLM Provider Status">
      <div className="panel-header">
        <span>LLM Status</span>
        <span
          className="text-[10px] font-semibold"
          style={{ color: 'var(--jarvis-success)' }}
        >
          {connectedCount} Connected
        </span>
      </div>

      <div className="flex-1 overflow-auto jarvis-scrollbar p-2">
        <div className="grid grid-cols-3 gap-1.5">
          {PROVIDERS.map((provider) => (
            <div
              key={provider.id}
              className={`provider-card flex-col gap-1.5 items-start ${provider.status === 'connected' ? 'connected' : 'disconnected'}`}
              role="article"
              aria-label={`${provider.name}: ${provider.statusLabel}`}
            >
              <div className="flex items-center gap-1.5 w-full">
                <div
                  className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
                  style={{ background: provider.bgColor }}
                  aria-hidden="true"
                >
                  <ProviderIcon id={provider.id} color={provider.color} />
                </div>
                {provider.status === 'connected' && (
                  <span className="status-dot active ml-auto" aria-hidden="true" />
                )}
              </div>
              <div>
                <div
                  className="text-[10px] font-semibold leading-tight"
                  style={{ color: 'var(--jarvis-text)', fontFamily: 'Fira Code, monospace' }}
                >
                  {provider.name}
                </div>
                <div
                  className="text-[9px] mt-0.5"
                  style={{ color: provider.status === 'connected' ? 'var(--jarvis-success)' : 'rgba(120,169,198,0.4)' }}
                >
                  {provider.statusLabel}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="px-3 py-2 border-t border-jarvis-cyan/[0.05]">
        <button
          className="text-[10px] font-medium tracking-wide"
          style={{ color: 'var(--jarvis-cyan)', opacity: 0.6 }}
        >
          Manage Providers ›
        </button>
      </div>
    </div>
  );
}
