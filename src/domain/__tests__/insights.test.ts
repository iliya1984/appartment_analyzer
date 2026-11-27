import { describe, expect, it } from 'vitest';
import {
  bottomFloorRule,
  gaugePosition,
  getInsights,
  INSIGHT_RULES,
  outdoorRule,
  pricePositionRule,
  samePlanRule,
  storageRule,
  topFloorRule,
} from '@/domain/insights';
import type { Dataset } from '@/domain/types';
import { dataset, row } from '@/test/factories';

const ctx = (d: Dataset, building = 'A1') => ({
  dataset: d,
  building: d.buildingStats.get(building)!,
});

/** Four units of plan T-T4A (so they form a plan group) at increasing floors / prices. */
const planRows = (prices: (number | null)[]) =>
  prices.map((price, i) => row({ unit: i + 1, floor: i + 1, plan: 'T-T4A', price }));

describe('pricePositionRule', () => {
  it('flags unpublished free-market prices', () => {
    const d = dataset([row({ price: null, target: 0 })]);
    expect(pricePositionRule(d.apartments[0]!, ctx(d))).toMatchObject({
      id: 'price-free',
      tone: 'warn',
    });
  });

  it('classifies cheaper / pricier / average at the ±3 % threshold', () => {
    const d = dataset(planRows([900_000, 1_000_000, 1_000_000, 1_100_000]));
    const [cheap, avg, , dear] = d.apartments;
    expect(pricePositionRule(cheap!, ctx(d))).toMatchObject({ id: 'price-cheaper', tone: 'good' });
    expect(pricePositionRule(avg!, ctx(d))).toMatchObject({ id: 'price-average', tone: 'neutral' });
    const pricier = pricePositionRule(dear!, ctx(d))!;
    expect(pricier).toMatchObject({ id: 'price-pricier', tone: 'warn' });
    expect(pricier.text).toContain('בדרך כלל הפער נובע מקומה גבוהה יותר');
  });
});

describe('samePlanRule', () => {
  it('says when this is the lowest priced floor of its plan', () => {
    const d = dataset(planRows([1_000_000, 1_050_000, 1_100_000, 1_150_000]));
    expect(samePlanRule(d.apartments[0]!, ctx(d))).toMatchObject({
      id: 'plan-lowest',
      text: 'יש עוד 3 דירות מאותה תוכנית בבניין A1, כולן יקרות יותר.',
    });
  });

  it('gives the difference and per-floor cost relative to the lowest floor', () => {
    const d = dataset(planRows([1_000_000, 1_050_000, 1_100_000, 1_150_000]));
    const i = samePlanRule(d.apartments[2]!, ctx(d))!;
    expect(i.title).toBe('100,000 ₪ יותר מהדירה הזהה בקומה 1');
    expect(i.text).toBe(
      'באותו בניין, אותה תוכנית בקומה 1 עולה 1,000,000 ₪. זה 50,000 ₪ לכל קומה בממוצע.',
    );
  });

  it('omits the per-floor cost when both are on the same floor', () => {
    const d = dataset([
      row({ unit: 1, floor: 2, price: 1_000_000 }),
      row({ unit: 2, floor: 2, price: 1_100_000 }),
    ]);
    const i = samePlanRule(d.apartments[1]!, ctx(d))!;
    expect(i.text.endsWith('עולה 1,000,000 ₪. ')).toBe(true);
  });

  it('returns nothing for unpriced apartments or a plan with a single priced unit', () => {
    const d = dataset([row({ unit: 1, price: null }), row({ unit: 2, price: 1_000_000 })]);
    expect(samePlanRule(d.apartments[0]!, ctx(d))).toBeNull();
    expect(samePlanRule(d.apartments[1]!, ctx(d))).toBeNull();
  });
});

describe('storageRule', () => {
  it('warns about storage rooms well below the building average', () => {
    const d = dataset([
      row({ unit: 1, storageArea: 4, storageFloor: '-2', storageNo: '12' }),
      row({ unit: 2, storageArea: 8 }),
    ]);
    const i = storageRule(d.apartments[0]!, ctx(d))!;
    expect(i.tone).toBe('warn');
    expect(i.title).toBe('מחסן 12: 4 מ״ר, במפלס ‎−2');
    expect(i.text).toBe('ממוצע המחסנים בבניין A1 הוא 6 מ״ר, המחסן הזה קטן מהממוצע.');
  });

  it('mentions easier access for ground-level storage', () => {
    const d = dataset([row({ storageFloor: 'קרקע תחתון' })]);
    const i = storageRule(d.apartments[0]!, ctx(d))!;
    expect(i.tone).toBe('neutral');
    expect(i.title).toContain('בקרקע (תחתון)');
    expect(i.text).toContain('מחסן בקרקע נגיש יותר');
  });
});

describe('outdoorRule', () => {
  it('compares with the group average and notes unusually large outdoor areas', () => {
    const d = dataset([
      ...planRows([1_000_000, 1_000_000, 1_000_000]),
      row({ unit: 9, plan: 'T-T4A', outdoor: 40, price: 1_000_000 }),
    ]);
    const i = outdoorRule(d.byId.get('A1-9')!, ctx(d))!;
    expect(i.text).toContain('הדירה הזו עם שטח חיצוני גדול מהרגיל');
    expect(i.icon).toBe('🌤️');
  });

  it('uses the garden icon and a generic text when there is no peer group', () => {
    const d = dataset([row({ plan: 'T-G4A', price: null, outdoor: 60 })]);
    expect(outdoorRule(d.apartments[0]!, ctx(d))).toMatchObject({
      icon: '🌿',
      title: 'גינה 60 מ״ר',
      text: 'שטח המרפסת או הגינה כפי שמופיע בקובץ.',
    });
  });
});

describe('floor position rules', () => {
  it('notes the top floor', () => {
    const d = dataset([row({ unit: 1, floor: 0 }), row({ unit: 2, floor: 4 })]);
    expect(topFloorRule(d.apartments[1]!, ctx(d))).toMatchObject({ id: 'top-floor' });
    expect(topFloorRule(d.apartments[0]!, ctx(d))).toBeNull();
  });

  it('notes a bottom floor only at ground level or below, with a garden variant', () => {
    const d = dataset([row({ unit: 1, floor: 0, plan: 'T-G4A' }), row({ unit: 2, floor: 3 })]);
    expect(bottomFloorRule(d.apartments[0]!, ctx(d))?.title).toBe('דירת גן בקומה הנמוכה בבניין');
    const high = dataset([row({ unit: 1, floor: 2 }), row({ unit: 2, floor: 3 })]);
    expect(bottomFloorRule(high.apartments[0]!, ctx(high))).toBeNull();
    const regular = dataset([row({ unit: 1, floor: -1 }), row({ unit: 2, floor: 3 })]);
    expect(bottomFloorRule(regular.apartments[0]!, ctx(regular))?.title).toBe('קומה נמוכה בבניין');
  });
});

describe('getInsights', () => {
  it('runs every rule in order and skips rules that return null', () => {
    const d = dataset([row({ price: null })]);
    expect(getInsights(d.apartments[0]!, d).map((i) => i.id)).toEqual([
      'price-free',
      'storage',
      'outdoor',
      'parking',
      'top-floor',
    ]);
    expect(INSIGHT_RULES).toHaveLength(7);
  });

  it('accepts a custom rule list (extension point)', () => {
    const d = dataset([row()]);
    const custom = getInsights(d.apartments[0]!, d, [
      () => ({ id: 'x', tone: 'good', icon: '⭐', title: 't', text: 'x' }),
    ]);
    expect(custom).toEqual([{ id: 'x', tone: 'good', icon: '⭐', title: 't', text: 'x' }]);
  });

  it('returns nothing for an apartment of an unknown building', () => {
    const d = dataset([row()]);
    const other = dataset([row({ building: 'Z9' })]);
    expect(getInsights(other.apartments[0]!, d)).toEqual([]);
  });
});

describe('gaugePosition', () => {
  it('is centred for unpriced apartments and clamped to 2–98', () => {
    const d = dataset([
      ...planRows([500_000, 1_000_000, 1_000_000, 3_000_000]),
      row({ unit: 9, price: null }),
    ]);
    expect(gaugePosition(d.byId.get('A1-9')!)).toBe(50);
    expect(gaugePosition(d.byId.get('A1-1')!)).toBe(2);
    expect(gaugePosition(d.byId.get('A1-4')!)).toBe(98);
  });
});
