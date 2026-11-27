import { describe, expect, it } from 'vitest';
import {
  categoryLabel,
  floorLabel,
  floorName,
  kindLabel,
  m2,
  mod,
  money,
  outdoorLabel,
  pct,
  storageLevelLabel,
} from '@/domain/format';

describe('format', () => {
  it('formats money with Hebrew thousands separators', () => {
    expect(money(1791623)).toBe('1,791,623 ₪');
  });

  it('wraps percentages in an LTR isolate with a real minus sign', () => {
    expect(pct(-0.044)).toBe('⁦−4.4%⁩');
    expect(pct(0)).toBe('⁦0.0%⁩');
  });

  it('formats areas with at most one decimal', () => {
    expect(m2(84.97)).toBe('85');
    expect(m2(5.84)).toBe('5.8');
  });

  it('labels floors (ground, negative, positive)', () => {
    expect(floorLabel(0)).toBe('קרקע');
    expect(floorLabel(-2)).toBe('‎−2');
    expect(floorLabel(7)).toBe('7');
    expect(floorName(0)).toBe('קרקע');
    expect(floorName(3)).toBe('קומה 3');
  });

  it('labels storage levels from their string value', () => {
    expect(storageLevelLabel('-1')).toBe('‎−1');
  });

  it('uses positive modulo', () => {
    expect(mod(-45, 360)).toBe(315);
    expect(mod(725, 360)).toBe(5);
  });

  it('labels category and kind', () => {
    expect(categoryLabel('target')).toBe('מחיר מטרה');
    expect(categoryLabel('free')).toBe('שוק חופשי');
    expect(kindLabel('G')).toBe('דירת גן');
    expect(kindLabel('P')).toBe('פנטהאוז');
    expect(kindLabel('T')).toBe('רגילה');
  });

  it('labels the outdoor area by apartment kind', () => {
    expect(outdoorLabel({ kind: 'G', outdoor: 80.25 })).toBe('גינה 80.3 מ״ר');
    expect(outdoorLabel({ kind: 'P', outdoor: 152.5 })).toBe('מרפסת גג 152.5 מ״ר');
    expect(outdoorLabel({ kind: 'T', outdoor: 12 })).toBe('מרפסת 12 מ״ר');
  });
});
