import { lazy, Suspense } from 'react';
import { he } from '@/i18n/he';
import { ErrorBoundary } from '@/shared/ui/ErrorBoundary';
import type { ApartmentViewerProps } from './ApartmentViewer';
import styles from './ApartmentViewer.module.css';

/** three.js (~600 kB) is only downloaded when the schematic tab opens. */
const LazyViewer = lazy(() => import('./ApartmentViewer'));

function Placeholder({ text }: { text: string }) {
  return (
    <div className={styles.stage}>
      <p className={styles.message} role="status">
        {text}
      </p>
    </div>
  );
}

export function ApartmentViewer(props: ApartmentViewerProps) {
  return (
    <ErrorBoundary fallback={<Placeholder text={he.schematic.loadFailed} />}>
      <Suspense fallback={<Placeholder text={he.schematic.loading} />}>
        <LazyViewer {...props} />
      </Suspense>
    </ErrorBoundary>
  );
}

export type { ApartmentViewerProps };
