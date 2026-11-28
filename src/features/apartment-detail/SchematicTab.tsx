import { useEffect, useId, useRef, useState } from 'react';
import { DIRS, dirName, isOrientation, ORIENTATIONS, type Orientation } from '@/domain/orientation';
import { type PlanModel, salonFacade } from '@/domain/planModel';
import { SEASONS, type SeasonKey } from '@/domain/solar';
import type { Apartment } from '@/domain/types';
import { hasPlanModel, loadPlanModel } from '@/data/plan-models';
import { ApartmentViewer, type SceneHandle, VIEW_MODES, type ViewMode } from '@/features/viewer3d';
import { he } from '@/i18n/he';
import { cx } from '@/shared/lib/cx';
import { Button, controlClasses, IconButton } from '@/shared/ui/Button';
import { ChipGroup, ToggleChip, chipClasses } from '@/shared/ui/ChipGroup';
import { Banner, Section, TwoColumns } from '@/shared/ui/Content';
import { useMyListStore } from '@/store/myListStore';
import { useOpenApartment } from './navigation';
import { PlanRoomsTable, RoomsTable } from './RoomsTable';
import styles from './SchematicTab.module.css';
import { SunControls } from './SunControls';

const T = he.schematic;
const TM = he.model;
const VIEW_ITEMS = VIEW_MODES.map((v) => ({ value: v, label: TM.views[v] }));

function SourceBadge({ plan }: { plan: boolean }) {
  return (
    <span
      className={cx(styles.badge, plan ? styles.badgePlan : styles.badgeSchematic)}
      title={plan ? TM.badgePlanTitle : TM.badgeSchematicTitle}
    >
      {plan ? `${TM.badgePlan} ✓` : TM.badgeSchematic}
    </span>
  );
}

/** Viewer + controls. Re-mounted (fresh state) when the orientation changes, as in legacy. */
function SchematicStage({
  apartment,
  orientation,
  onOrientationChange,
}: {
  apartment: Apartment;
  orientation: Orientation | null;
  onOrientationChange: (deg: Orientation | null) => void;
}) {
  const selectId = useId();
  const [season, setSeason] = useState<SeasonKey>('winter');
  const [hour, setHour] = useState(9);
  const [autoRotate, setAutoRotate] = useState(true);
  const [labels, setLabels] = useState(true);

  return (
    <div>
      <div className={styles.toolbar}>
        <SourceBadge plan={false} />
      </div>
      <ApartmentViewer
        apartment={apartment}
        orientation={orientation}
        sun={orientation != null ? { hour, dayOfYear: SEASONS[season].dayOfYear } : null}
        autoRotate={autoRotate}
        labels={labels}
        onUserInteract={() => setAutoRotate(false)}
      />
      <div className={styles.controls}>
        <div>
          <label className={`muted ${styles.smallLabel}`} htmlFor={selectId}>
            {T.orientation}
          </label>
          <select
            id={selectId}
            className={controlClasses.input}
            value={orientation ?? ''}
            onChange={(e) => {
              const v = e.target.value === '' ? null : Number(e.target.value);
              onOrientationChange(isOrientation(v) ? v : null);
            }}
          >
            <option value="">{T.unknown}</option>
            {ORIENTATIONS.map((deg, i) => (
              <option key={deg} value={deg}>
                {DIRS[i]}
              </option>
            ))}
          </select>
        </div>
        {orientation != null ? (
          <SunControls
            orientation={orientation}
            hour={hour}
            season={season}
            onHourChange={setHour}
            onSeasonChange={setSeason}
          />
        ) : (
          <p className={styles.readout}>{T.pickDirection}</p>
        )}
        <div className={`${chipClasses.chips} ${chipClasses.segmented}`}>
          <ToggleChip pressed={autoRotate} onPressedChange={setAutoRotate}>
            {T.autoRotate}
          </ToggleChip>
          <ToggleChip pressed={labels} onPressedChange={setLabels}>
            {T.labels}
          </ToggleChip>
        </div>
      </div>
    </div>
  );
}

/** The plan-based model: view modes, overlays, sun from the plan's real north. */
function PlanModelStage({ apartment, model }: { apartment: Apartment; model: PlanModel }) {
  const [view, setView] = useState<ViewMode>('dollhouse');
  const [season, setSeason] = useState<SeasonKey>('winter');
  const [hour, setHour] = useState(9);
  const [autoRotate, setAutoRotate] = useState(true);
  const [labels, setLabels] = useState(true);
  const [wallsCut, setWallsCut] = useState(true);
  const [full, setFull] = useState(false);
  const handle = useRef<SceneHandle | null>(null);
  const frame = useRef<HTMLDivElement>(null);
  const open = useOpenApartment();
  const facade = salonFacade(model);

  useEffect(() => {
    const sync = () =>
      setFull(document.fullscreenElement === frame.current && frame.current != null);
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);
  const toggleFull = () => {
    const el = frame.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else if (typeof el.requestFullscreen === 'function')
      el.requestFullscreen().catch(() => setFull((v) => !v));
    else setFull((v) => !v);
  };
  const step = (f: number, s: number, t = 0) => handle.current?.walk(f, s, t);

  return (
    <div>
      <div className={styles.toolbar}>
        <ChipGroup
          mode="single"
          segmented
          label={TM.viewsLabel}
          items={VIEW_ITEMS}
          selected={view}
          onSelect={(v) => {
            setView(v);
            if (v !== 'dollhouse') setAutoRotate(false);
            // floating room labels clutter the eye-level view
            setLabels(v !== 'walk');
          }}
          className={styles.views}
        />
        <Button
          className={styles.smallBtn}
          onClick={() => open(apartment.id, 'plans', { mode: 'unit' })}
        >
          {TM.showOnPlan}
        </Button>
        <SourceBadge plan />
      </div>
      <div
        className={cx(styles.frame, full && styles.full)}
        ref={frame}
        data-fullscreen={full ? 'true' : undefined}
      >
        <ApartmentViewer
          apartment={apartment}
          orientation={null}
          plan={model}
          view={view}
          wallsCut={wallsCut}
          sun={{ hour, dayOfYear: SEASONS[season].dayOfYear }}
          autoRotate={autoRotate && view === 'dollhouse'}
          labels={labels}
          onUserInteract={() => setAutoRotate(false)}
          onHandle={(h) => (handle.current = h)}
        />
        <div className={styles.overlayEnd}>
          <IconButton
            aria-label={full ? TM.exitFullscreen : TM.fullscreen}
            title={TM.fullscreen}
            onClick={toggleFull}
            aria-pressed={full}
          >
            ⛶
          </IconButton>
          <IconButton
            aria-label={TM.reset}
            title={TM.reset}
            onClick={() => handle.current?.reset()}
          >
            ⟲
          </IconButton>
          <span className={styles.compass} title={TM.compass} aria-hidden="true">
            <b style={{ transform: `rotate(${-model.northDeg}deg)` }}>↑</b>
            {TM.compass}
          </span>
        </div>
        <div className={styles.overlayStart}>
          {view !== 'walk' && (
            <ToggleChip pressed={wallsCut} onPressedChange={setWallsCut}>
              {TM.wallsLow}
            </ToggleChip>
          )}
          <ToggleChip pressed={labels} onPressedChange={setLabels}>
            {TM.labels}
          </ToggleChip>
          {view === 'walk' && (
            <Button className={styles.smallBtn} onClick={() => handle.current?.reset()}>
              {TM.toEntrance}
            </Button>
          )}
        </div>
        {view === 'walk' && (
          <div className={styles.walkPad} role="group" aria-label={TM.walkControls}>
            <IconButton aria-label={TM.walkForward} onClick={() => step(0.5, 0)}>
              ▲
            </IconButton>
            <IconButton aria-label={TM.turnLeft} onClick={() => step(0, 0, -Math.PI / 8)}>
              ↶
            </IconButton>
            <IconButton aria-label={TM.turnRight} onClick={() => step(0, 0, Math.PI / 8)}>
              ↷
            </IconButton>
            <IconButton aria-label={TM.walkBack} onClick={() => step(-0.5, 0)}>
              ▼
            </IconButton>
          </div>
        )}
      </div>
      <div className={styles.controls}>
        <p className={styles.readout}>
          {facade != null ? TM.autoOrientation(dirName(facade)) : TM.orientationFromPlan}
        </p>
        <SunControls
          orientation={facade ?? 180}
          hour={hour}
          season={season}
          onHourChange={setHour}
          onSeasonChange={setSeason}
        />
        {view === 'dollhouse' && (
          <div className={`${chipClasses.chips} ${chipClasses.segmented}`}>
            <ToggleChip pressed={autoRotate} onPressedChange={setAutoRotate}>
              {T.autoRotate}
            </ToggleChip>
          </div>
        )}
      </div>
    </div>
  );
}

type ModelState =
  | { planType: string; status: 'loading' }
  | { planType: string; status: 'ready'; model: PlanModel }
  | { planType: string; status: 'none' };

/** Loads the plan model of the apartment's type, if there is one. */
function usePlanModel(planType: string): ModelState {
  const modelled = hasPlanModel(planType);
  const [state, setState] = useState<ModelState>({
    planType,
    status: modelled ? 'loading' : 'none',
  });
  useEffect(() => {
    if (!modelled) return;
    let live = true;
    loadPlanModel(planType)
      .then((model) => {
        if (live)
          setState(model ? { planType, status: 'ready', model } : { planType, status: 'none' });
      })
      .catch(() => {
        if (live) setState({ planType, status: 'none' });
      });
    return () => {
      live = false;
    };
  }, [planType, modelled]);
  if (state.planType !== planType) return { planType, status: modelled ? 'loading' : 'none' };
  return state;
}

/** "הדמיה תלת־ממדית" tab: the plan-based model when one exists, else the schematic. */
export function SchematicTab({ apartment }: { apartment: Apartment }) {
  const orientation = useMyListStore((s) => s.orientation[apartment.id] ?? null);
  const setOrientation = useMyListStore((s) => s.setOrientation);
  const model = usePlanModel(apartment.planType);

  if (model.status === 'loading') {
    return (
      <p role="status" className="muted">
        {TM.loadingModel}
      </p>
    );
  }
  if (model.status === 'ready') {
    return (
      <>
        <Banner>
          <b>{TM.bannerStrong}</b>
          {TM.banner(model.model.planType)}
        </Banner>
        <TwoColumns>
          <PlanModelStage key={apartment.id} apartment={apartment} model={model.model} />
          <Section title={TM.roomsTitle}>
            <PlanRoomsTable apartment={apartment} model={model.model} />
          </Section>
        </TwoColumns>
      </>
    );
  }
  return (
    <>
      <Banner>
        <b>{T.bannerStrong}</b>
        {T.banner}
      </Banner>
      <TwoColumns>
        <SchematicStage
          key={`${apartment.id}:${orientation ?? 'none'}`}
          apartment={apartment}
          orientation={orientation}
          onOrientationChange={(deg) => setOrientation(apartment.id, deg)}
        />
        <Section title={T.roomsTitle}>
          <RoomsTable apartment={apartment} />
        </Section>
      </TwoColumns>
    </>
  );
}
