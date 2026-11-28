import { lazy, Suspense } from 'react';
import { he } from '@/i18n/he';
import { ErrorBoundary } from '@/shared/ui/ErrorBoundary';
import type { PlanBrowserProps } from './PlanBrowser';

/** The viewer (and the image URL table) is only downloaded when a plan is opened. */
const LazyBrowser = lazy(() => import('./PlanBrowser'));

function Status({ text }: { text: string }) {
  return (
    <p role="status" className="muted">
      {text}
    </p>
  );
}

export function PlanBrowser(props: PlanBrowserProps) {
  return (
    <ErrorBoundary fallback={<Status text={he.plans.loadFailed} />}>
      <Suspense fallback={<Status text={he.plans.loading} />}>
        <LazyBrowser {...props} />
      </Suspense>
    </ErrorBoundary>
  );
}

export type { PlanBrowserProps } from './PlanBrowser';
export type { PlanMode, PlanState } from './modes';
export { isPlanMode, parsePlanState, PLAN_MODES, planStateParams } from './modes';
export { NoPlanNotice } from './NoPlanNotice';
export { buildingPlansPath } from './paths';
