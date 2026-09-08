import { WebSocket, WebSocketServer } from 'ws'
import { IncomingMessage } from 'http'
import { verifyToken, extractToken } from './auth'
import { submitToBrain } from './brain_client'

export function setupWebSocket(wss: WebSocketServer): void {
  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const token = extractToken(req)
    if (!token || !verifyToken(token)) {
      ws.close(1008, 'Unauthorized')
      return
    }

    ws.on('message', async (data) => {
      let id = 'unknown'
      try {
        const msg = JSON.parse(data.toString()) as {
          id: string
          input: string
          model?: string
        }
        id = msg.id
        const result = await submitToBrain(msg.id, msg.input, msg.model)
        ws.send(JSON.stringify({ id: msg.id, ...result }))
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        ws.send(JSON.stringify({ id, error: message }))
      }
    })
  })
}
