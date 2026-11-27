import { he } from '@/i18n/he';
import type { ApartmentKind, PeerComparison } from './types';

/** Minimal shape needed to compare an apartment with its peers. */
export interface ComparableUnit {
  id: string;
  planType: string;
  roomsBucket: number;
  kind: ApartmentKind;
  pricePerSqm: number | null;
  outdoor: number;
}

/** A plan type needs at least this many priced units to be its own peer group. */
export const MIN_PLAN_GROUP = 4;

/**
 * Groups priced units into peer groups and computes each unit's position in its group.
 * Peers are units of the same plan type; when a plan has fewer than four priced units, the
 * group falls back to "same room bucket + same kind".
 *
 * Iteration order (and therefore floating-point summation order and tie-breaking of the
 * stable sort) follows the input order, exactly like the legacy implementation.
 */
export function computePeerComparisons(
  units: readonly ComparableUnit[],
): Map<string, PeerComparison> {
  const priced = units.filter(
    (u): u is ComparableUnit & { pricePerSqm: number } => u.pricePerSqm != null,
  );

  const planCount = new Map<string, number>();
  for (const u of priced) planCount.set(u.planType, (planCount.get(u.planType) ?? 0) + 1);

  const groups = new Map<string, { label: string; members: typeof priced }>();
  for (const u of priced) {
    const byPlan = (planCount.get(u.planType) ?? 0) >= MIN_PLAN_GROUP;
    const key = byPlan ? `p:${u.planType}` : `k:${u.roomsBucket}${u.kind}`;
    const label = byPlan
      ? he.insights.peerLabelPlan(u.planType)
      : he.insights.peerLabelRooms(u.roomsBucket, he.kind[u.kind]);
    let g = groups.get(key);
    if (!g) {
      g = { label, members: [] };
      groups.set(key, g);
    }
    g.members.push(u);
  }

  const out = new Map<string, PeerComparison>();
  for (const [key, { label, members }] of groups) {
    const mean = members.reduce((s, u) => s + u.pricePerSqm, 0) / members.length;
    const meanOutdoor = members.reduce((s, u) => s + u.outdoor, 0) / members.length;
    const sorted = members.slice().sort((a, b) => a.pricePerSqm - b.pricePerSqm);
    const min = sorted[0]?.pricePerSqm ?? 0;
    const max = sorted[sorted.length - 1]?.pricePerSqm ?? 0;
    sorted.forEach((u, i) => {
      out.set(u.id, {
        key,
        label,
        mean,
        delta: u.pricePerSqm / mean - 1,
        rank: i + 1,
        size: members.length,
        min,
        max,
        meanOutdoor,
      });
    });
  }
  return out;
}
