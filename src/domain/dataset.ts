import { computePeerComparisons } from './comparison';
import type {
  Apartment,
  ApartmentKind,
  BuildingStats,
  Dataset,
  ProjectMeta,
  RawRow,
  StorageSub,
  StorageUnit,
} from './types';

const GROUND = 'קרקע';

const toKind = (planType: string): ApartmentKind => {
  const c = planType[2];
  return c === 'G' || c === 'P' ? c : 'T';
};

/** "קרקע עליון" → { floor: 'קרקע', sub: 'עליון' }, "-1" → { floor: '-1', sub: '' }. */
export function parseStorage(no: string, area: number, rawFloor: string): StorageUnit {
  const floor = rawFloor.includes(GROUND) ? GROUND : String(parseInt(rawFloor, 10));
  const sub: StorageSub = rawFloor.includes('עליון')
    ? 'עליון'
    : rawFloor.includes('תחתון')
      ? 'תחתון'
      : '';
  return { no, area, floor, sub };
}

type BaseUnit = Omit<Apartment, 'isTopFloor' | 'isBottomFloor' | 'comparison'>;

function toBaseUnit(row: RawRow): BaseUnit {
  const [
    b,
    plot,
    n,
    planType,
    saleType,
    floor,
    rooms,
    area,
    outdoor,
    sArea,
    parking,
    tgt,
    price,
    sNo,
    sFloor,
  ] = row;
  return {
    id: `${b}-${n}`,
    building: b,
    plot,
    number: n,
    planType,
    saleType,
    floor,
    rooms,
    roomsBucket: Math.min(6, Math.floor(rooms)),
    area,
    outdoor,
    kind: toKind(planType),
    parking,
    category: tgt ? 'target' : 'free',
    price,
    pricePerSqm: price != null ? price / area : null,
    storage: parseStorage(sNo, sArea, sFloor),
  };
}

/** Building ids sorted by letter, then by number: A1, A7, B2, B4 … */
export function compareBuildingIds(a: string, b: string): number {
  return (
    (a[0] ?? '').localeCompare(b[0] ?? '') || parseInt(a.slice(1), 10) - parseInt(b.slice(1), 10)
  );
}

function computeBuildingStats(id: string, units: readonly BaseUnit[]): BuildingStats {
  const prices = units.flatMap((u) => (u.price != null ? [u.price] : []));
  const floors = units.map((u) => u.floor);
  return {
    id,
    units: units.length,
    plot: units[0]?.plot ?? 0,
    floorMin: Math.min(...floors),
    floorMax: Math.max(...floors),
    targetUnits: units.filter((u) => u.category === 'target').length,
    avgArea: units.reduce((s, u) => s + u.area, 0) / units.length,
    priceMin: prices.length ? Math.min(...prices) : null,
    priceMax: prices.length ? Math.max(...prices) : null,
    avgStorageArea: units.reduce((s, u) => s + u.storage.area, 0) / units.length,
  };
}

/**
 * Builds the immutable, fully derived dataset from raw workbook rows.
 * Pure: same input → same output; does not mutate `rows`.
 */
export function buildDataset(rows: readonly RawRow[], meta: ProjectMeta): Dataset {
  const base = rows.map(toBaseUnit);

  const byBuilding = new Map<string, BaseUnit[]>();
  for (const u of base) {
    const list = byBuilding.get(u.building);
    if (list) list.push(u);
    else byBuilding.set(u.building, [u]);
  }
  const buildings = [...byBuilding.keys()].sort(compareBuildingIds);
  const buildingStats = new Map<string, BuildingStats>(
    buildings.map((b) => [b, computeBuildingStats(b, byBuilding.get(b) ?? [])]),
  );

  const comparisons = computePeerComparisons(base);

  const apartments: Apartment[] = base.map((u) => {
    const st = buildingStats.get(u.building);
    return {
      ...u,
      isTopFloor: u.floor === st?.floorMax,
      isBottomFloor: u.floor === st?.floorMin,
      comparison: comparisons.get(u.id) ?? null,
    };
  });

  return {
    meta,
    apartments,
    byId: new Map(apartments.map((a) => [a.id, a])),
    buildings,
    buildingStats,
  };
}

/** Number of apartments sold at the target price. */
export const countTarget = (d: Dataset): number =>
  d.apartments.filter((a) => a.category === 'target').length;
