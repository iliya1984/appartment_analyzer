import { useCallback } from 'react';
import { Link, type LinkProps, useLocation, useNavigate } from 'react-router';
import { isSheetTab, type SheetTab, useUiStore } from '@/store/uiStore';

/** Search params that drive the apartment sheet: ?apt=A1-3&tab=insights */
export const APT_PARAM = 'apt';
export const TAB_PARAM = 'tab';
/** Plans-tab state (prefixed so it never clashes with a page that has its own params). */
export const PLAN_PARAMS = { mode: 'pmode', sheet: 'psheet', floor: 'pfloor' } as const;
export type SheetExtras = Partial<Record<keyof typeof PLAN_PARAMS, string>>;

/** Location state set when the sheet was opened from inside the app (so Back can close it). */
interface SheetState {
  sheet?: true;
}

export function readSheetParams(search: string): { id: string | null; tab: SheetTab } {
  const p = new URLSearchParams(search);
  const tab = p.get(TAB_PARAM);
  return { id: p.get(APT_PARAM), tab: isSheetTab(tab) ? tab : 'insights' };
}

/** Removes the plans-tab state (it belongs to one apartment). */
function dropPlanParams(p: URLSearchParams) {
  for (const k of Object.values(PLAN_PARAMS)) p.delete(k);
}

function sheetSearch(search: string, id: string, tab: SheetTab, extras?: SheetExtras): string {
  const p = new URLSearchParams(search);
  p.set(APT_PARAM, id);
  p.set(TAB_PARAM, tab);
  dropPlanParams(p);
  for (const [k, v] of Object.entries(extras ?? {}) as [keyof typeof PLAN_PARAMS, string][])
    p.set(PLAN_PARAMS[k], v);
  return `?${p.toString()}`;
}

/**
 * Where a link to an apartment should go. From a page it pushes a history entry (Back closes
 * the sheet); inside the sheet it replaces the current one (Back still closes the sheet).
 */
function useSheetTarget(id: string, tab?: SheetTab) {
  const location = useLocation();
  const lastTab = useUiStore((s) => s.lastSheetTab);
  const inSheet = new URLSearchParams(location.search).has(APT_PARAM);
  return {
    to: { pathname: location.pathname, search: sheetSearch(location.search, id, tab ?? lastTab) },
    replace: inSheet,
    state: (inSheet ? location.state : { sheet: true }) as SheetState | null,
  };
}

export type ApartmentLinkProps = Omit<LinkProps, 'to' | 'replace' | 'state'> & {
  apartmentId: string;
  tab?: SheetTab;
};

/** A real link (`<a href>`) that opens the apartment sheet. */
export function ApartmentLink({ apartmentId, tab, ...rest }: ApartmentLinkProps) {
  const target = useSheetTarget(apartmentId, tab);
  return <Link to={target.to} replace={target.replace} state={target.state} {...rest} />;
}

/** Imperative version of ApartmentLink (for tiles, rows, …). */
export function useOpenApartment(): (id: string, tab?: SheetTab, extras?: SheetExtras) => void {
  const navigate = useNavigate();
  const location = useLocation();
  const lastTab = useUiStore((s) => s.lastSheetTab);
  return useCallback(
    (id, tab, extras) => {
      const inSheet = new URLSearchParams(location.search).has(APT_PARAM);
      void navigate(
        {
          pathname: location.pathname,
          search: sheetSearch(location.search, id, tab ?? lastTab, extras),
        },
        {
          replace: inSheet,
          state: inSheet ? (location.state as SheetState | null) : { sheet: true },
        },
      );
    },
    [navigate, location, lastTab],
  );
}

/** Closes the sheet: history Back when we opened it, otherwise drop the params. */
export function useCloseSheet(): () => void {
  const navigate = useNavigate();
  const location = useLocation();
  return useCallback(() => {
    if ((location.state as SheetState | null)?.sheet) {
      void navigate(-1);
      return;
    }
    const p = new URLSearchParams(location.search);
    p.delete(APT_PARAM);
    p.delete(TAB_PARAM);
    dropPlanParams(p);
    const search = p.toString();
    void navigate(
      { pathname: location.pathname, search: search ? `?${search}` : '' },
      { replace: true },
    );
  }, [navigate, location]);
}

/** Switches the sheet tab without adding history entries. */
export function useSetSheetTab(): (tab: SheetTab) => void {
  const navigate = useNavigate();
  const location = useLocation();
  const setLastSheetTab = useUiStore((s) => s.setLastSheetTab);
  return useCallback(
    (tab) => {
      setLastSheetTab(tab);
      const p = new URLSearchParams(location.search);
      p.set(TAB_PARAM, tab);
      void navigate(
        { pathname: location.pathname, search: `?${p.toString()}` },
        { replace: true, state: location.state as SheetState | null },
      );
    },
    [navigate, location, setLastSheetTab],
  );
}

/** Updates the plans-tab state in the URL (replace, no history entries). */
export function useSetPlanParams(): (extras: SheetExtras) => void {
  const navigate = useNavigate();
  const location = useLocation();
  return useCallback(
    (extras) => {
      const p = new URLSearchParams(location.search);
      dropPlanParams(p);
      for (const [k, v] of Object.entries(extras) as [keyof typeof PLAN_PARAMS, string][])
        p.set(PLAN_PARAMS[k], v);
      void navigate(
        { pathname: location.pathname, search: `?${p.toString()}` },
        { replace: true, state: location.state as SheetState | null },
      );
    },
    [navigate, location],
  );
}

export function readPlanParams(search: string): SheetExtras {
  const p = new URLSearchParams(search);
  const out: SheetExtras = {};
  for (const [k, name] of Object.entries(PLAN_PARAMS) as [keyof typeof PLAN_PARAMS, string][]) {
    const v = p.get(name);
    if (v != null) out[k] = v;
  }
  return out;
}
