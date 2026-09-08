import { useState, useEffect, useRef } from 'react'

export function useWebSocket(url: string) {
  const [lastMessage, setLastMessage] = useState<string | null>(null)
  const [readyState, setReadyState] = useState<number>(WebSocket.CONNECTING)
  const wsRef = useRef<WebSocket | null>(null)
  const retriesRef = useRef(0)

  useEffect(() => {
    function connect() {
      const ws = new WebSocket(url)
      wsRef.current = ws
      setReadyState(WebSocket.CONNECTING)

      ws.onopen = () => { setReadyState(WebSocket.OPEN); retriesRef.current = 0 }
      ws.onclose = () => {
        setReadyState(WebSocket.CLOSED)
        if (retriesRef.current < 3) {
          retriesRef.current++
          setTimeout(connect, 2000)
        }
      }
      ws.onmessage = (e) => setLastMessage(e.data)
    }
    connect()
    return () => { wsRef.current?.close() }
  }, [url])

  function sendMessage(data: string) {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(data)
    }
  }

  return { sendMessage, lastMessage, readyState }
}
