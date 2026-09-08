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

const server = http.createServer(app)
const wss = new WebSocketServer({ server, path: '/ws' })
setupWebSocket(wss)
setupVoiceProxy(server)

const PORT = parseInt(process.env.GATEWAY_PORT || '8080', 10)
server.listen(PORT, () => {
  console.log(`[gateway] listening on :${PORT}`)
})
