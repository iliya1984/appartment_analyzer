import { useMemo } from 'react';
import { Link } from 'react-router';
import { sheetForFloor, sheetsForBuilding } from '@/domain/floorPlans';
import { matches } from '@/domain/filters';
import { floorLabel, floorName } from '@/domain/format';
import { unitsOnFloor } from '@/domain/related';
import { floorPlanManifest } from '@/data/floor-plans/manifest';
import { buildingPlansPath } from '@/features/floor-plans';
import { he } from '@/i18n/he';
import { PlanIcon } from '@/shared/icons/PlanIcon';
import { Legend, Swatch } from '@/shared/ui/Content';
import { useFiltersStore } from '@/store/filtersStore';
import { useDataset, useMyListIds } from '@/store/selectors';
import styles from './BuildingElevation.module.css';
import { UnitTile } from './UnitTile';

export interface BuildingElevationProps {
  onOpenApartment: (id: string) => void;
}

/** Floor-by-floor grid of the single selected building; renders nothing otherwise. */
export function BuildingElevation({ onOpenApartment }: BuildingElevationProps) {
  const dataset = useDataset();
  const filters = useFiltersStore((s) => s.filters);
  const myList = useMyListIds();
  const building = filters.buildings.length === 1 ? filters.buildings[0] : undefined;
  const stats = building ? dataset.buildingStats.get(building) : undefined;

  const floors = useMemo(() => {
    if (!building || !stats) return [];
    const out: number[] = [];
    for (let f = stats.floorMax; f >= stats.floorMin; f--) out.push(f);
    return out;
  }, [building, stats]);

  if (!building || !stats) return null;

  return (
    <div className={styles.elevation} data-testid="elevation">
      <div className={styles.head}>
        <h3>{he.elevation.title(building)}</h3>
        {sheetsForBuilding(floorPlanManifest, building).length > 0 && (
          <Link className={styles.plansLink} to={buildingPlansPath(building)}>
            <PlanIcon />
            {he.plans.elevationLink}
          </Link>
        )}
      </div>
      <div className="muted num">
        {he.elevation.summary(
          stats.plot,
          stats.units,
          floorLabel(stats.floorMin),
          floorLabel(stats.floorMax),
          stats.targetUnits,
        )}
      </div>
      <Legend>
        <span>
          <Swatch color="var(--sea)" />
          {he.common.target}
        </span>
        <span>
          <Swatch color="var(--sun)" />
          {he.common.free}
        </span>
        <span>
          <Swatch color="var(--surface2)" border="1px solid var(--line)" />
          {he.elevation.legendUnmatched}
        </span>
        <span>{he.elevation.legendTile}</span>
      </Legend>
      <div className={styles.grid}>
        {floors.map((f) => (
          <div className={styles.row} key={f}>
            <div className={`${styles.floor} num`}>
              {floorName(f)}
              {sheetForFloor(floorPlanManifest, building, f) && (
                <Link
                  className={styles.floorPlan}
                  to={buildingPlansPath(building, f)}
                  aria-label={he.plans.floorRowPlan(floorName(f))}
                  title={he.plans.floorRowPlan(floorName(f))}
                >
                  <PlanIcon />
                </Link>
              )}
            </div>
            {unitsOnFloor(dataset, building, f).map((a) => (
              <UnitTile
                key={a.id}
                apartment={a}
                matched={matches(a, filters)}
                inMyList={myList.has(a.id)}
                onOpen={onOpenApartment}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
