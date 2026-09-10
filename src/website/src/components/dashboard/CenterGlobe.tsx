'use client';

import dynamic from 'next/dynamic';
import type { OrbState } from '@/lib/types';

const JarvisOrbCanvas = dynamic(() => import('@/components/JarvisOrbCanvas'), { ssr: false });

interface CenterGlobeProps {
  orbState: OrbState;
}

export default function CenterGlobe({ orbState }: CenterGlobeProps) {
  return (
    <div
      className="dashboard-panel relative flex flex-col items-center justify-center overflow-hidden"
      role="img"
      aria-label="JARVIS AI Core globe visualization"
    >
      {/* Background space effect */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(0,40,80,0.4) 0%, rgba(0,8,20,0.8) 60%, rgba(0,4,12,0.95) 100%)',
        }}
        aria-hidden="true"
      />

      {/* Dot star field */}
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage: 'radial-gradient(rgba(0,212,255,0.6) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          backgroundPosition: '20px 20px',
        }}
        aria-hidden="true"
      />

      {/* Orbit rings */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none" aria-hidden="true">
        {/* Outer ring */}
        <div
          className="absolute rounded-full animate-orbit-slow"
          style={{
            width: '320px',
            height: '320px',
            border: '1px solid rgba(0,212,255,0.12)',
            transform: 'rotateX(70deg)',
          }}
        />
        {/* Middle ring */}
        <div
          className="absolute rounded-full animate-orbit-reverse"
          style={{
            width: '260px',
            height: '260px',
            border: '1px solid rgba(0,212,255,0.08)',
            transform: 'rotateX(70deg)',
          }}
        />
        {/* Inner ring */}
        <div
          className="absolute rounded-full animate-orbit-medium"
          style={{
            width: '200px',
            height: '200px',
            border: '1px solid rgba(0,212,255,0.06)',
            transform: 'rotateX(70deg)',
          }}
        />

        {/* Orbit dot on outer ring */}
        <div
          className="absolute"
          style={{
            width: '320px',
            height: '320px',
            animation: 'orbitRotate 12s linear infinite',
            transformOrigin: '50% 50%',
          }}
        >
          <div
            className="absolute w-2 h-2 rounded-full"
            style={{
              top: '50%',
              right: '-4px',
              transform: 'translateY(-50%)',
              background: 'var(--jarvis-cyan)',
              boxShadow: '0 0 8px rgba(0,212,255,0.8)',
            }}
          />
        </div>
      </div>

      {/* 3D Orb canvas */}
      <div className="relative w-52 h-52 z-10" aria-hidden="true">
        <JarvisOrbCanvas state={orbState} audioLevel={0} className="w-full h-full" />
      </div>

      {/* JARVIS text overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-20" aria-hidden="true">
        <div
          className="font-bold tracking-[0.35em] uppercase jarvis-glow"
          style={{
            fontSize: '28px',
            color: 'var(--jarvis-cyan)',
            textShadow: '0 0 20px rgba(0,212,255,0.7), 0 0 60px rgba(0,212,255,0.3)',
            letterSpacing: '0.35em',
            marginBottom: '4px',
          }}
        >
          JARVIS
        </div>
        <div
          className="text-[10px] tracking-[0.25em] uppercase"
          style={{ color: 'rgba(120,169,198,0.6)' }}
        >
          AI CORE
        </div>
        <div
          className="text-[9px] tracking-widest mt-0.5"
          style={{ color: 'rgba(0,212,255,0.35)' }}
        >
          v3.0.0
        </div>
      </div>

      {/* Bottom glow */}
      <div
        className="absolute bottom-0 left-0 right-0 h-16 pointer-events-none"
        style={{
          background: 'linear-gradient(to top, rgba(0,30,60,0.6), transparent)',
        }}
        aria-hidden="true"
      />
    </div>
  );
}
