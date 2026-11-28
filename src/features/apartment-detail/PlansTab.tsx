import { useLocation } from 'react-router';
import { resolveSheet, sheetsForBuilding } from '@/domain/floorPlans';
import type { Apartment } from '@/domain/types';
import { floorPlanManifest } from '@/data/floor-plans/manifest';
import {
  NoPlanNotice,
  parsePlanState,
  PlanBrowser,
  type PlanState,
  planStateParams,
} from '@/features/floor-plans';
import { readPlanParams, useOpenApartment, useSetPlanParams, useSetSheetTab } from './navigation';

/** "תוכנית" tab: the contractor's plan with this apartment highlighted (state in the URL). */
export function PlansTab({ apartment }: { apartment: Apartment }) {
  const location = useLocation();
  const p = readPlanParams(location.search);
  const state = parsePlanState(p.mode, p.sheet, p.floor);
  const setParams = useSetPlanParams();
  const open = useOpenApartment();
  const setTab = useSetSheetTab();
  const resolved = resolveSheet(floorPlanManifest, apartment);
  const sheets = sheetsForBuilding(floorPlanManifest, apartment.building);

  if (!resolved && state.mode !== 'building' && state.sheetId == null) {
    return (
      <NoPlanNotice
        otherSheets={sheets.length}
        onShowBuilding={() => setParams({ mode: 'building' })}
      />
    );
  }
  return (
    <PlanBrowser
      building={apartment.building}
      apartment={apartment}
      state={state}
      onStateChange={(next: PlanState) => setParams(planStateParams(next))}
      onOpenApartment={(id) => open(id, 'plans', { mode: 'floor' })}
      onOpen3d={() => setTab('schematic')}
    />
  );
}
