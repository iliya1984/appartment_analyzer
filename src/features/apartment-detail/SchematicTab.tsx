import { useId, useState } from 'react';
import { DIRS, isOrientation, ORIENTATIONS, type Orientation } from '@/domain/orientation';
import { SEASONS, type SeasonKey } from '@/domain/solar';
import type { Apartment } from '@/domain/types';
import { ApartmentViewer } from '@/features/viewer3d';
import { he } from '@/i18n/he';
import { controlClasses } from '@/shared/ui/Button';
import { ToggleChip, chipClasses } from '@/shared/ui/ChipGroup';
import { Banner, Section, TwoColumns } from '@/shared/ui/Content';
import { useMyListStore } from '@/store/myListStore';
import { RoomsTable } from './RoomsTable';
import styles from './SchematicTab.module.css';
import { SunControls } from './SunControls';

const T = he.schematic;

/** Viewer + controls. Re-mounted (fresh state) when the orientation changes, as in legacy. */
function SchematicStage({
  apartment,
  orientation,
  onOrientationChange,
}: {
  apartment: Apartment;
  orientation: Orientation | null;
  onOrientationChange: (deg: Orientation | null) => void;
}) {
  const selectId = useId();
  const [season, setSeason] = useState<SeasonKey>('winter');
  const [hour, setHour] = useState(9);
  const [autoRotate, setAutoRotate] = useState(true);
  const [labels, setLabels] = useState(true);

  return (
    <div>
      <ApartmentViewer
        apartment={apartment}
        orientation={orientation}
        sun={orientation != null ? { hour, dayOfYear: SEASONS[season].dayOfYear } : null}
        autoRotate={autoRotate}
        labels={labels}
        onUserInteract={() => setAutoRotate(false)}
      />
      <div className={styles.controls}>
        <div>
          <label className={`muted ${styles.smallLabel}`} htmlFor={selectId}>
            {T.orientation}
          </label>
          <select
            id={selectId}
            className={controlClasses.input}
            value={orientation ?? ''}
            onChange={(e) => {
              const v = e.target.value === '' ? null : Number(e.target.value);
              onOrientationChange(isOrientation(v) ? v : null);
            }}
          >
            <option value="">{T.unknown}</option>
            {ORIENTATIONS.map((deg, i) => (
              <option key={deg} value={deg}>
                {DIRS[i]}
              </option>
            ))}
          </select>
        </div>
        {orientation != null ? (
          <SunControls
            orientation={orientation}
            hour={hour}
            season={season}
            onHourChange={setHour}
            onSeasonChange={setSeason}
          />
        ) : (
          <p className={styles.readout}>{T.pickDirection}</p>
        )}
        <div className={`${chipClasses.chips} ${chipClasses.segmented}`}>
          <ToggleChip pressed={autoRotate} onPressedChange={setAutoRotate}>
            {T.autoRotate}
          </ToggleChip>
          <ToggleChip pressed={labels} onPressedChange={setLabels}>
            {T.labels}
          </ToggleChip>
        </div>
      </div>
    </div>
  );
}

export function SchematicTab({ apartment }: { apartment: Apartment }) {
  const orientation = useMyListStore((s) => s.orientation[apartment.id] ?? null);
  const setOrientation = useMyListStore((s) => s.setOrientation);
  return (
    <>
      <Banner>
        <b>{T.bannerStrong}</b>
        {T.banner}
      </Banner>
      <TwoColumns>
        <SchematicStage
          key={`${apartment.id}:${orientation ?? 'none'}`}
          apartment={apartment}
          orientation={orientation}
          onOrientationChange={(deg) => setOrientation(apartment.id, deg)}
        />
        <Section title={T.roomsTitle}>
          <RoomsTable apartment={apartment} />
        </Section>
      </TwoColumns>
    </>
  );
}
