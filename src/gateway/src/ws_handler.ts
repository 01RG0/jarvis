import { WebSocket, WebSocketServer } from 'ws'
import { submitToBrain } from './brain_client'

export function setupWebSocket(wss: WebSocketServer): void {
  wss.on('connection', (ws: WebSocket) => {
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
        if (result.widget_cmd) {
          ws.send(JSON.stringify({ type: 'widget', ...result.widget_cmd }))
        }
        ws.send(JSON.stringify({ id: msg.id, result: result.result, model_used: result.model_used }))
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        ws.send(JSON.stringify({ id, error: message }))
      }
    })
  })
}
