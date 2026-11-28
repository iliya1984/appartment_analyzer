export const PLAN_MODES = ['unit', 'floor', 'building'] as const;
export type PlanMode = (typeof PLAN_MODES)[number];
export const isPlanMode = (v: unknown): v is PlanMode =>
  typeof v === 'string' && (PLAN_MODES as readonly string[]).includes(v);

export interface PlanState {
  mode: PlanMode | null;
  sheetId: string | null;
  floor: number | null;
}

/** Parses URL values into a PlanState (invalid values become null). */
export function parsePlanState(
  mode?: string | null,
  sheet?: string | null,
  floor?: string | null,
): PlanState {
  const f = floor != null && floor !== '' ? Number(floor) : NaN;
  return {
    mode: isPlanMode(mode) ? mode : null,
    sheetId: sheet ?? null,
    floor: Number.isInteger(f) ? f : null,
  };
}

/** The URL values of a PlanState (null fields are left out). */
export function planStateParams(s: PlanState): { mode?: string; sheet?: string; floor?: string } {
  return {
    ...(s.mode ? { mode: s.mode } : {}),
    ...(s.sheetId ? { sheet: s.sheetId } : {}),
    ...(s.floor != null ? { floor: String(s.floor) } : {}),
  };
}
