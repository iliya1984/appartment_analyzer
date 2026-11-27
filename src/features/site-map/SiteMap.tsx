import { type ReactNode, useLayoutEffect, useRef } from 'react';
import { SITE_PTS } from '@/data/site-map.config';
import { he } from '@/i18n/he';
import { Legend } from '@/shared/ui/Content';
import { useFiltersStore } from '@/store/filtersStore';
import { useDataset, useFilteredApartments, useMatchCountsByBuilding } from '@/store/selectors';
import { BuildingHotspot } from './BuildingHotspot';
import { SiteImage } from './SiteImage';
import styles from './SiteMap.module.css';

/**
 * Clickable project map: each building shows how many apartments match the filters; clicking
 * selects only that building (clicking it again clears the selection).
 */
export function SiteMap({ children }: { children?: ReactNode }) {
  const dataset = useDataset();
  const counts = useMatchCountsByBuilding();
  const matching = useFilteredApartments().length;
  const selected = useFiltersStore((s) => s.filters.buildings);
  const pickBuilding = useFiltersStore((s) => s.pickBuilding);
  const scroller = useRef<HTMLDivElement>(null);

  // On narrow screens the map scrolls sideways: start centred (RTL → negative scrollLeft).
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    if (max > 0) el.scrollLeft = -max / 2;
  }, []);

  return (
    <section className={styles.map} aria-label={he.map.title}>
      <div className={styles.head}>
        <h2>{he.map.title}</h2>
        <span className="muted num">{he.map.count(matching, dataset.apartments.length)}</span>
      </div>
      <div className={styles.scroller} ref={scroller}>
        <SiteImage svgLabel={he.map.pickerLabel}>
          {dataset.buildings.map((b) => {
            const p = SITE_PTS[b];
            if (!p) return null;
            return (
              <BuildingHotspot
                key={b}
                building={b}
                x={p[0]}
                y={p[1]}
                count={counts.get(b) ?? 0}
                selected={selected.includes(b)}
                onPick={pickBuilding}
              />
            );
          })}
        </SiteImage>
      </div>
      <Legend>
        <span>{he.map.hint}</span>
      </Legend>
      {children}
    </section>
  );
}
