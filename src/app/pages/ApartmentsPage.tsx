import { useOpenApartment } from '@/features/apartment-detail';
import { ApartmentList } from '@/features/apartment-list';
import { BuildingElevation } from '@/features/elevation';
import { FiltersPanel } from '@/features/filters';
import { SiteMap } from '@/features/site-map';

/** Map (with the selected building's floors), filters and the apartment cards. */
export function ApartmentsPage() {
  const open = useOpenApartment();
  return (
    <main>
      <SiteMap>
        <BuildingElevation onOpenApartment={open} />
      </SiteMap>
      <FiltersPanel />
      <ApartmentList />
    </main>
  );
}
