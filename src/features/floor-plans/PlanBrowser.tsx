import { useMemo } from 'react';
import { matches } from '@/domain/filters';
import {
  adjacentSheet,
  apartmentsOnSheet,
  floorOnSheet,
  type PlanSheet,
  resolveSheet,
  sheetForFloor,
  sheetsForBuilding,
} from '@/domain/floorPlans';
import { floorLabel, m2, money } from '@/domain/format';
import type { Apartment } from '@/domain/types';
import { floorPlanManifest } from '@/data/floor-plans/manifest';
import { he } from '@/i18n/he';
import { cx } from '@/shared/lib/cx';
import { Button, IconButton } from '@/shared/ui/Button';
import { ChipGroup } from '@/shared/ui/ChipGroup';
import { useFiltersStore } from '@/store/filtersStore';
import { useDataset } from '@/store/selectors';
import { PLAN_MODES, type PlanMode, type PlanState } from './modes';
import styles from './PlanBrowser.module.css';
import { type Hotspot, PlanViewer } from './PlanViewer';
import { sheetImage } from './sheetImages';

const T = he.plans;

export type { PlanMode, PlanState };

export interface PlanBrowserProps {
  building: string;
  state: PlanState;
  onStateChange: (next: PlanState) => void;
  /** The apartment to highlight (apartment sheet); absent on the building plans page. */
  apartment?: Apartment | null;
  onOpenApartment: (id: string) => void;
  /** Cross-link to the 3D tab. */
  onOpen3d?: (() => void) | undefined;
}

/** Floor labels like "8–16" are LTR: isolate them so RTL text does not flip them to "16–8". */
function FloorLabel({ label }: { label: string }) {
  return /[א-ת]/.test(label) ? <>{label}</> : <bdi dir="ltr">{label}</bdi>;
}

const sheetCaptionNode = (s: PlanSheet) =>
  s.kind === 'roof' || /[א-ת]/.test(s.label) ? (
    s.label
  ) : (
    <>
      {he.common.floor} <FloorLabel label={s.label} />
    </>
  );

const sheetCaption = (s: PlanSheet) =>
  s.kind === 'roof' || (s.floors.length === 0 && s.kind === 'ground') || /[א-ת]/.test(s.label)
    ? s.label
    : T.caption(s.label);

function FloorRail({
  sheets,
  current,
  markFloor,
  onPick,
}: {
  sheets: readonly PlanSheet[];
  current: PlanSheet | null;
  markFloor: number | null;
  onPick: (s: PlanSheet) => void;
}) {
  return (
    <nav className={styles.rail} aria-label={T.railLabel}>
      <ol>
        {sheets.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              className={cx(styles.railItem, current?.id === s.id && styles.railCurrent)}
              aria-current={current?.id === s.id ? 'true' : undefined}
              onClick={() => onPick(s)}
            >
              <span className="num">
                {s.kind === 'unit' ? T.kinds.unit : <FloorLabel label={s.label} />}
              </span>
              {markFloor != null && s.floors.includes(markFloor) && (
                <i className={styles.railDot} aria-hidden="true" />
              )}
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}

function SheetThumbGrid({
  sheets,
  countFor,
  markFloor,
  onPick,
}: {
  sheets: readonly PlanSheet[];
  countFor: (s: PlanSheet) => number;
  markFloor: number | null;
  onPick: (s: PlanSheet) => void;
}) {
  return (
    <ul className={styles.thumbs}>
      {sheets.map((s) => {
        const img = sheetImage(s.id);
        const n = countFor(s);
        return (
          <li key={s.id}>
            <button
              type="button"
              className={cx(
                styles.thumb,
                markFloor != null && s.floors.includes(markFloor) && styles.thumbMarked,
              )}
              onClick={() => onPick(s)}
            >
              {img && (
                <img
                  src={img.x1}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  width={s.width}
                  height={s.height}
                />
              )}
              <b>{s.kind === 'unit' ? T.kinds.unit : sheetCaptionNode(s)}</b>
              <span className="muted">
                {T.kinds[s.kind]} · {n ? T.thumbUnits(n) : T.thumbNoUnits}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Plan sheets of one building: the apartment (zoomed), a floor with clickable units, or all
 * sheets as thumbnails. Fully controlled by `state` so the URL can hold it.
 */
export function PlanBrowser({
  building,
  state,
  onStateChange,
  apartment,
  onOpenApartment,
  onOpen3d,
}: PlanBrowserProps) {
  const dataset = useDataset();
  const filters = useFiltersStore((s) => s.filters);
  const m = floorPlanManifest;
  const sheets = useMemo(() => sheetsForBuilding(m, building), [m, building]);
  const resolved = apartment ? resolveSheet(m, apartment) : null;

  const sheet =
    sheets.find((s) => s.id === state.sheetId) ??
    (state.floor != null && state.mode !== 'unit'
      ? sheetForFloor(m, building, state.floor)
      : undefined) ??
    resolved?.sheet ??
    sheetForFloor(m, building, 1) ??
    sheets[0] ??
    null;
  const onOwnSheet = resolved != null && sheet?.id === resolved.sheet.id;
  const canUnit = onOwnSheet;
  const wanted = state.mode ?? (apartment ? 'unit' : 'floor');
  const mode: PlanMode = wanted === 'unit' && !canUnit ? 'floor' : wanted;
  const floor = sheet ? floorOnSheet(sheet, state.floor ?? apartment?.floor) : null;

  const hotspots: Hotspot[] = useMemo(() => {
    if (!sheet || floor == null) return [];
    const units = apartmentsOnSheet(m, dataset.apartments, sheet, floor);
    const out: Hotspot[] = [];
    for (const [planType, a] of units) {
      const point = sheet.anchors[planType];
      if (!point) continue;
      out.push({
        planType,
        point,
        apartmentId: a.id,
        number: a.number,
        title: T.hotspot(
          a.number,
          a.planType,
          a.rooms,
          m2(a.area),
          a.price != null ? money(a.price) : he.common.notPublished,
        ),
        current: a.id === apartment?.id,
        muted: !matches(a, filters),
      });
    }
    return out.sort((p, q) => p.number - q.number);
  }, [m, dataset, sheet, floor, apartment?.id, filters]);

  const go = (next: Partial<PlanState>) => onStateChange({ ...state, mode, ...next });
  const pickSheet = (s: PlanSheet) =>
    go({ mode: 'floor', sheetId: s.id, floor: floorOnSheet(s, apartment?.floor ?? floor) });

  if (!sheet) return null;

  const modeItems = PLAN_MODES.filter((k) => k !== 'unit' || apartment).map((k) => ({
    value: k,
    label: T.modes[k],
  }));
  const modeSwitch = (
    <ChipGroup
      mode="single"
      segmented
      label={T.modesLabel}
      items={modeItems}
      selected={mode}
      onSelect={(k) => {
        if (k === 'unit' && resolved)
          go({ mode: 'unit', sheetId: resolved.sheet.id, floor: apartment?.floor ?? null });
        else go({ mode: k });
      }}
      className={styles.modes}
    />
  );

  const markFloor = apartment?.floor ?? null;

  if (mode === 'building') {
    return (
      <div className={styles.browser}>
        <div className={styles.toolbar}>{modeSwitch}</div>
        <div className={styles.buildingLayout}>
          <FloorRail sheets={sheets} current={sheet} markFloor={markFloor} onPick={pickSheet} />
          <SheetThumbGrid
            sheets={sheets}
            markFloor={markFloor}
            countFor={(s) =>
              s.floors.length
                ? apartmentsOnSheet(m, dataset.apartments, s, Math.min(...s.floors)).size
                : 0
            }
            onPick={pickSheet}
          />
        </div>
        <p className={styles.disclaimer}>{T.disclaimer}</p>
      </div>
    );
  }

  const above = adjacentSheet(m, sheet, 1);
  const below = adjacentSheet(m, sheet, -1);
  const floors = [...sheet.floors].sort((a, b) => a - b);
  const fi = floor == null ? -1 : floors.indexOf(floor);
  const planOnSheet = onOwnSheet ? resolved.planType : null;

  const caption = (
    <div className={styles.caption}>
      <b>
        {sheet.kind === 'unit'
          ? `${T.kinds.unit} · ${sheet.planType ?? ''}`
          : sheetCaptionNode(sheet)}
      </b>
      {planOnSheet && <span className={styles.planChip}>{planOnSheet}</span>}
      {floors.length > 1 && floor != null && (
        <span className={styles.stepper} role="group" aria-label={T.floorStepperLabel}>
          <IconButton
            aria-label={T.floorPrev}
            disabled={fi <= 0}
            onClick={() => go({ floor: floors[fi - 1] ?? floor })}
          >
            ▼
          </IconButton>
          <span className="num" aria-live="polite" aria-label={T.floorShown(floorLabel(floor))}>
            {floorLabel(floor)}
          </span>
          <IconButton
            aria-label={T.floorNext}
            disabled={fi >= floors.length - 1}
            onClick={() => go({ floor: floors[fi + 1] ?? floor })}
          >
            ▲
          </IconButton>
        </span>
      )}
      {onOpen3d && (
        <Button className={styles.crossLink} onClick={onOpen3d}>
          {T.open3d}
        </Button>
      )}
    </div>
  );

  const unitFocus = mode === 'unit' && sheet.kind !== 'unit' ? (resolved?.anchor ?? null) : null;
  const highlight = onOwnSheet ? resolved : null;

  return (
    <div className={styles.browser}>
      <div className={styles.floorLayout}>
        <div className={styles.main}>
          <PlanViewer
            sheet={sheet}
            image={sheetImage(sheet.id)}
            alt={T.imageAlt(building, sheetCaption(sheet), planOnSheet)}
            hotspots={sheet.kind === 'unit' ? [] : hotspots}
            focus={unitFocus}
            region={highlight?.region ?? null}
            marker={highlight && sheet.kind !== 'unit' ? highlight.anchor : null}
            onOpenApartment={onOpenApartment}
            toolbar={
              <>
                {modeSwitch}
                {caption}
              </>
            }
            onSheetAbove={above ? () => pickSheet(above) : undefined}
            onSheetBelow={below ? () => pickSheet(below) : undefined}
            footer={
              <div className={styles.notes}>
                {sheet.kind === 'unit' ? (
                  <p>{T.unitSheetNote}</p>
                ) : (
                  floors.length > 1 && <p>{T.rangeNote('⁦' + sheet.label + '⁩')}</p>
                )}
                <p className={styles.disclaimer}>{T.disclaimer}</p>
              </div>
            }
          />
        </div>
        <FloorRail sheets={sheets} current={sheet} markFloor={markFloor} onPick={pickSheet} />
      </div>
    </div>
  );
}

export default PlanBrowser;
