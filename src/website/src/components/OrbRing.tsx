'use client';

import { useRef, useEffect } from 'react';
import { OrbState } from '@/lib/types';

interface OrbRingProps {
  state: OrbState;
  size?: number;
  onClick?: () => void;
}

export default function OrbRing({ state, size = 340, onClick }: OrbRingProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<OrbState>(state);
  const rafRef = useRef<number>(0);
  const startTimeRef = useRef<number>(performance.now());

  useEffect(() => { stateRef.current = state; }, [state]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;

    const maybeCtx = canvas.getContext('2d');
    if (!maybeCtx) return;
    const ctx: CanvasRenderingContext2D = maybeCtx;
    ctx.scale(dpr, dpr);

    const cx = size / 2;
    const cy = size / 2;

    const R = {
      outerDot:     size * 0.478,
      outerRing:    size * 0.455,
      tick:         size * 0.405,
      arc:          size * 0.348,
      main:         size * 0.332,
      innerA:       size * 0.295,
      innerB:       size * 0.268,
      fill:         size * 0.260,
      textR:        size * 0.170,
    };

    // Arc segments: { startAngle, length (rad), speed multiplier, alpha, lineWidth, reverse }
    const arcs = [
      { a: 0.2,  len: 1.1,  spd: 0.55,  alpha: 0.92, lw: 3.5, rev: false },
      { a: 2.6,  len: 0.7,  spd: 0.30,  alpha: 0.70, lw: 2.5, rev: false },
      { a: 4.2,  len: 0.9,  spd: 0.70,  alpha: 0.80, lw: 3.0, rev: false },
      { a: 1.5,  len: 0.45, spd: 0.42,  alpha: 0.55, lw: 1.8, rev: true  },
    ];

    type C = { ring: string; glow: string; r: number; g: number; b: number };

    function stateColor(s: OrbState): C {
      switch (s) {
        case 'listening': return { ring: '#00e5ff', glow: 'rgba(0,229,255,0.9)',   r: 0,   g: 229, b: 255 };
        case 'thinking':  return { ring: '#7c3aed', glow: 'rgba(124,58,237,0.85)', r: 124, g: 58,  b: 237 };
        case 'speaking':  return { ring: '#fbbf24', glow: 'rgba(251,191,36,0.85)', r: 251, g: 191, b: 36  };
        case 'error':     return { ring: '#ef4444', glow: 'rgba(239,68,68,0.80)',  r: 239, g: 68,  b: 68  };
        default:          return { ring: '#00a8ff', glow: 'rgba(0,168,255,0.80)',  r: 0,   g: 168, b: 255 };
      }
    }

    function arcBaseSpeed(s: OrbState): number {
      switch (s) {
        case 'listening': return 2.4;
        case 'thinking':  return 5.0;
        case 'speaking':  return 2.0;
        case 'error':     return 0.3;
        default:          return 0.6;
      }
    }

    function glowPulse(s: OrbState, t: number): number {
      switch (s) {
        case 'idle':      return 18 + Math.sin(t * 0.65) * 10;
        case 'listening': return 36 + Math.sin(t * 3.0)  * 12;
        case 'thinking':  return 28 + Math.sin(t * 4.5)  * 14;
        case 'speaking':  return 26 + Math.sin(t * 5.2)  * 16 + Math.sin(t * 9.1) * 5;
        case 'error':     return 10 + Math.sin(t * 1.2)  * 5;
      }
    }

    function ringAlpha(s: OrbState, t: number): number {
      switch (s) {
        case 'idle':      return 0.52 + Math.sin(t * 0.65) * 0.14;
        case 'listening': return 0.94 + Math.sin(t * 3.2)  * 0.05;
        case 'thinking':  return 0.80 + Math.sin(t * 4.5)  * 0.13;
        case 'speaking':  return 0.84 + Math.sin(t * 5.2)  * 0.14;
        case 'error':     return 0.36 + Math.sin(t * 1.2)  * 0.10;
      }
    }

    function drawTextWithSpacing(text: string, x: number, y: number, spacing: number) {
      const chars = text.split('');
      const widths = chars.map(ch => ctx.measureText(ch).width);
      const totalW = widths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1);
      let cursor = x - totalW / 2;
      for (let i = 0; i < chars.length; i++) {
        ctx.fillText(chars[i], cursor + widths[i] / 2, y);
        cursor += widths[i] + spacing;
      }
    }

    function draw(timestamp: number) {
      const t = (timestamp - startTimeRef.current) / 1000;
      const s = stateRef.current;
      const c = stateColor(s);
      const spd = arcBaseSpeed(s);
      const blur = glowPulse(s, t);
      const alpha = ringAlpha(s, t);
      const rOff = s === 'speaking' ? Math.sin(t * 5.2) * 4 + Math.sin(t * 8.3) * 1.5 : 0;

      ctx.clearRect(0, 0, size, size);

      // === 1. Outer faint dot ring ===
      const dotCount = 72;
      for (let i = 0; i < dotCount; i++) {
        const angle = (i / dotCount) * Math.PI * 2;
        const rotOff = s === 'thinking' ? t * 0.25 : 0;
        const a = angle + rotOff;
        const da = 0.18 + Math.sin(t * 0.4 + i * 0.25) * 0.05;
        ctx.beginPath();
        ctx.arc(
          cx + Math.cos(a) * R.outerDot,
          cy + Math.sin(a) * R.outerDot,
          1.2, 0, Math.PI * 2
        );
        ctx.fillStyle = `rgba(${c.r},${c.g},${c.b},${da})`;
        ctx.fill();
      }

      // === 2. Outer hairline ring ===
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, R.outerRing, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${c.r},${c.g},${c.b},0.10)`;
      ctx.lineWidth = 0.6;
      ctx.stroke();
      ctx.restore();

      // === 3. Tick ring (72 ticks) ===
      for (let i = 0; i < 72; i++) {
        const angle = (i / 72) * Math.PI * 2 - Math.PI / 2;
        const isCardinal = i % 18 === 0;
        const isMajor   = i % 6  === 0;
        const len = isCardinal ? 11 : (isMajor ? 6.5 : 3.5);
        const ta  = isCardinal ? 0.60 : (isMajor ? 0.38 : 0.16);
        const lw  = isCardinal ? 1.5  : (isMajor ? 1.0  : 0.65);
        ctx.beginPath();
        ctx.moveTo(
          cx + Math.cos(angle) * (R.tick - len),
          cy + Math.sin(angle) * (R.tick - len)
        );
        ctx.lineTo(
          cx + Math.cos(angle) * R.tick,
          cy + Math.sin(angle) * R.tick
        );
        ctx.strokeStyle = `rgba(${c.r},${c.g},${c.b},${ta})`;
        ctx.lineWidth = lw;
        ctx.stroke();
      }

      // === 4. Arc segments ===
      for (const seg of arcs) {
        const dir = seg.rev ? -1 : 1;
        const a0 = seg.a + dir * t * seg.spd * spd;
        ctx.save();
        ctx.shadowBlur = 16;
        ctx.shadowColor = c.glow;
        ctx.beginPath();
        ctx.arc(cx, cy, R.arc + rOff, a0, a0 + seg.len);
        ctx.strokeStyle = `rgba(${c.r},${c.g},${c.b},${seg.alpha * alpha})`;
        ctx.lineWidth = seg.lw;
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.restore();
      }

      // Extra counter-rotating ring in thinking state
      if (s === 'thinking') {
        ctx.save();
        ctx.shadowBlur = 12;
        ctx.shadowColor = 'rgba(167,139,250,0.7)';
        ctx.beginPath();
        ctx.arc(cx, cy, R.arc + 16, -t * 3.0, -t * 3.0 + 1.0);
        ctx.strokeStyle = `rgba(167,139,250,${alpha * 0.7})`;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.restore();
      }

      // Speaking: animated audio waveform bars radiating outward
      if (s === 'speaking') {
        const waveCount = 40;
        ctx.save();
        ctx.shadowBlur = 8;
        ctx.shadowColor = c.glow;
        for (let i = 0; i < waveCount; i++) {
          const angle = (i / waveCount) * Math.PI * 2;
          // Multi-frequency wave: voice-like envelope
          const primary   = Math.abs(Math.sin(t * 9.1  + i * 0.55)) * 8;
          const secondary = Math.abs(Math.sin(t * 14.3 + i * 1.10)) * 4;
          const tertiary  = Math.abs(Math.sin(t * 6.7  + i * 0.30)) * 3;
          const waveMag   = 2 + primary + secondary + tertiary;
          const barAlpha  = 0.45 + (primary / 8) * 0.45;
          const r0 = R.main + rOff + 5;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(angle) * r0, cy + Math.sin(angle) * r0);
          ctx.lineTo(cx + Math.cos(angle) * (r0 + waveMag), cy + Math.sin(angle) * (r0 + waveMag));
          ctx.strokeStyle = `rgba(${c.r},${c.g},${c.b},${barAlpha})`;
          ctx.lineWidth = 2;
          ctx.stroke();
        }
        ctx.restore();
      }

      // Listening: expanding pulse ring
      if (s === 'listening') {
        const pulseT  = (t * 1.4) % 1;
        const pulseR  = R.tick + pulseT * 28;
        const pulseA  = (1 - pulseT) * 0.35;
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, pulseR, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${c.r},${c.g},${c.b},${pulseA})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
        // second pulse, offset by half period
        const pulseT2 = ((t * 1.4) + 0.5) % 1;
        const pulseR2 = R.tick + pulseT2 * 28;
        const pulseA2 = (1 - pulseT2) * 0.22;
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, pulseR2, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${c.r},${c.g},${c.b},${pulseA2})`;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
      }

      // === 5. Main glow ring — multi-pass for cinematic bloom ===
      const mr = R.main + rOff;
      // Pass 1: wide soft bloom
      ctx.save();
      ctx.shadowBlur = blur * 2.2;
      ctx.shadowColor = `rgba(${c.r},${c.g},${c.b},0.35)`;
      ctx.beginPath();
      ctx.arc(cx, cy, mr, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${c.r},${c.g},${c.b},${alpha * 0.4})`;
      ctx.lineWidth = 8;
      ctx.stroke();
      ctx.restore();
      // Pass 2: medium glow
      ctx.save();
      ctx.shadowBlur = blur;
      ctx.shadowColor = c.glow;
      ctx.beginPath();
      ctx.arc(cx, cy, mr, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${c.r},${c.g},${c.b},${alpha})`;
      ctx.lineWidth = 3.5;
      ctx.stroke();
      ctx.restore();
      // Pass 3: bright core line
      ctx.save();
      ctx.shadowBlur = blur * 0.5;
      ctx.shadowColor = '#ffffff';
      ctx.beginPath();
      ctx.arc(cx, cy, mr - 1.5, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.35})`;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();

      // === 6. Inner detail rings ===
      ctx.save();
      ctx.shadowBlur = 5;
      ctx.shadowColor = c.glow;
      ctx.beginPath();
      ctx.arc(cx, cy, R.innerA + rOff * 0.4, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${c.r},${c.g},${c.b},${alpha * 0.30})`;
      ctx.lineWidth = 0.8;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, R.innerB + rOff * 0.2, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${c.r},${c.g},${c.b},${alpha * 0.16})`;
      ctx.lineWidth = 0.6;
      ctx.stroke();
      ctx.restore();

      // === 7. Center dark fill ===
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, R.fill);
      grad.addColorStop(0,    `rgba(${c.r * 0.05},${c.g * 0.04},${c.b * 0.08},0.99)`);
      grad.addColorStop(0.60, 'rgba(6,9,16,0.98)');
      grad.addColorStop(0.90, 'rgba(4,7,13,0.97)');
      grad.addColorStop(1,    'rgba(2,5,10,0.95)');
      ctx.beginPath();
      ctx.arc(cx, cy, R.fill + rOff * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      // === 8. JARVIS text with letter-spacing ===
      ctx.save();
      const fontSize = Math.round(size * 0.0565);
      ctx.font = `600 ${fontSize}px 'Rajdhani', 'Fira Code', monospace`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.shadowBlur = 18;
      ctx.shadowColor = `rgba(${c.r},${c.g},${c.b},0.6)`;
      ctx.fillStyle = `rgba(255,255,255,${0.92 + Math.sin(t * 0.55) * 0.05})`;
      const spacing = fontSize * 0.22;
      drawTextWithSpacing('JARVIS', cx, cy, spacing);
      ctx.restore();

      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [size]);

  return (
    <div
      style={{ position: 'relative', display: 'inline-block', cursor: onClick ? 'pointer' : 'default' }}
      onClick={onClick}
      title={onClick ? 'Click to toggle voice' : undefined}
    >
      <canvas
        ref={canvasRef}
        style={{ width: size, height: size, display: 'block' }}
        aria-label={`JARVIS orb — ${state}`}
        role="img"
      />
    </div>
  );
}
