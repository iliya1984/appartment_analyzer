import { he } from '@/i18n/he';
import { floorLabel, m2, money, pct, storageLevelLabel } from './format';
import { samePlanUnits } from './related';
import type { Apartment, BuildingStats, Dataset } from './types';

export type InsightTone = 'good' | 'warn' | 'neutral';

export interface Insight {
  /** Stable id of the rule that produced it (for keys and tests). */
  id: string;
  tone: InsightTone;
  icon: string;
  title: string;
  text: string;
}

export interface InsightContext {
  dataset: Dataset;
  building: BuildingStats;
}

/** A rule returns zero or one insight. Rules run in the order of `INSIGHT_RULES`. */
export type InsightRule = (a: Apartment, ctx: InsightContext) => Insight | null;

/** |delta| ≥ 3 % counts as cheaper / pricier than peers. */
export const DELTA_THRESHOLD = 0.03;
/** A storage room under 85 % of the building average is "small". */
export const SMALL_STORAGE_RATIO = 0.85;
/** Outdoor area over 115 % of the group average is "large". */
export const LARGE_OUTDOOR_RATIO = 1.15;

const I = he.insights;

export const pricePositionRule: InsightRule = (a) => {
  const c = a.comparison;
  if (a.price == null || !c) {
    return { id: 'price-free', tone: 'warn', icon: '💰', title: I.freeTitle, text: I.freeText };
  }
  const base = I.vsPeers(pct(c.delta), c.size, c.label);
  if (c.delta <= -DELTA_THRESHOLD)
    return { id: 'price-cheaper', tone: 'good', icon: '💰', title: I.cheaperTitle, text: base };
  if (c.delta >= DELTA_THRESHOLD)
    return {
      id: 'price-pricier',
      tone: 'warn',
      icon: '💰',
      title: I.pricierTitle,
      text: base + I.pricierNote,
    };
  return { id: 'price-average', tone: 'neutral', icon: '💰', title: I.averageTitle, text: base };
};

export const samePlanRule: InsightRule = (a, { dataset }) => {
  if (a.price == null) return null;
  const same = samePlanUnits(dataset, a).filter((x) => x.price != null);
  const lowest = same[0];
  if (same.length < 2 || lowest?.price == null) return null;
  if (lowest.id === a.id) {
    return {
      id: 'plan-lowest',
      tone: 'good',
      icon: '🏢',
      title: I.lowestOfPlanTitle,
      text: I.lowestOfPlanText(same.length - 1, a.building),
    };
  }
  const diff = a.price - lowest.price;
  const floors = a.floor - lowest.floor;
  return {
    id: 'plan-above-lowest',
    tone: 'neutral',
    icon: '🏢',
    title: I.aboveLowestTitle(money(diff), floorLabel(lowest.floor)),
    text: I.aboveLowestText(
      floorLabel(lowest.floor),
      money(lowest.price),
      floors > 0 ? money(diff / floors) : null,
    ),
  };
};

export const storageWhere = (a: Apartment): string =>
  a.storage.floor === 'קרקע'
    ? I.storageWhereGround(a.storage.sub)
    : I.storageWhereLevel(storageLevelLabel(a.storage.floor));

export const storageRule: InsightRule = (a, { building }) => {
  const area = a.storage.area;
  const avg = building.avgStorageArea;
  const small = area < avg * SMALL_STORAGE_RATIO;
  return {
    id: 'storage',
    tone: small ? 'warn' : 'neutral',
    icon: '📦',
    title: I.storageTitle(a.storage.no, m2(area), storageWhere(a)),
    text: I.storageText(a.building, m2(avg), small, a.storage.floor === 'קרקע'),
  };
};

export const outdoorName = (a: Pick<Apartment, 'kind'>): string => I.outdoorNames[a.kind];

export const outdoorRule: InsightRule = (a) => {
  const c = a.comparison;
  return {
    id: 'outdoor',
    tone: 'neutral',
    icon: a.kind === 'G' ? '🌿' : '🌤️',
    title: I.outdoorTitle(outdoorName(a), m2(a.outdoor)),
    text: c
      ? I.outdoorVsGroup(m2(c.meanOutdoor), a.outdoor > c.meanOutdoor * LARGE_OUTDOOR_RATIO)
      : I.outdoorNoGroup,
  };
};

export const parkingRule: InsightRule = (a) => ({
  id: 'parking',
  tone: 'neutral',
  icon: '🚗',
  title: I.parkingTitle(a.parking),
  text: I.parkingText,
});

export const topFloorRule: InsightRule = (a) =>
  a.isTopFloor
    ? { id: 'top-floor', tone: 'neutral', icon: '🏙️', title: I.topTitle, text: I.topText }
    : null;

export const bottomFloorRule: InsightRule = (a) =>
  a.isBottomFloor && a.floor <= 0
    ? {
        id: 'bottom-floor',
        tone: 'neutral',
        icon: '🚪',
        title: a.kind === 'G' ? I.bottomGardenTitle : I.bottomTitle,
        text: I.bottomText,
      }
    : null;

export const INSIGHT_RULES: readonly InsightRule[] = [
  pricePositionRule,
  samePlanRule,
  storageRule,
  outdoorRule,
  parkingRule,
  topFloorRule,
  bottomFloorRule,
];

export function getInsights(
  a: Apartment,
  dataset: Dataset,
  rules: readonly InsightRule[] = INSIGHT_RULES,
): Insight[] {
  const building = dataset.buildingStats.get(a.building);
  if (!building) return [];
  const ctx: InsightContext = { dataset, building };
  return rules.flatMap((rule) => rule(a, ctx) ?? []);
}

/** Marker position (percent from the inline start) on the cheap ↔ expensive gauge. */
export function gaugePosition(a: Apartment): number {
  const c = a.comparison;
  if (a.price == null || !c) return 50;
  return Math.max(2, Math.min(98, 50 + c.delta * 500));
}
