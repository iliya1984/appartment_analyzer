import { useCallback } from 'react';
import { Link, type LinkProps, useLocation, useNavigate } from 'react-router';
import { isSheetTab, type SheetTab, useUiStore } from '@/store/uiStore';

/** Search params that drive the apartment sheet: ?apt=A1-3&tab=insights */
export const APT_PARAM = 'apt';
export const TAB_PARAM = 'tab';

/** Location state set when the sheet was opened from inside the app (so Back can close it). */
interface SheetState {
  sheet?: true;
}

export function readSheetParams(search: string): { id: string | null; tab: SheetTab } {
  const p = new URLSearchParams(search);
  const tab = p.get(TAB_PARAM);
  return { id: p.get(APT_PARAM), tab: isSheetTab(tab) ? tab : 'insights' };
}

function sheetSearch(search: string, id: string, tab: SheetTab): string {
  const p = new URLSearchParams(search);
  p.set(APT_PARAM, id);
  p.set(TAB_PARAM, tab);
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
export function useOpenApartment(): (id: string, tab?: SheetTab) => void {
  const navigate = useNavigate();
  const location = useLocation();
  const lastTab = useUiStore((s) => s.lastSheetTab);
  return useCallback(
    (id, tab) => {
      const inSheet = new URLSearchParams(location.search).has(APT_PARAM);
      void navigate(
        { pathname: location.pathname, search: sheetSearch(location.search, id, tab ?? lastTab) },
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
