'use client';

import { useRef, useState, useCallback, useEffect, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  id: string;
  defaultX?: number;
  defaultY?: number;
  defaultW?: number;
  defaultH?: number;
  minW?: number;
  minH?: number;
  style?: React.CSSProperties;
}

interface Rect { x: number; y: number; w: number; h: number }

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function loadRect(id: string): Partial<Rect> {
  try {
    const raw = localStorage.getItem(`jarvis-widget-${id}`);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveRect(id: string, r: Rect) {
  try { localStorage.setItem(`jarvis-widget-${id}`, JSON.stringify(r)); } catch {}
}

export default function DraggableWidget({
  children, id,
  defaultX, defaultY,
  defaultW = 0, defaultH = 0,
  minW = 200, minH = 120,
  style,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const resizing = useRef(false);
  const origin = useRef({ mx: 0, my: 0, px: 0, py: 0, pw: 0, ph: 0 });

  const [rect, setRect] = useState<Rect>(() => {
    const saved = loadRect(id);
    return {
      x: saved.x ?? (defaultX ?? (typeof window !== 'undefined' ? window.innerWidth / 2 - 200 : 200)),
      y: saved.y ?? (defaultY ?? (typeof window !== 'undefined' ? window.innerHeight / 2 - 150 : 150)),
      w: saved.w ?? defaultW,
      h: saved.h ?? defaultH,
    };
  });

  // Persist on change
  useEffect(() => { saveRect(id, rect); }, [id, rect]);

  // Clamp on resize
  useEffect(() => {
    function onResize() {
      setRect(r => ({
        ...r,
        x: clamp(r.x, 0, window.innerWidth  - (wrapRef.current?.offsetWidth  ?? 200)),
        y: clamp(r.y, 0, window.innerHeight - (wrapRef.current?.offsetHeight ?? 100)),
      }));
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Drag by header
  const onMouseDownDrag = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const header = wrapRef.current?.querySelector('[data-drag-handle]');
    if (!header?.contains(target)) return;
    e.preventDefault();
    dragging.current = true;
    origin.current = { mx: e.clientX, my: e.clientY, px: rect.x, py: rect.y, pw: rect.w, ph: rect.h };
    function onMove(ev: MouseEvent) {
      if (!dragging.current) return;
      const nx = origin.current.px + ev.clientX - origin.current.mx;
      const ny = origin.current.py + ev.clientY - origin.current.my;
      const w = wrapRef.current?.offsetWidth ?? 200;
      const h = wrapRef.current?.offsetHeight ?? 100;
      setRect(r => ({
        ...r,
        x: clamp(nx, 0, window.innerWidth  - w),
        y: clamp(ny, 0, window.innerHeight - h),
      }));
    }
    function onUp() {
      dragging.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [rect]);

  // Resize from bottom-right corner
  const onMouseDownResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizing.current = true;
    const w = wrapRef.current?.offsetWidth  ?? minW;
    const h = wrapRef.current?.offsetHeight ?? minH;
    origin.current = { mx: e.clientX, my: e.clientY, px: rect.x, py: rect.y, pw: w, ph: h };
    function onMove(ev: MouseEvent) {
      if (!resizing.current) return;
      const nw = origin.current.pw + ev.clientX - origin.current.mx;
      const nh = origin.current.ph + ev.clientY - origin.current.my;
      setRect(r => ({
        ...r,
        w: clamp(nw, minW, window.innerWidth  - r.x),
        h: clamp(nh, minH, window.innerHeight - r.y),
      }));
    }
    function onUp() {
      resizing.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [rect, minW, minH]);

  const sizeStyle: React.CSSProperties = {};
  if (rect.w > 0) sizeStyle.width  = rect.w;
  if (rect.h > 0) sizeStyle.height = rect.h;

  return (
    <div
      ref={wrapRef}
      data-draggable-widget={id}
      onMouseDown={onMouseDownDrag}
      style={{
        position: 'fixed',
        left: rect.x,
        top:  rect.y,
        zIndex: 60,
        userSelect: 'none',
        ...sizeStyle,
        ...style,
      }}
    >
      {children}

      {/* Resize handle — bottom-right corner */}
      <div
        onMouseDown={onMouseDownResize}
        title="Drag to resize"
        style={{
          position: 'absolute',
          bottom: 0, right: 0,
          width: 14, height: 14,
          cursor: 'se-resize',
          zIndex: 5,
          display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end',
          padding: 3,
        }}
      >
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
          <path d="M7 1L1 7M7 4L4 7M7 7" stroke="rgba(0,168,255,0.35)" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
      </div>
    </div>
  );
}
