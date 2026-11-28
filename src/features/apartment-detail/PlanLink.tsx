import { resolveSheet } from '@/domain/floorPlans';
import type { Apartment } from '@/domain/types';
import { floorPlanManifest } from '@/data/floor-plans/manifest';
import { he } from '@/i18n/he';
import { PlanIcon } from '@/shared/icons/PlanIcon';
import { ApartmentLink } from './navigation';

/** Icon link that opens the apartment on its "תוכנית" tab; nothing when no plan covers it. */
export function PlanLink({
  apartment,
  className,
}: {
  apartment: Pick<Apartment, 'id' | 'building' | 'floor' | 'planType'>;
  className?: string | undefined;
}) {
  if (!resolveSheet(floorPlanManifest, apartment)) return null;
  return (
    <ApartmentLink
      apartmentId={apartment.id}
      tab="plans"
      className={className}
      aria-label={he.plans.planOfUnit}
      title={he.plans.planOfUnit}
    >
      <PlanIcon />
    </ApartmentLink>
  );
}
