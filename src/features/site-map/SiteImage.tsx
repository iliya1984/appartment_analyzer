import type { ReactNode } from 'react';
import { SITE_H, SITE_IMAGE, SITE_W } from '@/data/site-map.config';
import { he } from '@/i18n/he';
import styles from './SiteMap.module.css';

/** The project render with an SVG overlay in image-pixel coordinates. */
export function SiteImage({ children, svgLabel }: { children: ReactNode; svgLabel?: string }) {
  return (
    <div className={styles.site}>
      <img src={SITE_IMAGE} alt={he.map.imageAlt} width={SITE_W} height={SITE_H} />
      <svg
        viewBox={`0 0 ${SITE_W} ${SITE_H}`}
        {...(svgLabel ? { role: 'group', 'aria-label': svgLabel } : { 'aria-hidden': true })}
      >
        {children}
      </svg>
    </div>
  );
}
