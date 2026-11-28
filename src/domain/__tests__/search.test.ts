import { describe, expect, it } from 'vitest';
import { builtInDataset } from '@/data/builtIn';
import { matchesTypeQuery, normalizeCode, parseTypeQuery, typeSuggestions } from '@/domain/search';
import { dataset, row } from '@/test/factories';

describe('normalizeCode', () => {
  it('upper-cases and drops hyphens and spaces', () => {
    expect(normalizeCode('t-t5a')).toBe('TT5A');
    expect(normalizeCode(' T - T5A ')).toBe('TT5A');
  });

  it('keeps a dot only between digits', () => {
    expect(normalizeCode('T-T5.5F')).toBe('TT5.5F');
    expect(normalizeCode('5.5')).toBe('5.5');
    expect(normalizeCode('t.5a')).toBe('T5A');
    expect(normalizeCode('5.')).toBe('5');
    expect(normalizeCode('.5')).toBe('5');
  });

  it('keeps sale-type marks such as *', () => {
    expect(normalizeCode('a*')).toBe('A*');
  });
});

describe('parseTypeQuery', () => {
  it('splits on commas, semicolons and whitespace, de-duplicating', () => {
    expect(parseTypeQuery(' t5a, T6D;am  T5A ')).toEqual(['T5A', 'T6D', 'AM']);
  });

  it('returns no tokens for empty text', () => {
    expect(parseTypeQuery('')).toEqual([]);
    expect(parseTypeQuery(' ,, ; ')).toEqual([]);
    expect(parseTypeQuery('-')).toEqual([]);
  });
});

describe('matchesTypeQuery', () => {
  const d = dataset([
    row({ unit: 1, plan: 'T-T5A', sale: 'A' }),
    row({ unit: 2, plan: 'T-T5.5F', sale: 'AM' }),
    row({ unit: 3, plan: 'T-G5I', sale: 'AG' }),
    row({ unit: 4, plan: 'T-P6D', sale: 'P1' }),
    row({ unit: 5, plan: 'T-T3C', sale: 'C*' }),
  ]);
  const hits = (text: string) =>
    d.apartments.filter((a) => matchesTypeQuery(a, parseTypeQuery(text))).map((a) => a.number);

  it('matches everything for an empty query', () => {
    expect(hits('')).toEqual([1, 2, 3, 4, 5]);
  });

  it('matches part of the plan type, ignoring case and hyphens', () => {
    expect(hits('t5a')).toEqual([1]);
    expect(hits('T-T5A')).toEqual([1]);
    expect(hits('tt5a')).toEqual([1]);
    expect(hits('T5')).toEqual([1, 2]);
    expect(hits('5.5')).toEqual([2]);
    expect(hits('G5')).toEqual([3]);
  });

  it('matches the sale type exactly', () => {
    expect(hits('AM')).toEqual([2]);
    expect(hits('c*')).toEqual([5]);
    expect(hits('P1')).toEqual([4]);
  });

  it('ORs several tokens', () => {
    expect(hits('T5A, P6')).toEqual([1, 4]);
    expect(hits('T3C AM')).toEqual([2, 5]);
  });

  it('matches nothing for an unknown type', () => {
    expect(hits('ZZ9')).toEqual([]);
  });
});

describe('typeSuggestions', () => {
  it('lists the distinct plan and sale types of the built-in data', () => {
    const s = typeSuggestions(builtInDataset.apartments);
    expect(s.planTypes).toHaveLength(32);
    expect(s.saleTypes).toHaveLength(13);
    expect(s.planTypes[0]).toBe('T-T3B');
    expect(s.planTypes).toContain('T-P6.5F');
    expect(s.saleTypes).toContain('AM');
  });
});
