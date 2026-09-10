import 'dotenv/config'
import express from 'express'
import http from 'http'
import axios from 'axios'
import { WebSocketServer } from 'ws'
import { setupWebSocket } from './ws_handler'
import { setupVoiceProxy } from './voice_proxy'

const app = express()
app.use(express.json())

const BRAIN_PORT = process.env.BRAIN_PORT || '8001'
const BRAIN = `http://localhost:${BRAIN_PORT}`

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

// Dashboard proxy endpoints — forward to brain's SQLite-backed routes
app.get('/dashboard/spend', async (_req, res) => {
  try {
    const { data } = await axios.get(`${BRAIN}/dashboard/spend`, { timeout: 5000 })
    res.json(data)
  } catch { res.json([]) }
})

app.get('/dashboard/tasks', async (_req, res) => {
  try {
    const { data } = await axios.get(`${BRAIN}/dashboard/tasks`, { timeout: 5000 })
    res.json(data)
  } catch { res.json([]) }
})

app.get('/dashboard/memory', async (_req, res) => {
  try {
    const { data } = await axios.get(`${BRAIN}/dashboard/memory`, { timeout: 5000 })
    res.json(data)
  } catch { res.json([]) }
})

app.get('/dashboard/alerts', async (_req, res) => {
  try {
    const { data } = await axios.get(`${BRAIN}/dashboard/alerts`, { timeout: 5000 })
    res.json(data)
  } catch { res.json([]) }
})

// Worker registry — PC workers POST here to announce presence
interface WorkerRecord {
  worker_id: string
  hostname: string
  platform: string
  ts: number
  status: string
  last_seen: number
}
const workers = new Map<string, WorkerRecord>()

app.post('/workers/register', (req, res) => {
  const body = req.body as Partial<WorkerRecord>
  if (!body.worker_id) { res.status(400).json({ error: 'worker_id required' }); return }
  workers.set(body.worker_id, { ...body as WorkerRecord, last_seen: Date.now() })
  res.json({ ok: true })
})

app.get('/workers', (_req, res) => {
  const now = Date.now()
  const list = Array.from(workers.values()).map(w => ({
    ...w,
    alive: now - w.last_seen < 90_000,
  }))
  res.json(list)
})

const server = http.createServer(app)

const wss = new WebSocketServer({ noServer: true, perMessageDeflate: false })
setupWebSocket(wss)

const voiceWss = new WebSocketServer({ noServer: true })
setupVoiceProxy(voiceWss)

server.on('upgrade', (req, socket, head) => {
  const idx = (req.url || '').indexOf('?')
  const pathname = idx !== -1 ? (req.url || '').slice(0, idx) : (req.url || '')
  if (pathname === '/ws') {
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req))
  } else if (pathname === '/voice') {
    voiceWss.handleUpgrade(req, socket, head, (ws) => voiceWss.emit('connection', ws, req))
  } else {
    socket.destroy()
  }
})

const PORT = parseInt(process.env.GATEWAY_PORT || '8080', 10)
server.listen(PORT, () => {
  console.log(`[gateway] listening on :${PORT}`)
})
