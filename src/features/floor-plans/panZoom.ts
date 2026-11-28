/** Pan / zoom math for the plan viewer (pure, unit-tested). Content is drawn at (x, y) with scale s. */

export interface View {
  s: number;
  x: number;
  y: number;
}

export interface Size {
  w: number;
  h: number;
}

/** Furthest zoom-in, relative to the fit scale. */
export const MAX_ZOOM = 8;
export const ZOOM_STEP = 1.5;

export function fitScale(vp: Size, content: Size): number {
  if (vp.w <= 0 || vp.h <= 0 || content.w <= 0 || content.h <= 0) return 1;
  return Math.min(vp.w / content.w, vp.h / content.h);
}

/** Keeps the content on screen: centred on an axis where it is smaller than the viewport. */
export function clampView(v: View, vp: Size, content: Size): View {
  const fit = fitScale(vp, content);
  const s = Math.min(Math.max(v.s, fit), fit * MAX_ZOOM);
  const cw = content.w * s;
  const ch = content.h * s;
  const x = cw <= vp.w ? (vp.w - cw) / 2 : Math.min(0, Math.max(vp.w - cw, v.x));
  const y = ch <= vp.h ? (vp.h - ch) / 2 : Math.min(0, Math.max(vp.h - ch, v.y));
  return { s, x, y };
}

export function fitView(vp: Size, content: Size): View {
  return clampView({ s: fitScale(vp, content), x: 0, y: 0 }, vp, content);
}

/** Zooms by `k` keeping the viewport point (px, py) fixed. */
export function zoomAt(v: View, k: number, px: number, py: number, vp: Size, content: Size): View {
  const fit = fitScale(vp, content);
  const s = Math.min(Math.max(v.s * k, fit), fit * MAX_ZOOM);
  const r = s / v.s;
  return clampView({ s, x: px - (px - v.x) * r, y: py - (py - v.y) * r }, vp, content);
}

/** Centres the normalised content point (u, v) at `zoom` × the fit scale. */
export function focusView(
  vp: Size,
  content: Size,
  point: readonly [number, number],
  zoom: number,
): View {
  const s = fitScale(vp, content) * zoom;
  return clampView(
    { s, x: vp.w / 2 - point[0] * content.w * s, y: vp.h / 2 - point[1] * content.h * s },
    vp,
    content,
  );
}

export const panBy = (v: View, dx: number, dy: number, vp: Size, content: Size): View =>
  clampView({ s: v.s, x: v.x + dx, y: v.y + dy }, vp, content);

/** Zoom relative to the fit scale (1 = whole sheet visible). */
export const relativeZoom = (v: View, vp: Size, content: Size): number =>
  v.s / fitScale(vp, content);
