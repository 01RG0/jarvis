'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import dynamic from 'next/dynamic'

const ArcReactor = dynamic(() => import('../components/ArcReactor'), { ssr: false })
const Dashboard = dynamic(() => import('../components/Dashboard'), { ssr: false })

interface Message {
  id: string
  role: 'user' | 'jarvis'
  content: string
}

const GW_URL = (process.env.NEXT_PUBLIC_GATEWAY_URL || 'ws://localhost:8080')
const GW_TOKEN = process.env.NEXT_PUBLIC_GATEWAY_TOKEN || 'dev-token'

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState(false)
  const [voiceMode, setVoiceMode] = useState(false)
  const [voiceActive, setVoiceActive] = useState(false)
  const [showDash, setShowDash] = useState(false)

  const wsRef = useRef<WebSocket | null>(null)
  const voiceWsRef = useRef<WebSocket | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const pendingRef = useRef<Map<string, (msg: Message) => void>>(new Map())

  useEffect(() => {
    const url = `${GW_URL}/ws?token=${GW_TOKEN}`
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
        const data = JSON.parse(e.data as string)
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

  const startVoice = useCallback(async () => {
    if (voiceActive) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const voiceUrl = `${GW_URL}/voice?token=${GW_TOKEN}`
      const vws = new WebSocket(voiceUrl)
      voiceWsRef.current = vws
      audioContextRef.current = new AudioContext({ sampleRate: 16000 })
      const audioCtx = audioContextRef.current

      vws.binaryType = 'arraybuffer'
      vws.onopen = () => {
        setVoiceActive(true)
        const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' })
        mediaRecorderRef.current = recorder
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0 && vws.readyState === WebSocket.OPEN) vws.send(e.data)
        }
        recorder.start(100)
      }

      vws.onmessage = async (e) => {
        if (e.data instanceof ArrayBuffer && e.data.byteLength > 0) {
          try {
            const decoded = await audioCtx.decodeAudioData(e.data.slice(0))
            const source = audioCtx.createBufferSource()
            source.buffer = decoded
            source.connect(audioCtx.destination)
            source.start()
          } catch { /* non-audio frame */ }
        }
      }

      vws.onclose = () => {
        setVoiceActive(false)
        stream.getTracks().forEach(t => t.stop())
      }
    } catch (err) {
      console.error('[voice] start failed:', err)
    }
  }, [voiceActive])

  const stopVoice = useCallback(() => {
    mediaRecorderRef.current?.stop()
    voiceWsRef.current?.close()
    audioContextRef.current?.close()
    setVoiceActive(false)
  }, [])

  return (
    <div className="flex h-screen bg-[#0a0a0a] text-white overflow-hidden">
      {/* Main chat panel */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-4">
            <ArcReactor active={connected} speaking={voiceActive} size={48} />
            <div>
              <span className="text-base font-semibold tracking-widest">JARVIS</span>
              <div className="flex items-center gap-2 text-xs text-zinc-500 mt-0.5">
                <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
                {connected ? 'Online' : 'Offline'}
                {voiceActive && <span className="text-blue-400 animate-pulse">· Speaking</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setVoiceMode(v => !v)}
              className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                voiceMode ? 'border-blue-500 text-blue-400' : 'border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300'
              }`}
            >
              {voiceMode ? 'Voice On' : 'Voice'}
            </button>
            <button
              onClick={() => setShowDash(d => !d)}
              className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                showDash ? 'border-zinc-400 text-zinc-300' : 'border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300'
              }`}
            >
              Dashboard
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {messages.length === 0 && (
            <p className="text-zinc-600 text-center mt-20 text-sm">
              {voiceMode ? 'Press the mic to speak to Jarvis' : 'Say something to Jarvis'}
            </p>
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
        <div className="px-6 py-4 border-t border-zinc-800 bg-zinc-900 shrink-0">
          <div className="flex gap-3">
            <input
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
              placeholder="Message Jarvis..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            />
            {voiceMode && (
              <button
                onClick={voiceActive ? stopVoice : startVoice}
                className={`w-10 h-10 flex items-center justify-center rounded-full text-base transition-all ${
                  voiceActive
                    ? 'bg-red-600 hover:bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.6)] animate-pulse'
                    : 'bg-blue-700 hover:bg-blue-600 shadow-[0_0_8px_rgba(59,130,246,0.4)]'
                }`}
                title={voiceActive ? 'Stop voice' : 'Start voice'}
              >
                {voiceActive ? '■' : '🎙'}
              </button>
            )}
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

      {/* Dashboard sidebar */}
      {showDash && (
        <div className="w-72 shrink-0 border-l border-zinc-800">
          <Dashboard />
        </div>
      )}
    </div>
  )
}
