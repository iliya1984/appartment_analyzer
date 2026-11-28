import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  clampView,
  fitView,
  focusView,
  panBy,
  type Size,
  type View,
  ZOOM_STEP,
  zoomAt,
} from './panZoom';

export interface PanZoomOptions {
  content: Size;
  /** When set, the view centres this normalised point at `focusZoom`; otherwise it fits. */
  focus: readonly [number, number] | null;
  focusZoom?: number;
  /** Changes of this key reset the view (e.g. another sheet). */
  resetKey: string;
  onInteract?: () => void;
}

/**
 * Drag to pan, wheel / pinch / double-click to zoom. Returns the viewport ref and the current
 * view; the caller applies `translate(x, y) scale(s)` to the content.
 */
export function usePanZoom({
  content,
  focus,
  focusZoom = 2.4,
  resetKey,
  onInteract,
}: PanZoomOptions) {
  const ref = useRef<HTMLDivElement>(null);
  const [vp, setVp] = useState<Size>({ w: 0, h: 0 });
  const [view, setView] = useState<View>({ s: 1, x: 0, y: 0 });
  const vpRef = useRef(vp);
  const contentRef = useRef(content);
  const interact = useRef(onInteract);
  useEffect(() => {
    vpRef.current = vp;
    contentRef.current = content;
    interact.current = onInteract;
  });

  const fu = focus?.[0];
  const fv = focus?.[1];
  const home = useCallback(
    (size: Size): View =>
      fu != null && fv != null
        ? focusView(size, contentRef.current, [fu, fv], focusZoom)
        : fitView(size, contentRef.current),
    [fu, fv, focusZoom],
  );

  // Track the viewport size.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setVp({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Reset when the sheet, the focus or the viewport size changes.
  useLayoutEffect(() => {
    setView(home(vp));
  }, [home, vp, resetKey]);

  const zoom = useCallback((k: number, px?: number, py?: number) => {
    const size = vpRef.current;
    setView((v) => zoomAt(v, k, px ?? size.w / 2, py ?? size.h / 2, size, contentRef.current));
  }, []);

  // Native listeners: wheel must be non-passive to stop the page from scrolling.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const pointers = new Map<number, { x: number; y: number }>();
    let pinch = 0;
    const local = (e: { clientX: number; clientY: number }) => {
      const r = el.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const p = local(e);
      zoom(Math.exp(-e.deltaY * 0.0015), p.x, p.y);
      interact.current?.();
    };
    const onDown = (e: PointerEvent) => {
      if ((e.target as Element).closest('button')) return;
      el.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    };
    const onMove = (e: PointerEvent) => {
      const p = pointers.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x;
      const dy = e.clientY - p.y;
      p.x = e.clientX;
      p.y = e.clientY;
      if (pointers.size === 1) {
        setView((v) => panBy(v, dx, dy, vpRef.current, contentRef.current));
        interact.current?.();
      } else if (pointers.size === 2) {
        const [a, b] = [...pointers.values()] as [typeof p, typeof p];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch) {
          const mid = local({ clientX: (a.x + b.x) / 2, clientY: (a.y + b.y) / 2 });
          zoom(d / pinch, mid.x, mid.y);
        }
        pinch = d;
      }
    };
    const onUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      pinch = 0;
    };
    const onDouble = (e: MouseEvent) => {
      if ((e.target as Element).closest('button')) return;
      const p = local(e);
      zoom(ZOOM_STEP * ZOOM_STEP, p.x, p.y);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    el.addEventListener('dblclick', onDouble);
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      el.removeEventListener('dblclick', onDouble);
    };
  }, [zoom]);

  return {
    ref,
    view,
    viewport: vp,
    zoomIn: () => zoom(ZOOM_STEP),
    zoomOut: () => zoom(1 / ZOOM_STEP),
    fit: () => setView(fitView(vpRef.current, contentRef.current)),
    reset: () => setView(home(vpRef.current)),
    pan: (dx: number, dy: number) =>
      setView((v) =>
        clampView({ ...v, x: v.x + dx, y: v.y + dy }, vpRef.current, contentRef.current),
      ),
  };
}
