import { useEffect, useRef, useState } from 'react';
import type { Orientation } from '@/domain/orientation';
import type { PlanModel } from '@/domain/planModel';
import type { Apartment } from '@/domain/types';
import { he } from '@/i18n/he';
import styles from './ApartmentViewer.module.css';
import {
  createApartmentScene,
  type SceneHandle,
  type SceneOptions,
  type ViewMode,
} from './createApartmentScene';

export interface ApartmentViewerProps {
  apartment: Apartment;
  orientation: Orientation | null;
  /** Solar time and day of year; null = neutral lighting (orientation unknown). */
  sun: { hour: number; dayOfYear: number } | null;
  autoRotate: boolean;
  labels: boolean;
  /** Called when the user drags the model (auto-rotate turns off). */
  onUserInteract?: () => void;
  /** Real geometry from the plans (else the schematic). */
  plan?: PlanModel | null;
  view?: ViewMode;
  /** Dollhouse cut: walls end at 1.2 m. */
  wallsCut?: boolean;
  /** Receives the scene handle (reset, walk buttons) and null on unmount. */
  onHandle?: (h: SceneHandle | null) => void;
  /** For tests. */
  createRenderer?: SceneOptions['createRenderer'];
}

/** True when the browser can create a WebGL context. */
export function isWebGLAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') ?? c.getContext('webgl'));
  } catch {
    return false;
  }
}

/** React wrapper around the imperative three.js scene: created on mount, disposed on unmount. */
export function ApartmentViewer({
  apartment,
  orientation,
  sun,
  autoRotate,
  labels,
  onUserInteract,
  plan = null,
  view = 'dollhouse',
  wallsCut = true,
  onHandle,
  createRenderer,
}: ApartmentViewerProps) {
  const host = useRef<HTMLDivElement>(null);
  const handle = useRef<SceneHandle | null>(null);
  const [failed] = useState(() => !createRenderer && !isWebGLAvailable());
  const interact = useRef(onUserInteract);
  const handleCb = useRef(onHandle);
  useEffect(() => {
    interact.current = onUserInteract;
    handleCb.current = onHandle;
  });

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let h: SceneHandle;
    try {
      h = createApartmentScene(el, apartment, orientation, {
        onUserInteract: () => interact.current?.(),
        plan,
        ...(createRenderer ? { createRenderer } : {}),
      });
    } catch {
      // WebGL passed the capability check but the renderer still failed: show the message in place.
      const p = document.createElement('p');
      p.className = styles.message ?? '';
      p.textContent = he.schematic.noWebgl;
      el.replaceChildren(p);
      return;
    }
    handle.current = h;
    handleCb.current?.(h);
    return () => {
      h.dispose();
      handle.current = null;
      handleCb.current?.(null);
    };
  }, [apartment, orientation, plan, createRenderer]);

  useEffect(() => {
    handle.current?.setView(view);
  }, [view, apartment, orientation, plan]);

  useEffect(() => {
    handle.current?.setWallsCut(view !== 'walk' && wallsCut);
  }, [wallsCut, view, apartment, orientation, plan]);

  const hour = sun?.hour;
  const doy = sun?.dayOfYear;
  useEffect(() => {
    if (hour != null && doy != null) handle.current?.setSun(hour, doy);
  }, [hour, doy, apartment, orientation, plan]);

  useEffect(() => {
    handle.current?.setAutoRotate(autoRotate);
  }, [autoRotate, apartment, orientation, plan]);

  useEffect(() => {
    handle.current?.setLabels(labels);
  }, [labels, apartment, orientation, plan]);

  if (failed) {
    return (
      <div className={styles.stage}>
        <p className={styles.message}>{he.schematic.noWebgl}</p>
      </div>
    );
  }
  return (
    <div className={styles.stage} ref={host} role="img" aria-label={he.schematic.stageLabel}>
      <span className={styles.hint} aria-hidden="true">
        {view === 'walk'
          ? he.model.walkHint
          : view === 'top'
            ? he.model.topHint
            : he.schematic.hint}
      </span>
    </div>
  );
}

export default ApartmentViewer;
