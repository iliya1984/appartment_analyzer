import { useId } from 'react';
import { dirName } from '@/domain/orientation';
import {
  formatSolarHour,
  SEASON_KEYS,
  SEASONS,
  type SeasonKey,
  solarPosition,
  sunHours,
} from '@/domain/solar';
import type { Orientation } from '@/domain/orientation';
import { he } from '@/i18n/he';
import { ChipGroup } from '@/shared/ui/ChipGroup';
import styles from './SchematicTab.module.css';

const T = he.schematic;
const PRESETS = ['9', '12', '16'] as const;
const PRESET_ITEMS = PRESETS.map((h) => ({ value: h, label: T.presets[h] }));
const SEASON_ITEMS = SEASON_KEYS.map((k) => ({ value: k, label: SEASONS[k].name }));

export interface SunControlsProps {
  orientation: Orientation;
  hour: number;
  season: SeasonKey;
  onHourChange: (hour: number) => void;
  onSeasonChange: (season: SeasonKey) => void;
}

/** Time presets, solar-hour slider, season, current sun position and direct-sun estimate. */
export function SunControls({
  orientation,
  hour,
  season,
  onHourChange,
  onSeasonChange,
}: SunControlsProps) {
  const sliderId = useId();
  const s = solarPosition(hour, SEASONS[season].dayOfYear);
  const time = formatSolarHour(hour);
  const preset = PRESETS.find((p) => Number(p) === hour) ?? null;
  return (
    <>
      <ChipGroup
        mode="single"
        segmented
        label={T.presetsLabel}
        items={PRESET_ITEMS}
        selected={preset}
        onSelect={(h) => onHourChange(Number(h))}
      />
      <div>
        <label className={`muted ${styles.smallLabel}`} htmlFor={sliderId}>
          {T.hour}
        </label>
        <input
          id={sliderId}
          type="range"
          min={5}
          max={19.5}
          step={0.25}
          value={hour}
          aria-valuetext={time}
          onChange={(e) => onHourChange(Number(e.target.value))}
        />
      </div>
      <ChipGroup
        mode="single"
        segmented
        label={T.seasonsLabel}
        items={SEASON_ITEMS}
        selected={season}
        onSelect={onSeasonChange}
      />
      <p className={styles.readout} aria-live="polite">
        {s.el > 0 ? (
          <>
            <b className="num">{time}</b> · {T.sunUp} <b className="num">{Math.round(s.el)}°</b> ·{' '}
            {T.sunDir} <b>{dirName(s.az)}</b>
          </>
        ) : (
          <>
            <b className="num">{time}</b> · {T.sunDown}
          </>
        )}
      </p>
      <p className={styles.readout}>
        {T.sunHoursPrefix}
        <b className="num">{sunHours(orientation, SEASONS.winter.dayOfYear).toFixed(1)}</b>
        {T.sunHoursWinter}
        <b className="num">{sunHours(orientation, SEASONS.summer.dayOfYear).toFixed(1)}</b>
        {T.sunHoursSummer}
      </p>
    </>
  );
}
