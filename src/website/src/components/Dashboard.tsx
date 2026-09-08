'use client'

import { useState, useEffect } from 'react'

const GW_HTTP = (process.env.NEXT_PUBLIC_GATEWAY_URL || 'ws://localhost:8080')
  .replace(/^ws/, 'http')

interface SpendRow { model: string; calls: number; cost_usd: number; avg_ms: number }
interface TaskRow { id: string; input: string; result: string; created_at: string; cost_usd: number }
interface MemRow { id: string; memory: string }

type Tab = 'spend' | 'tasks' | 'memory' | 'alerts'

const TABS: { id: Tab; label: string }[] = [
  { id: 'spend', label: 'Spend' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'memory', label: 'Memory' },
  { id: 'alerts', label: 'Alerts' },
]

export default function Dashboard() {
  const [tab, setTab] = useState<Tab>('spend')
  const [spend, setSpend] = useState<SpendRow[]>([])
  const [tasks, setTasks] = useState<TaskRow[]>([])
  const [memory, setMemory] = useState<MemRow[]>([])
  const [alerts, setAlerts] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const fetchTab = async (t: Tab) => {
    setLoading(true)
    setError('')
    try {
      if (t === 'spend') {
        const r = await fetch(`${GW_HTTP}/dashboard/spend`)
        setSpend(r.ok ? await r.json() : [])
      } else if (t === 'tasks') {
        const r = await fetch(`${GW_HTTP}/dashboard/tasks`)
        setTasks(r.ok ? await r.json() : [])
      } else if (t === 'memory') {
        const r = await fetch(`${GW_HTTP}/dashboard/memory`)
        setMemory(r.ok ? await r.json() : [])
      } else if (t === 'alerts') {
        const r = await fetch(`${GW_HTTP}/dashboard/alerts`)
        setAlerts(r.ok ? await r.json() : [])
      }
    } catch {
      setError('Failed to load — is the gateway running?')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchTab(tab) }, [tab])

  return (
    <div className="flex flex-col h-full bg-[#0d0d12] border-l border-zinc-800 text-white text-xs">
      {/* Tab bar */}
      <div className="flex border-b border-zinc-800">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex-1 py-2 text-center transition-colors ${
              tab === id
                ? 'text-blue-400 border-b-2 border-blue-500'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {label}
          </button>
        ))}
        <button
          onClick={() => fetchTab(tab)}
          className="px-3 text-zinc-500 hover:text-zinc-300"
          title="Refresh"
        >
          ↻
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {loading && <p className="text-zinc-600 text-center mt-6">Loading...</p>}
        {!loading && error && <p className="text-red-500 text-center mt-6">{error}</p>}

        {/* Spend */}
        {!loading && tab === 'spend' && (
          <table className="w-full">
            <thead>
              <tr className="text-zinc-500">
                <th className="text-left py-1">Model</th>
                <th className="text-right py-1">Calls</th>
                <th className="text-right py-1">Cost</th>
                <th className="text-right py-1">Avg ms</th>
              </tr>
            </thead>
            <tbody>
              {spend.length === 0 && (
                <tr><td colSpan={4} className="text-zinc-600 text-center py-4">No data yet</td></tr>
              )}
              {spend.map((row, i) => (
                <tr key={i} className="border-t border-zinc-800">
                  <td className="py-1 text-zinc-300">{row.model}</td>
                  <td className="py-1 text-right text-zinc-400">{row.calls}</td>
                  <td className="py-1 text-right text-green-400">${row.cost_usd.toFixed(4)}</td>
                  <td className="py-1 text-right text-zinc-400">{row.avg_ms}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Tasks */}
        {!loading && tab === 'tasks' && (
          <div className="space-y-2">
            {tasks.length === 0 && <p className="text-zinc-600 text-center py-4">No tasks yet</p>}
            {tasks.map((t) => (
              <div key={t.id} className="bg-zinc-900 rounded p-2 space-y-1">
                <div className="flex justify-between text-zinc-500">
                  <span>{t.created_at?.slice(0, 16).replace('T', ' ')}</span>
                  <span className="text-green-400">${t.cost_usd?.toFixed(4)}</span>
                </div>
                <p className="text-zinc-300 truncate">{t.input}</p>
                <p className="text-zinc-500 truncate">{t.result}</p>
              </div>
            ))}
          </div>
        )}

        {/* Memory */}
        {!loading && tab === 'memory' && (
          <div className="space-y-2">
            {memory.length === 0 && <p className="text-zinc-600 text-center py-4">Memory is empty</p>}
            {memory.map((m, i) => (
              <div key={m.id ?? i} className="bg-zinc-900 rounded p-2">
                <p className="text-zinc-300 text-xs">{m.memory}</p>
              </div>
            ))}
          </div>
        )}

        {/* Alerts */}
        {!loading && tab === 'alerts' && (
          <div className="space-y-2">
            {alerts.length === 0 && <p className="text-zinc-600 text-center py-4">No alerts</p>}
            {alerts.map((a, i) => (
              <div key={i} className="bg-zinc-900 rounded p-2 text-yellow-400">{a}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
