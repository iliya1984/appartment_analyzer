import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import type { PlanPoint, PlanSheet } from '@/domain/floorPlans';
import { he } from '@/i18n/he';
import { cx } from '@/shared/lib/cx';
import { IconButton } from '@/shared/ui/Button';
import styles from './PlanBrowser.module.css';
import type { SheetImage } from './sheetImages';
import { usePanZoom } from './usePanZoom';

const T = he.plans;

export interface Hotspot {
  planType: string;
  point: PlanPoint;
  apartmentId: string;
  /** Unit number shown on the chip. */
  number: number;
  /** Tooltip / accessible name. */
  title: string;
  current: boolean;
  /** Filtered out by the current filters (shown muted). */
  muted: boolean;
}

export interface PlanViewerProps {
  sheet: PlanSheet;
  image: SheetImage | null;
  alt: string;
  hotspots: readonly Hotspot[];
  /** Unit mode: zoom to this point. */
  focus: PlanPoint | null;
  /** Hand-drawn outline of the current unit (dims everything else). */
  region: readonly PlanPoint[] | null;
  /** Marker for the current unit when there is no outline. */
  marker: PlanPoint | null;
  onOpenApartment: (id: string) => void;
  /** Start / centre of the toolbar row (mode switch, caption). */
  toolbar: ReactNode;
  onSheetAbove?: (() => void) | undefined;
  onSheetBelow?: (() => void) | undefined;
  /** Rendered under the stage (notes, disclaimer). */
  footer?: ReactNode;
}

function useFullscreen() {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const sync = () => setOn(document.fullscreenElement === ref.current && ref.current != null);
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);
  const toggle = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else if (typeof el.requestFullscreen === 'function') {
      el.requestFullscreen().catch(() => setOn((v) => !v));
    } else {
      setOn((v) => !v); // CSS fallback (iOS Safari)
    }
  }, []);
  return { ref, on, toggle, exit: () => setOn(false) };
}

/** The sheet image with pan / zoom, unit hotspots and the highlight of the current unit. */
export function PlanViewer({
  sheet,
  image,
  alt,
  hotspots,
  focus,
  region,
  marker,
  onOpenApartment,
  toolbar,
  onSheetAbove,
  onSheetBelow,
  footer,
}: PlanViewerProps) {
  const content = { w: sheet.width, h: sheet.height };
  const {
    ref: stageRef,
    view,
    zoomIn,
    zoomOut,
    fit,
    pan,
  } = usePanZoom({ content, focus, resetKey: sheet.id });
  const { ref: frameRef, on: fullOn, toggle: toggleFull, exit: exitFull } = useFullscreen();
  const { s, x, y } = view;
  const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
  // The 3200 px image once the sheet is drawn larger than the 1600 px one (cached after that).
  const hiRes = s * dpr > 1.15;

  const onKey = (e: React.KeyboardEvent) => {
    if (e.target !== e.currentTarget) return;
    const step = 60;
    const keys: Record<string, () => void> = {
      '+': zoomIn,
      '=': zoomIn,
      '-': zoomOut,
      '0': fit,
      ArrowLeft: () => pan(step, 0),
      ArrowRight: () => pan(-step, 0),
      ArrowUp: () => pan(0, step),
      ArrowDown: () => pan(0, -step),
      Escape: () => {
        if (fullOn && !document.fullscreenElement) exitFull();
      },
    };
    if (e.key === 'PageUp' && onSheetAbove) keys.PageUp = onSheetAbove;
    if (e.key === 'PageDown' && onSheetBelow) keys.PageDown = onSheetBelow;
    const fn = keys[e.key];
    if (fn) {
      e.preventDefault();
      fn();
    }
  };

  const W = sheet.width;
  const H = sheet.height;
  const ring = Math.max(W, H) * 0.035;

  return (
    <div className={cx(styles.viewer, fullOn && styles.fullscreen)} ref={frameRef}>
      <div className={styles.toolbar}>
        {toolbar}
        <div className={styles.zoomTools}>
          <IconButton aria-label={T.zoomOut} title={T.zoomOut} onClick={zoomOut}>
            −
          </IconButton>
          <IconButton aria-label={T.zoomIn} title={T.zoomIn} onClick={zoomIn}>
            +
          </IconButton>
          <IconButton aria-label={T.fit} title={T.fit} onClick={fit}>
            ⤢
          </IconButton>
          <IconButton
            aria-label={fullOn ? T.exitFullscreen : T.fullscreen}
            title={fullOn ? T.exitFullscreen : T.fullscreen}
            aria-pressed={fullOn}
            onClick={toggleFull}
          >
            ⛶
          </IconButton>
        </div>
      </div>
      {/* The stage is a pan / zoom surface (like a map widget): it takes focus so the keyboard
          can zoom (+ − 0), pan (arrows) and change sheets (PageUp / PageDown). */}
      {/* eslint-disable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */}
      <div
        className={styles.stage}
        ref={stageRef}
        tabIndex={0}
        role="application"
        aria-roledescription="plan"
        aria-label={T.viewerLabel}
        onKeyDown={onKey}
        style={{ aspectRatio: `${W} / ${H}` }}
      >
        {/* eslint-enable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */}
        <div
          className={styles.content}
          data-testid="plan-content"
          style={{ width: W, height: H, transform: `translate(${x}px, ${y}px) scale(${s})` }}
        >
          {image ? (
            <img
              className={styles.sheetImg}
              src={hiRes ? image.x2 : image.x1}
              width={W}
              height={H}
              alt={alt}
              decoding="async"
              draggable={false}
            />
          ) : (
            <div className={styles.missingImg} role="img" aria-label={alt} />
          )}
          {(region ?? marker) && (
            <svg
              className={styles.overlay}
              viewBox={`0 0 ${W} ${H}`}
              width={W}
              height={H}
              aria-hidden="true"
              data-testid="unit-highlight"
            >
              {region ? (
                <>
                  <defs>
                    <mask id={`m-${sheet.id}`}>
                      <rect width={W} height={H} fill="#fff" />
                      <polygon
                        points={region.map(([u, v]) => `${u * W},${v * H}`).join(' ')}
                        fill="#000"
                      />
                    </mask>
                  </defs>
                  <rect width={W} height={H} className={styles.dim} mask={`url(#m-${sheet.id})`} />
                  <polygon
                    className={styles.outline}
                    points={region.map(([u, v]) => `${u * W},${v * H}`).join(' ')}
                  />
                </>
              ) : (
                marker && (
                  <>
                    <circle
                      className={styles.pulse}
                      cx={marker[0] * W}
                      cy={marker[1] * H}
                      r={ring * 1.6}
                    />
                    <circle
                      className={styles.outline}
                      cx={marker[0] * W}
                      cy={marker[1] * H}
                      r={ring}
                    />
                  </>
                )
              )}
            </svg>
          )}
          {hotspots.map((h) => (
            <button
              key={h.planType}
              type="button"
              className={cx(
                styles.hotspot,
                h.current && styles.hotCurrent,
                h.muted && styles.hotMuted,
              )}
              style={{
                left: `${h.point[0] * 100}%`,
                top: `${h.point[1] * 100}%`,
                transform: `translate(-50%, -50%) scale(${1 / s})`,
              }}
              aria-label={h.title}
              aria-current={h.current ? 'true' : undefined}
              title={h.title}
              onClick={() => onOpenApartment(h.apartmentId)}
            >
              <span className="num">{h.number}</span>
              {h.current && <small>{T.youAreHere}</small>}
            </button>
          ))}
        </div>
        {(onSheetAbove ?? onSheetBelow) && (
          <div className={styles.sheetNav}>
            <IconButton
              aria-label={T.sheetAbove}
              title={T.sheetAbove}
              disabled={!onSheetAbove}
              onClick={onSheetAbove}
            >
              ▲
            </IconButton>
            <IconButton
              aria-label={T.sheetBelow}
              title={T.sheetBelow}
              disabled={!onSheetBelow}
              onClick={onSheetBelow}
            >
              ▼
            </IconButton>
          </div>
        )}
        <span className={styles.north} aria-hidden="true">
          <b>↑</b>
          {he.directions[0]}
        </span>
      </div>
      {footer}
    </div>
  );
}
