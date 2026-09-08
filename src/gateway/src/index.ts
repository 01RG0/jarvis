import 'dotenv/config'
import express from 'express'
import http from 'http'
import { WebSocketServer } from 'ws'
import { setupWebSocket } from './ws_handler'

const app = express()
app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

const server = http.createServer(app)
const wss = new WebSocketServer({ server })
setupWebSocket(wss)

const PORT = parseInt(process.env.GATEWAY_PORT || '8080', 10)
server.listen(PORT, () => {
  console.log(`[gateway] listening on :${PORT}`)
})
