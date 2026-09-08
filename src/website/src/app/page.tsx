'use client'

import { useState, useEffect, useRef } from 'react'

interface Message {
  id: string
  role: 'user' | 'jarvis'
  content: string
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const pendingRef = useRef<Map<string, (msg: Message) => void>>(new Map())

  useEffect(() => {
    const url = (process.env.NEXT_PUBLIC_GATEWAY_URL || 'ws://localhost:8080') +
      '?token=' + (process.env.NEXT_PUBLIC_GATEWAY_TOKEN || 'dev-token')

    let retries = 0
    function connect() {
      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => setConnected(true)
      ws.onclose = () => {
        setConnected(false)
        if (retries < 3) { retries++; setTimeout(connect, 2000) }
      }
      ws.onmessage = (e) => {
        const data = JSON.parse(e.data)
        const resolve = pendingRef.current.get(data.id)
        if (resolve) {
          pendingRef.current.delete(data.id)
          const content = data.error ? `Error: ${data.error}` : data.result
          resolve({ id: data.id + '-reply', role: 'jarvis', content })
        }
      }
    }
    connect()
    return () => wsRef.current?.close()
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = () => {
    if (!input.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    const id = crypto.randomUUID()
    const userMsg: Message = { id, role: 'user', content: input.trim() }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)
    setInput('')

    new Promise<Message>((resolve) => {
      pendingRef.current.set(id, resolve)
      wsRef.current!.send(JSON.stringify({ id, input: userMsg.content }))
    }).then((reply) => {
      setMessages(prev => [...prev, reply])
      setLoading(false)
    })
  }

  return (
    <div className="flex flex-col h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
        <span className="text-lg font-semibold tracking-widest">JARVIS</span>
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
          {connected ? 'Connected' : 'Disconnected'}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-zinc-600 text-center mt-20 text-sm">Say something to Jarvis</p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[70%] px-4 py-2 rounded-lg text-sm whitespace-pre-wrap ${
              m.role === 'user' ? 'bg-white text-black' : 'bg-zinc-800 text-white'
            }`}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-zinc-800 px-4 py-2 rounded-lg text-sm text-zinc-400 animate-pulse">
              Thinking...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-6 py-4 border-t border-zinc-800 bg-zinc-900">
        <div className="flex gap-3">
          <input
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
            placeholder="Message Jarvis..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
          />
          <button
            onClick={handleSend}
            disabled={loading || !connected}
            className="px-4 py-2 bg-white text-black text-sm font-medium rounded-lg hover:bg-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
