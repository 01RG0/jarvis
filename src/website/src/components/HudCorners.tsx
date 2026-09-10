'use client';

// Decorative corner brackets — classic HUD motif
export default function HudCorners() {
  const corner = (pos: 'tl' | 'tr' | 'bl' | 'br') => {
    const isTop    = pos[0] === 't';
    const isLeft   = pos[1] === 'l';
    const size     = 22;
    const offset   = 16;
    return (
      <div
        key={pos}
        aria-hidden="true"
        style={{
          position: 'fixed',
          top:    isTop  ? offset : undefined,
          bottom: !isTop ? offset : undefined,
          left:   isLeft ? offset : undefined,
          right:  !isLeft ? offset : undefined,
          width:  size,
          height: size,
          borderTop:    isTop  ? '1.5px solid rgba(0,168,255,0.35)' : 'none',
          borderBottom: !isTop ? '1.5px solid rgba(0,168,255,0.35)' : 'none',
          borderLeft:   isLeft ? '1.5px solid rgba(0,168,255,0.35)' : 'none',
          borderRight:  !isLeft ? '1.5px solid rgba(0,168,255,0.35)' : 'none',
          pointerEvents: 'none',
        }}
      />
    );
  };

  return (
    <>
      {(['tl', 'tr', 'bl', 'br'] as const).map(corner)}
    </>
  );
}
