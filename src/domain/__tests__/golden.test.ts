/**
 * Golden-master tests (migration plan risk R2): the React port must reproduce, exactly, what the
 * legacy template.html computed. Fixture: fixtures/legacy-derived.json.
 */
import { describe, expect, it } from 'vitest';
import { META, RAW } from '@/data/apartments.data';
import { buildExportTable } from '@/data/workbook/exportMyList';
import { buildDataset } from '@/domain/dataset';
import { applyFilters, countByBuilding, DEFAULT_FILTERS, type Filters } from '@/domain/filters';
import { fmt, floorLabel, m2, money, pct, r1 } from '@/domain/format';
import { getInsights, gaugePosition } from '@/domain/insights';
import { dirName } from '@/domain/orientation';
import { layoutFor } from '@/domain/schematic';
import { solarPosition, sunHours } from '@/domain/solar';
import { SORT_PRESETS, type SortKey } from '@/domain/sort';
import { legacyFixture } from '@/test/legacyFixture';

const legacy = legacyFixture();
const dataset = buildDataset(RAW, META);

describe('golden master: dataset', () => {
  it('has the same apartments in the same order', () => {
    expect(dataset.apartments.map((a) => a.id)).toEqual(legacy.units.map((u) => u.id));
  });

  it('orders buildings the same way', () => {
    expect(dataset.buildings).toEqual(legacy.buildings);
  });

  it('reproduces every base and derived field of every apartment', () => {
    for (const u of legacy.units) {
      const a = dataset.byId.get(u.id)!;
      expect({
        b: a.building,
        plot: a.plot,
        n: a.number,
        typ: a.planType,
        sale: a.saleType,
        f: a.floor,
        rooms: a.rooms,
        area: a.area,
        outdoor: a.outdoor,
        kind: a.kind,
        park: a.parking,
        cat: a.category,
        price: a.price,
        storage: a.storage,
        ppsqm: a.pricePerSqm,
        rk: a.roomsBucket,
        top: a.isTopFloor,
        bottom: a.isBottomFloor,
      }).toEqual({
        b: u.b,
        plot: u.plot,
        n: u.n,
        typ: u.typ,
        sale: u.sale,
        f: u.f,
        rooms: u.rooms,
        area: u.area,
        outdoor: u.outdoor,
        kind: u.kind,
        park: u.park,
        cat: u.cat,
        price: u.price,
        storage: u.storage,
        ppsqm: u.ppsqm,
        rk: u.rk,
        top: u.top,
        bottom: u.bottom,
      });
    }
  });

  it('reproduces the peer comparison of every priced apartment bit-for-bit', () => {
    let priced = 0;
    for (const u of legacy.units) {
      const c = dataset.byId.get(u.id)!.comparison;
      if (u.gKey === undefined) {
        expect(c, u.id).toBeNull();
        continue;
      }
      priced++;
      expect(c, u.id).toEqual({
        key: u.gKey,
        label: u.gLabel,
        mean: u.gMean,
        delta: u.delta,
        rank: u.gRank,
        size: u.gN,
        min: u.gMin,
        max: u.gMax,
        meanOutdoor: u.gOut,
      });
    }
    expect(priced).toBe(325);
  });

  it('reproduces the building statistics', () => {
    for (const s of legacy.buildingStats) {
      expect(dataset.buildingStats.get(s.id)).toEqual({
        id: s.id,
        units: s.n,
        plot: s.plot,
        floorMin: s.fmin,
        floorMax: s.fmax,
        targetUnits: s.tgt,
        avgArea: s.avgArea,
        priceMin: s.pmin,
        priceMax: s.pmax,
        avgStorageArea: s.avgSto,
      });
    }
  });
});

describe('golden master: insights', () => {
  it('produces the same insights, in the same order, with identical text', () => {
    for (const u of legacy.units) {
      const a = dataset.byId.get(u.id)!;
      const actual = getInsights(a, dataset).map((i) => ({
        tone: i.tone === 'neutral' ? '' : i.tone,
        icon: i.icon,
        title: i.title,
        text: i.text,
      }));
      expect(actual, u.id).toEqual(legacy.insights[u.id]!.items);
    }
  });

  it('places the gauge marker at the same position', () => {
    for (const u of legacy.units) {
      const expected = legacy.insights[u.id]!.gauge;
      const a = dataset.byId.get(u.id)!;
      if (expected == null) expect(a.price).toBeNull();
      else expect(gaugePosition(a), u.id).toBe(expected);
    }
  });
});

describe('golden master: filters and sorting', () => {
  const toFilters = (s: (typeof legacy.filterScenarios)[number]): Filters => ({
    ...DEFAULT_FILTERS,
    budgetMin: s.min ?? 0,
    budgetMax: s.max ?? 0,
    rooms: (s.rooms ?? []) as Filters['rooms'],
    floorMin: s.fmin ?? null,
    floorMax: s.fmax ?? null,
    buildings: s.bld ?? [],
    category: (s.cat ?? 'all') as Filters['category'],
    flags: (s.flags ?? []) as Filters['flags'],
    storageFloors: s.sto ?? [],
    sort: SORT_PRESETS[(s.sort ?? 'ppsqm') as SortKey],
  });

  it.each(legacy.filterScenarios.map((s) => [s.name, s] as const))(
    'scenario %s: same apartments, same order, same per-building counts',
    (_name, s) => {
      const f = toFilters(s);
      expect(applyFilters(dataset, f).map((a) => a.id)).toEqual(s.ids);
      expect(Object.fromEntries(countByBuilding(dataset.apartments, f))).toEqual(s.counts);
    },
  );
});

describe('golden master: formatting', () => {
  it.each([
    ['fmt', fmt],
    ['money', money],
    ['pct', pct],
    ['m2', m2],
    ['fl', floorLabel],
    ['r1', r1],
    ['dirName', dirName],
  ] as const)('%s', (name, fn) => {
    for (const [input, expected] of legacy.format[name]) expect(fn(input)).toBe(expected);
  });
});

describe('golden master: solar and schematic', () => {
  it('computes identical sun positions', () => {
    for (const s of legacy.solar)
      expect(solarPosition(s.hour, s.doy)).toEqual({ el: s.el, az: s.az });
  });

  it('estimates identical sun hours', () => {
    for (const s of legacy.sunHours) expect(sunHours(s.az, s.doy)).toBe(s.h);
  });

  it('generates identical schematic layouts', () => {
    for (const [id, layout] of Object.entries(legacy.layouts)) {
      expect(layoutFor(dataset.byId.get(id)!)).toEqual(layout);
    }
  });
});

describe('golden master: export', () => {
  it('exports the same table as the legacy xlsx export', () => {
    const { head, rows } = buildExportTable(legacy.exportList, dataset);
    expect([head, ...rows]).toEqual(legacy.exportAoa);
  });
});
