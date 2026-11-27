import { fmt, money } from '@/domain/format';
import type { Apartment } from '@/domain/types';
import { he } from '@/i18n/he';

const T = he.insightsTab;

/** The four headline numbers of the insights tab: [label, value]. */
export function getKpis(a: Apartment): [string, string][] {
  const c = a.price != null ? a.comparison : null;
  return [
    [T.kpiPrice, a.price != null ? money(a.price) : he.common.notPublished],
    [T.kpiPerSqm, c && a.pricePerSqm != null ? `${fmt(a.pricePerSqm)} ₪` : he.common.dash],
    [T.kpiPeerMean, c ? `${fmt(c.mean)} ₪` : he.common.dash],
    [T.kpiRank, c ? T.rankOf(c.rank, c.size) : he.common.dash],
  ];
}

/** Labels under the gauge: cheapest, mean, most expensive (per m²). */
export function getGaugeLabels(a: Apartment): [string, string, string] | null {
  const c = a.comparison;
  if (a.price == null || !c) return null;
  return [T.gaugeMin(fmt(c.min)), T.gaugeMean(fmt(c.mean)), T.gaugeMax(fmt(c.max))];
}
