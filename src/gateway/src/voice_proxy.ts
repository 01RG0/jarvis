import { WebSocketServer, WebSocket } from 'ws'
import { IncomingMessage } from 'http'

const VOICE_WS_URL = process.env.VOICE_WS_URL || 'ws://localhost:8765'

export function setupVoiceProxy(wss: WebSocketServer): void {
  wss.on('connection', (client: WebSocket, req: IncomingMessage) => {
    const upstream = new WebSocket(VOICE_WS_URL)
    let upstreamReady = false
    const pendingFrames: Buffer[] = []

    upstream.on('open', () => {
      upstreamReady = true
      for (const frame of pendingFrames) {
        upstream.send(frame)
      }
      pendingFrames.length = 0
    })

    upstream.on('message', (data) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data)
      }
    })

    upstream.on('close', (code, reason) => {
      client.close(code, reason)
    })

    upstream.on('error', (err) => {
      console.error('[voice-proxy] upstream error:', err.message)
      client.close(1011, 'upstream error')
    })

    client.on('message', (data) => {
      if (upstreamReady) {
        upstream.send(data)
      } else {
        pendingFrames.push(Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer))
      }
    })

    client.on('close', () => {
      if (upstream.readyState !== WebSocket.CLOSED) {
        upstream.close()
      }
    })
  })

  console.log('[gateway] voice proxy ready at /voice → ' + VOICE_WS_URL)
}
