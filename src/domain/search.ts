import { comparePlanType } from './sort';
import type { Apartment } from './types';

/**
 * Normalises an apartment-type code for matching: upper case, without spaces and hyphens.
 * A dot is kept only between two digits (`5.5`), so `T-T5.5F` → `TT5.5F` and `t.5a` → `T5A`.
 */
export function normalizeCode(s: string): string {
  return s
    .toUpperCase()
    .replace(/[\s-]+/g, '')
    .replace(/(?<!\d)\.|\.(?!\d)/g, '');
}

/** Splits the search text on commas, semicolons and whitespace → normalised, unique tokens. */
export function parseTypeQuery(text: string): string[] {
  const tokens = text
    .split(/[,;\s]+/)
    .map(normalizeCode)
    .filter((t) => t !== '');
  return [...new Set(tokens)];
}

const planCodes = new WeakMap<Apartment, string>();

function planCode(a: Apartment): string {
  let code = planCodes.get(a);
  if (code === undefined) {
    code = normalizeCode(a.planType);
    planCodes.set(a, code);
  }
  return code;
}

/**
 * True when any token matches: part of the plan type (`T5` finds `T-T5A`, `T-T5.5F` …), or
 * exactly the sale type (`AM` finds `AM` only, not `A`). An empty token list matches everything.
 */
export function matchesTypeQuery(a: Apartment, tokens: readonly string[]): boolean {
  if (!tokens.length) return true;
  const plan = planCode(a);
  const sale = normalizeCode(a.saleType);
  return tokens.some((t) => plan.includes(t) || sale === t);
}

/** Distinct plan types (natural order) and sale types, for the search autocomplete. */
export function typeSuggestions(apartments: readonly Apartment[]): {
  planTypes: string[];
  saleTypes: string[];
} {
  const plans = new Set<string>();
  const sales = new Set<string>();
  for (const a of apartments) {
    plans.add(a.planType);
    if (a.saleType) sales.add(a.saleType);
  }
  return {
    planTypes: [...plans].sort(comparePlanType),
    saleTypes: [...sales].sort(),
  };
}
