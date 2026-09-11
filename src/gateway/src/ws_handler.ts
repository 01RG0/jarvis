import { WebSocket, WebSocketServer } from 'ws'
import { submitToBrain } from './brain_client'

const _START = Date.now()
let _activeTasks = 0

export function setupWebSocket(wss: WebSocketServer): void {
  wss.on('connection', (ws: WebSocket) => {
    const sendStatus = () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'status',
          uptime_seconds: Math.floor((Date.now() - _START) / 1000),
          active_tasks: _activeTasks,
        }))
      }
    }
    sendStatus()
    const statusTimer = setInterval(sendStatus, 10_000)

    ws.on('close', () => clearInterval(statusTimer))

    ws.on('message', async (data) => {
      let id = 'unknown'
      try {
        const msg = JSON.parse(data.toString()) as {
          id: string
          input: string
          model?: string
        }
        id = msg.id
        _activeTasks++
        sendStatus()
        const result = await submitToBrain(msg.id, msg.input, msg.model)
        _activeTasks--
        if (result.widget_cmd) {
          ws.send(JSON.stringify({ type: 'widget', ...result.widget_cmd }))
        }
        ws.send(JSON.stringify({ id: msg.id, result: result.result, model_used: result.model_used }))
      } catch (err: unknown) {
        _activeTasks = Math.max(0, _activeTasks - 1)
        const message = err instanceof Error ? err.message : String(err)
        ws.send(JSON.stringify({ id, error: message }))
      }
    })
  })
}
