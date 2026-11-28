import { Link } from 'react-router';
import { sheetsForBuilding } from '@/domain/floorPlans';
import { floorLabel, fmt, m2 } from '@/domain/format';
import { sameFloorUnits, samePlanUnits } from '@/domain/related';
import type { Apartment } from '@/domain/types';
import { floorPlanManifest } from '@/data/floor-plans/manifest';
import { buildingPlansPath } from '@/features/floor-plans';
import { HighlightedSiteMap } from '@/features/site-map';
import { he } from '@/i18n/he';
import { Button, controlClasses } from '@/shared/ui/Button';
import { Fact, Facts, Section, TwoColumns } from '@/shared/ui/Content';
import { useDataset } from '@/store/selectors';
import { useOpenApartment } from './navigation';
import styles from './BuildingTab.module.css';
import { UnitsTable } from './UnitsTable';

const T = he.buildingTab;

export function BuildingTab({ apartment: a }: { apartment: Apartment }) {
  const dataset = useDataset();
  const open = useOpenApartment();
  const st = dataset.buildingStats.get(a.building);
  if (!st) return null;
  const sheetCount = sheetsForBuilding(floorPlanManifest, a.building).length;
  return (
    <>
      <Section title={T.onMap(a.building)}>
        <HighlightedSiteMap building={a.building} />
        <Facts style={{ marginTop: 10 }}>
          <Fact label={T.plot} value={st.plot} />
          <Fact
            label={T.floors}
            value={T.floorsRange(floorLabel(st.floorMin), floorLabel(st.floorMax))}
          />
          <Fact label={T.units} value={st.units} />
          <Fact
            label={T.target}
            value={T.targetValue(st.targetUnits, Math.round((st.targetUnits / st.units) * 100))}
          />
          <Fact label={T.avgArea} value={`${m2(st.avgArea)} מ״ר`} />
          {st.priceMin != null && st.priceMax != null && st.priceMin !== 0 && (
            <Fact
              label={T.priceRange}
              value={T.priceRangeValue(fmt(st.priceMin / 1000), fmt(st.priceMax / 1000))}
            />
          )}
        </Facts>
        {sheetCount > 0 && (
          <div className={styles.planLinks}>
            <Link className={controlClasses.btn} to={buildingPlansPath(a.building, a.floor)}>
              {he.plans.buildingPlans(sheetCount)}
            </Link>
            <Button onClick={() => open(a.id, 'plans', { mode: 'floor' })}>
              {he.plans.floorPlan}
            </Button>
          </div>
        )}
      </Section>
      <TwoColumns>
        <Section title={T.onFloor(floorLabel(a.floor))}>
          <UnitsTable
            units={sameFloorUnits(dataset, a)}
            currentId={a.id}
            firstColumn={{ header: T.colUnit, value: (x) => x.number }}
          />
          <p className="muted" style={{ fontSize: 13, margin: '8px 0 0' }}>
            {T.floorNote}
          </p>
        </Section>
        <Section title={T.samePlan(a.planType)}>
          <UnitsTable
            units={samePlanUnits(dataset, a)}
            currentId={a.id}
            firstColumn={{ header: T.colFloor, value: (x) => floorLabel(x.floor) }}
          />
        </Section>
      </TwoColumns>
    </>
  );
}
