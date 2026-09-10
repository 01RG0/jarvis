'use client'

import { useEffect, useRef } from 'react'

export type OrbState = 'idle' | 'connecting' | 'listening' | 'thinking' | 'speaking' | 'error'

interface Props {
  state: OrbState
  volume?: number
  size?: number
  onClick?: () => void
  interactive?: boolean
}

const VERTEX_SHADER = `
attribute vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`

const FRAGMENT_SHADER = `
precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_rotation;
uniform float u_listen;
uniform float u_speak;
uniform float u_idle;

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 p = (uv - 0.5) * 2.0;
  float radius = length(p);
  float edge = 1.0 - smoothstep(0.993, 1.0, radius);
  if (edge <= 0.0) discard;

  float angle = atan(p.y, p.x);
  float warpStrength = 0.026 + u_speak * 0.105;
  float angularWarp =
    sin(angle * 3.0 - u_time * 0.54 + radius * 2.1) +
    0.48 * sin(angle * 5.0 + u_time * 0.31 - radius * 3.7) +
    0.22 * sin(angle * 8.0 - u_time * 0.19 + radius * 5.2);
  float phase =
    angle - 1.78 - u_rotation + angularWarp * warpStrength * (0.2 + radius * 0.8);

  float lobeField = cos(phase * 2.0);
  float darkMix = smoothstep(-0.04, 0.38, lobeField);

  vec3 deepBlue = vec3(0.004, 0.105, 0.37);
  vec3 cobalt    = vec3(0.015, 0.34, 0.76);
  vec3 aqua      = vec3(0.24, 0.76, 0.79);
  vec3 paleAqua  = vec3(0.77, 0.96, 0.95);

  float radialLight = 0.5 + 0.5 * sin(radius * 3.0 - u_time * 0.16);
  vec3 darkColor = mix(cobalt, deepBlue, 0.42 + 0.38 * radius);
  float darkRay = pow(max(lobeField, 0.0), 11.0);
  darkColor = mix(darkColor, aqua, darkRay * (0.18 + radialLight * 0.16));

  vec3 lightColor = mix(paleAqua, aqua, 0.5 + 0.2 * sin(radius * 3.4 + phase * 2.0));
  float lightRay = pow(max(-lobeField, 0.0), 5.0);
  lightColor = mix(lightColor, vec3(0.04, 0.42, 0.64), lightRay * 0.28);

  vec3 color = mix(lightColor, darkColor, darkMix);

  float secondaryRay = 0.5 + 0.5 * sin(phase * 6.0 + radius * 1.8 - u_time * 0.42);
  float rayStrength = (0.055 + u_speak * 0.045) * (0.25 + radius * 0.75);
  color = mix(color, vec3(0.26, 0.76, 0.8), secondaryRay * rayStrength);

  float rimWave =
    0.063 * sin(angle * 3.0 + u_time * 1.34) +
    0.036 * sin(angle * 5.0 - u_time * 0.91 + 1.4) +
    0.021 * sin(angle * 7.0 + u_time * 0.63 - 0.8) +
    0.012 * sin(angle * 11.0 - u_time * 1.72 + sin(angle * 2.0 + u_time * 0.58));
  rimWave *= 1.0 + u_listen * 0.38;
  float rimInner = 0.82 + rimWave - u_listen * 0.2;
  float rim = smoothstep(rimInner - 0.02, rimInner + 0.015, radius);
  float rimStrength = rim * (0.3 + u_listen * 0.3);
  vec3 membrane = mix(
    vec3(0.47, 0.84, 0.84),
    vec3(0.76, 0.93, 0.92),
    smoothstep(0.78, 1.0, radius)
  );
  color = mix(color, membrane, clamp(rimStrength, 0.0, 0.72));

  float seamDirection = max(0.0, -sin(phase * 2.0));
  float seamExponent = mix(30.0, 3.2, smoothstep(0.05, 1.0, radius));
  float seam = pow(seamDirection, seamExponent) * (0.78 + radius * 0.25);
  color = mix(color, vec3(0.985, 0.995, 0.995), clamp(seam, 0.0, 0.96));

  // Error state: red tint
  float errTint = u_idle * 0.0; // placeholder uniform slot
  color = mix(color, vec3(0.9, 0.1, 0.1), 0.0);

  gl_FragColor = vec4(color * edge, edge);
}
`

function clamp01(v: number) { return Math.min(1, Math.max(0, v)) }

function follow(current: number, target: number, riseMs: number, fallMs: number, dt: number) {
  const dMs = target > current ? riseMs : fallMs
  if (dMs <= 0) return target
  const rate = 1 - Math.pow(0.1, (dt * 1000) / dMs)
  return current + (target - current) * rate
}

export default function JarvisOrb({ state, volume = 0, size = 280, onClick, interactive = true }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef(state)
  const volumeRef = useRef(volume)

  useEffect(() => { stateRef.current = state }, [state])
  useEffect(() => { volumeRef.current = volume }, [volume])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
    const px = Math.round(size * pixelRatio)
    canvas.width = px
    canvas.height = px

    const gl = canvas.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: true })
    if (!gl) return

    function compile(type: number, src: string) {
      const s = gl!.createShader(type)!
      gl!.shaderSource(s, src); gl!.compileShader(s)
      if (!gl!.getShaderParameter(s, gl!.COMPILE_STATUS)) { gl!.deleteShader(s); return null }
      return s
    }

    const vs = compile(gl.VERTEX_SHADER, VERTEX_SHADER)
    const fs = compile(gl.FRAGMENT_SHADER, FRAGMENT_SHADER)
    if (!vs || !fs) return

    const prog = gl.createProgram()!
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return

    const buf = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW)

    const posLoc = gl.getAttribLocation(prog, 'a_position')
    const resLoc = gl.getUniformLocation(prog, 'u_resolution')
    const timeLoc = gl.getUniformLocation(prog, 'u_time')
    const rotLoc = gl.getUniformLocation(prog, 'u_rotation')
    const lisLoc = gl.getUniformLocation(prog, 'u_listen')
    const spkLoc = gl.getUniformLocation(prog, 'u_speak')

    gl.viewport(0, 0, px, px)
    gl.useProgram(prog)
    gl.enableVertexAttribArray(posLoc)
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0)
    gl.uniform2f(resLoc, px, px)

    let frame = 0
    let prev = performance.now()
    let motionTime = 0
    let rotation = 0, rotVel = 0
    let calmClock = 0, speakClock = 0
    let listenE = 0, speakE = 0
    let speakingBlend = 0
    let motionSpeed = 0.6

    const render = (now: number) => {
      const dt = Math.min((now - prev) / 1000, 0.05)
      prev = now
      const s = stateRef.current
      const vol = clamp01(Math.pow(clamp01(volumeRef.current), 0.8))

      const lisTarget = s === 'listening' ? vol : 0
      const spkTarget = s === 'speaking' ? vol : 0
      listenE = follow(listenE, lisTarget, 80, 400, dt)
      speakE  = follow(speakE, spkTarget, 80, 400, dt)

      let targetSpeed = 0.6
      if (s === 'connecting') targetSpeed = 0.7
      else if (s === 'listening') targetSpeed = 0.65 + listenE * 0.5
      else if (s === 'thinking') targetSpeed = 0.85
      else if (s === 'speaking') targetSpeed = 0.8 + speakE * 0.6
      else if (s === 'error') targetSpeed = 0.3

      motionSpeed = follow(motionSpeed, targetSpeed, 600, 600, dt)
      speakingBlend = follow(speakingBlend, s === 'speaking' ? 1 : 0, 400, 400, dt)

      motionTime += dt * motionSpeed
      calmClock  += dt * 0.62
      speakClock += dt * Math.max(0.65, 1.2 + speakE * 1.35 + Math.sin(motionTime * 1.73) * 0.34)

      const calmTarget = Math.sin(calmClock) * 0.15 + Math.sin(calmClock * 0.47 + 1.1) * 0.032
      const spkTarget2 = Math.sin(speakClock * 1.08) * (0.13 + speakE * 0.17) +
                         Math.sin(speakClock * 2.47 + 0.9) * (0.035 + speakE * 0.035) +
                         Math.sin(speakClock * 0.43 - 0.5) * 0.055
      const rotTarget = (calmTarget + (spkTarget2 - calmTarget) * speakingBlend) * 1.2

      const resp = 4.2 + speakingBlend * 3
      rotVel += ((rotTarget - rotation) * resp * resp - rotVel * 2 * resp) * dt
      rotation += rotVel * dt

      gl!.uniform1f(timeLoc, motionTime)
      gl!.uniform1f(rotLoc, rotation)
      gl!.uniform1f(lisLoc, listenE)
      gl!.uniform1f(spkLoc, speakE)
      gl!.drawArrays(gl!.TRIANGLES, 0, 6)

      frame = requestAnimationFrame(render)
    }
    frame = requestAnimationFrame(render)
    return () => {
      cancelAnimationFrame(frame)
      gl.deleteProgram(prog)
      gl.deleteBuffer(buf)
      gl.deleteShader(vs)
      gl.deleteShader(fs)
    }
  }, [size])

  const ringColor = {
    idle: 'rgba(30,60,120,0.4)',
    connecting: 'rgba(30,100,200,0.6)',
    listening: 'rgba(50,200,210,0.7)',
    thinking: 'rgba(100,180,255,0.6)',
    speaking: 'rgba(100,230,230,0.8)',
    error: 'rgba(220,50,50,0.7)',
  }[state]

  const ringBlur = state === 'speaking' ? '24px' : state === 'listening' ? '18px' : '12px'

  return (
    <div
      style={{ position: 'relative', width: size, height: size, cursor: interactive ? 'pointer' : 'default' }}
      onClick={interactive ? onClick : undefined}
    >
      {/* glow ring */}
      <div style={{
        position: 'absolute', inset: -8,
        borderRadius: '50%',
        boxShadow: `0 0 ${ringBlur} ${ringColor}, 0 0 48px ${ringColor}`,
        transition: 'box-shadow 600ms ease',
        pointerEvents: 'none',
      }} />
      <canvas
        ref={canvasRef}
        style={{ width: size, height: size, borderRadius: '50%', display: 'block' }}
        aria-label={`Jarvis orb — ${state}`}
      />
      {/* state label */}
      <div style={{
        position: 'absolute', bottom: -28, left: 0, right: 0,
        textAlign: 'center', fontSize: 11, letterSpacing: '0.15em',
        color: state === 'error' ? '#f87171' : 'rgba(100,200,220,0.7)',
        textTransform: 'uppercase', transition: 'color 400ms',
      }}>
        {state}
      </div>
    </div>
  )
}
