import { describe, expect, it } from 'vitest';
import { dirName, isOrientation, ORIENTATIONS } from '@/domain/orientation';
import { layoutFor, layoutKey, ROOM_COLOR } from '@/domain/schematic';
import { formatSolarHour, SEASON_KEYS, SEASONS, solarPosition, sunHours } from '@/domain/solar';

describe('solar', () => {
  it('puts the sun due south at solar noon, higher in summer than in winter', () => {
    const summer = solarPosition(12, SEASONS.summer.dayOfYear);
    const winter = solarPosition(12, SEASONS.winter.dayOfYear);
    expect(summer.az).toBeCloseTo(180, 5);
    expect(summer.el).toBeGreaterThan(winter.el);
    expect(summer.el).toBeCloseTo(90 - 32.8 + 23.44, 0);
  });

  it('rises in the east and sets in the west', () => {
    expect(solarPosition(7, 80).az).toBeLessThan(180);
    expect(solarPosition(17, 80).az).toBeGreaterThan(180);
    expect(solarPosition(0, 80).el).toBeLessThan(0);
  });

  it('gives south-facing apartments more winter sun than north-facing ones', () => {
    expect(sunHours(180, SEASONS.winter.dayOfYear)).toBeGreaterThan(
      sunHours(0, SEASONS.winter.dayOfYear),
    );
  });

  it('formats solar hours as HH:MM', () => {
    expect(formatSolarHour(9)).toBe('09:00');
    expect(formatSolarHour(15.25)).toBe('15:15');
    expect(formatSolarHour(19.5)).toBe('19:30');
  });

  it('defines three seasons', () => {
    expect(SEASON_KEYS.map((k) => SEASONS[k].name)).toEqual(['חורף', 'אביב/סתיו', 'קיץ']);
  });
});

describe('orientation', () => {
  it('validates 45° steps', () => {
    expect(ORIENTATIONS.every(isOrientation)).toBe(true);
    expect(isOrientation(30)).toBe(false);
    expect(isOrientation('90')).toBe(false);
  });

  it('names compass directions', () => {
    expect(dirName(180)).toBe('דרום');
    expect(dirName(-90)).toBe('מערב');
  });
});

describe('schematic layout', () => {
  it('clamps the layout size to 3–6 rooms', () => {
    expect(layoutKey(2)).toBe(3);
    expect(layoutKey(4.5)).toBe(4);
    expect(layoutKey(7)).toBe(6);
  });

  it.each([3, 4, 5, 6])('%d rooms: tiles the whole area with coloured rooms', (rooms) => {
    const l = layoutFor({ rooms, area: 110 });
    expect(l.W * l.D).toBeCloseTo(110, 6);
    const sum = l.rooms.reduce((s, r) => s + r.w * r.d, 0);
    expect(sum).toBeCloseTo(110, 6);
    expect(l.rooms[0]?.k).toBe('salon');
    for (const r of l.rooms) expect(ROOM_COLOR[r.k]).toMatch(/^#[0-9a-f]{6}$/);
  });
});
