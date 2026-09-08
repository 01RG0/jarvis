'use client'

import { useEffect, useRef } from 'react'

interface Props {
  active: boolean
  speaking: boolean
  size?: number
}

export default function ArcReactor({ active, speaking, size = 64 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frameRef = useRef<number>(0)
  const angleRef = useRef<number>(0)
  const pulseRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const s = size
    const cx = s / 2
    const cy = s / 2
    const r = s * 0.38

    function draw() {
      frameRef.current = requestAnimationFrame(draw)
      ctx!.clearRect(0, 0, s, s)

      const t = Date.now() / 1000
      angleRef.current = (angleRef.current + (speaking ? 0.06 : 0.015)) % (Math.PI * 2)
      pulseRef.current = 0.7 + 0.3 * Math.sin(t * (speaking ? 8 : 2))

      const alpha = active ? 1 : 0.35
      const glow = speaking ? 40 : 16

      // outer glow
      const grad = ctx!.createRadialGradient(cx, cy, r * 0.4, cx, cy, r * 1.4)
      grad.addColorStop(0, `rgba(100,200,255,${0.3 * pulseRef.current * alpha})`)
      grad.addColorStop(1, 'transparent')
      ctx!.fillStyle = grad
      ctx!.fillRect(0, 0, s, s)

      // ring segments
      const segments = 8
      for (let i = 0; i < segments; i++) {
        const a = (i / segments) * Math.PI * 2 + angleRef.current
        const a2 = a + (Math.PI * 2) / segments * 0.65
        ctx!.beginPath()
        ctx!.arc(cx, cy, r, a, a2)
        ctx!.arc(cx, cy, r * 0.72, a2, a, true)
        ctx!.closePath()
        ctx!.fillStyle = `rgba(80,200,255,${0.7 * alpha})`
        ctx!.fill()
      }

      // inner disc
      ctx!.beginPath()
      ctx!.arc(cx, cy, r * 0.58, 0, Math.PI * 2)
      ctx!.fillStyle = `rgba(10,30,60,${alpha})`
      ctx!.fill()
      ctx!.strokeStyle = `rgba(100,200,255,${0.9 * alpha})`
      ctx!.lineWidth = 1.5
      ctx!.stroke()

      // center star
      const star = 6
      ctx!.beginPath()
      for (let i = 0; i < star * 2; i++) {
        const ra = i % 2 === 0 ? r * 0.28 : r * 0.14
        const sa = (i / (star * 2)) * Math.PI * 2 - angleRef.current * 1.5
        if (i === 0) ctx!.moveTo(cx + Math.cos(sa) * ra, cy + Math.sin(sa) * ra)
        else ctx!.lineTo(cx + Math.cos(sa) * ra, cy + Math.sin(sa) * ra)
      }
      ctx!.closePath()
      ctx!.fillStyle = `rgba(150,230,255,${pulseRef.current * alpha})`
      ctx!.fill()

      // center dot
      ctx!.beginPath()
      ctx!.arc(cx, cy, r * 0.08, 0, Math.PI * 2)
      ctx!.fillStyle = `rgba(220,245,255,${alpha})`
      ctx!.fill()

      // shadow filter via box-shadow on canvas — just set canvas filter
      ctx!.shadowBlur = glow
      ctx!.shadowColor = `rgba(100,200,255,${0.8 * alpha})`
    }

    draw()
    return () => cancelAnimationFrame(frameRef.current)
  }, [active, speaking, size])

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className="select-none"
      style={{ filter: active ? `drop-shadow(0 0 ${speaking ? 12 : 6}px rgba(100,200,255,0.8))` : 'none' }}
    />
  )
}
