import { SITE_PTS } from '@/data/site-map.config';
import { he } from '@/i18n/he';
import { SiteImage } from './SiteImage';
import styles from './SiteMap.module.css';

/** Static map with one building circled (used in the apartment sheet). */
export function HighlightedSiteMap({ building }: { building: string }) {
  const p = SITE_PTS[building];
  return (
    // Focusable so keyboard users can scroll it sideways on narrow screens.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
    <div className={styles.scroller} tabIndex={0} role="region" aria-label={he.map.imageAlt}>
      <SiteImage>
        {p && (
          <circle
            cx={p[0]}
            cy={p[1]}
            r={36}
            fill="none"
            stroke="#E59B0B"
            strokeWidth={9}
            data-testid="highlight"
          />
        )}
      </SiteImage>
    </div>
  );
}
