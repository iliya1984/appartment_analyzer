/**
 * The contractor's sales plans (תוכניות מכר): which plan sheet shows which apartment.
 * Pure functions over a manifest (see src/data/floor-plans/manifest.ts) and the dataset.
 */
import type { Apartment } from './types';

/**
 * floor = typical or first floor, penthouse = top floor, garden = garden apartments,
 * ground = ground level (lobby, storage, sometimes apartments), roof = roof plan,
 * unit = a single-apartment sheet (1:50).
 */
export type SheetKind = 'floor' | 'penthouse' | 'garden' | 'ground' | 'roof' | 'unit';

/** Normalised point on the sheet image: [0..1 from the left, 0..1 from the top]. */
export type PlanPoint = readonly [number, number];

export interface PlanSheet {
  /** e.g. "A1-p8" (building + PDF page). */
  id: string;
  building: string;
  /** Page in the source PDF (1-based). */
  page: number;
  kind: SheetKind;
  /** Dataset floors drawn on the sheet (one drawing for the whole range); [] for service floors. */
  floors: readonly number[];
  /** Floor label as printed in the title block, e.g. "5–7", "קרקע עליונה". */
  label: string;
  /** Vertical order in the building (higher = upper). */
  level: number;
  scale: 50 | 100;
  /** Image size of the @1x rendering, px. */
  width: number;
  height: number;
  /** Plan-type label positions (unit hotspots). */
  anchors: Readonly<Record<string, PlanPoint>>;
  /** Optional hand-drawn unit outlines (normalised polygons) per plan type. */
  regions: Readonly<Record<string, readonly PlanPoint[]>>;
  /** Unit sheets only: the plan type shown. */
  planType?: string;
}

export interface FloorPlanManifest {
  sheets: readonly PlanSheet[];
  /** "<building>:<dataset plan type>" → plan type printed on the sheet. */
  aliases: Readonly<Record<string, string>>;
}

export interface ResolvedPlan {
  sheet: PlanSheet;
  /** Plan type as printed on the sheet (after aliases). */
  planType: string;
  /** Hotspot of the apartment, or null when the sheet does not label it. */
  anchor: PlanPoint | null;
  region: readonly PlanPoint[] | null;
}

type AptKey = Pick<Apartment, 'building' | 'floor' | 'planType'>;

/** Plan type as printed on the plans (handles the known spelling differences). */
export function sheetPlanType(m: FloorPlanManifest, a: Pick<Apartment, 'building' | 'planType'>) {
  return m.aliases[`${a.building}:${a.planType}`] ?? a.planType;
}

/**
 * The sheet that shows this apartment: the building sheet for its floor (preferred, it labels
 * the unit), else a unit sheet of its plan type. null when no plan covers the apartment.
 */
export function resolveSheet(m: FloorPlanManifest, a: AptKey): ResolvedPlan | null {
  const planType = sheetPlanType(m, a);
  const candidates = m.sheets.filter(
    (s) => s.building === a.building && s.floors.includes(a.floor),
  );
  const building = candidates.filter((s) => s.kind !== 'unit');
  const labelled = building.find((s) => planType in s.anchors);
  const unit = candidates.find((s) => s.kind === 'unit' && s.planType === planType);
  const sheet = labelled ?? unit ?? building[0];
  if (!sheet) return null;
  return {
    sheet,
    planType,
    anchor: sheet.anchors[planType] ?? null,
    region: sheet.regions[planType] ?? null,
  };
}

/** All sheets of a building, top (roof) to bottom, like the elevation. */
export function sheetsForBuilding(m: FloorPlanManifest, building: string): PlanSheet[] {
  return m.sheets
    .filter((s) => s.building === building)
    .sort((x, y) => y.level - x.level || x.page - y.page);
}

/** The building sheet that draws `floor`, if any. */
export function sheetForFloor(
  m: FloorPlanManifest,
  building: string,
  floor: number,
): PlanSheet | undefined {
  return sheetsForBuilding(m, building).find((s) => s.kind !== 'unit' && s.floors.includes(floor));
}

/** Apartments on `floor` of the sheet's building, keyed by the plan type printed on the sheet. */
export function apartmentsOnSheet(
  m: FloorPlanManifest,
  apartments: readonly Apartment[],
  sheet: PlanSheet,
  floor: number,
): Map<string, Apartment> {
  const out = new Map<string, Apartment>();
  if (!sheet.floors.includes(floor)) return out;
  for (const a of apartments) {
    if (a.building !== sheet.building || a.floor !== floor) continue;
    const pt = sheetPlanType(m, a);
    if (sheet.kind === 'unit' ? pt === sheet.planType : pt in sheet.anchors) out.set(pt, a);
  }
  return out;
}

/** The floor to show on a sheet: the wanted one when the sheet draws it, else its lowest floor. */
export function floorOnSheet(sheet: PlanSheet, wanted: number | null | undefined): number | null {
  if (wanted != null && sheet.floors.includes(wanted)) return wanted;
  return sheet.floors.length ? Math.min(...sheet.floors) : null;
}

/** Neighbouring sheet in the building (+1 = the one above, -1 = below). */
export function adjacentSheet(
  m: FloorPlanManifest,
  sheet: PlanSheet,
  dir: 1 | -1,
): PlanSheet | undefined {
  const list = sheetsForBuilding(m, sheet.building);
  const i = list.findIndex((s) => s.id === sheet.id);
  return i < 0 ? undefined : list[i - dir];
}

export interface CoverageReport {
  /** Apartments without any plan sheet. */
  missing: string[];
  /** Apartments whose sheet exists but does not label their plan type. */
  unlabelled: string[];
}

export function coverageReport(
  m: FloorPlanManifest,
  apartments: readonly Apartment[],
): CoverageReport {
  const missing: string[] = [];
  const unlabelled: string[] = [];
  for (const a of apartments) {
    const r = resolveSheet(m, a);
    if (!r) missing.push(a.id);
    else if (!r.anchor && r.sheet.kind !== 'unit') unlabelled.push(a.id);
  }
  return { missing, unlabelled };
}

/** Buildings that have at least one sheet. */
export const buildingsWithPlans = (m: FloorPlanManifest): Set<string> =>
  new Set(m.sheets.map((s) => s.building));
