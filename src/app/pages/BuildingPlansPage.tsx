import { Link, useParams, useSearchParams } from 'react-router';
import { sheetsForBuilding } from '@/domain/floorPlans';
import { floorPlanManifest } from '@/data/floor-plans/manifest';
import { useOpenApartment } from '@/features/apartment-detail';
import {
  parsePlanState,
  PlanBrowser,
  type PlanState,
  planStateParams,
} from '@/features/floor-plans';
import { he } from '@/i18n/he';
import { EmptyState, Section } from '@/shared/ui/Content';
import { useDataset } from '@/store/selectors';

const T = he.plans;

/** /buildings/:id/plans?sheet=A1-p8&floor=7&mode=floor — all plan sheets of one building. */
export function BuildingPlansPage() {
  const { id = '' } = useParams();
  const [search, setSearch] = useSearchParams();
  const dataset = useDataset();
  const open = useOpenApartment();
  const stats = dataset.buildingStats.get(id);
  const sheets = sheetsForBuilding(floorPlanManifest, id);

  const state = parsePlanState(search.get('mode'), search.get('sheet'), search.get('floor'));
  const update = (next: PlanState) => {
    const p = new URLSearchParams(search);
    for (const k of ['mode', 'sheet', 'floor']) p.delete(k);
    for (const [k, v] of Object.entries(planStateParams(next))) p.set(k, v);
    setSearch(p, { replace: true });
  };

  return (
    <main>
      <Section title={T.pageTitle(id)} aria-label={T.pageTitle(id)}>
        <p className="muted">
          <Link to="/">{T.back}</Link>
          {stats && sheets.length > 0 && <> · {T.pageSummary(stats.plot, sheets.length)}</>}
        </p>
        {!stats ? (
          <EmptyState>{T.pageNoBuilding}</EmptyState>
        ) : sheets.length === 0 ? (
          <EmptyState>{T.pageNoPlans}</EmptyState>
        ) : (
          <PlanBrowser
            building={id}
            state={state}
            onStateChange={update}
            onOpenApartment={(aptId) => open(aptId, 'plans', { mode: 'floor' })}
          />
        )}
      </Section>
    </main>
  );
}
