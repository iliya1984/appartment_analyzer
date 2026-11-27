import { m2, money } from '@/domain/format';
import type { Apartment } from '@/domain/types';
import { he } from '@/i18n/he';
import { cx } from '@/shared/lib/cx';
import { TableScroll, tableClasses } from '@/shared/ui/Content';
import { ApartmentLink, useOpenApartment } from './navigation';

export interface UnitsTableProps {
  units: readonly Apartment[];
  currentId: string;
  /** Header and value of the first column (unit number or floor). */
  firstColumn: { header: string; value: (a: Apartment) => string | number };
}

const T = he.buildingTab;

/**
 * Apartments as table rows. The first cell links to the apartment (keyboard access); the whole
 * row is also clickable with the mouse, as in the legacy site.
 */
export function UnitsTable({ units, currentId, firstColumn }: UnitsTableProps) {
  const open = useOpenApartment();
  return (
    <TableScroll>
      <table className={tableClasses.table}>
        <thead>
          <tr>
            <th>{firstColumn.header}</th>
            <th>{T.colSale}</th>
            <th>{T.colRooms}</th>
            <th>{T.colArea}</th>
            <th>{T.colPrice}</th>
          </tr>
        </thead>
        <tbody>
          {units.map((x) => (
            // Mouse convenience only; keyboard and screen-reader users use the link in the first cell.

            <tr
              key={x.id}
              className={cx(tableClasses.clickable, x.id === currentId && tableClasses.current)}
              aria-current={x.id === currentId ? 'true' : undefined}
              onClick={(e) => {
                if ((e.target as HTMLElement).closest('a')) return;
                open(x.id, 'building');
              }}
            >
              <td className={tableClasses.n}>
                <ApartmentLink
                  apartmentId={x.id}
                  tab="building"
                  aria-label={T.goTo(x.number, x.building)}
                  style={{ color: 'inherit', textDecoration: 'none' }}
                >
                  {firstColumn.value(x)}
                </ApartmentLink>
              </td>
              <td>{x.saleType}</td>
              <td className={tableClasses.n}>{x.rooms}</td>
              <td className={tableClasses.n}>{m2(x.area)}</td>
              <td className={tableClasses.n}>
                {x.price != null ? money(x.price) : he.common.notPublished}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableScroll>
  );
}
