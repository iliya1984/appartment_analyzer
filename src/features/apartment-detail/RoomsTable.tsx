import { r1 } from '@/domain/format';
import { layoutFor } from '@/domain/schematic';
import type { Apartment } from '@/domain/types';
import { he } from '@/i18n/he';
import { tableClasses } from '@/shared/ui/Content';

const T = he.schematic;

/** Estimated room sizes from the schematic layout. */
export function RoomsTable({ apartment }: { apartment: Apartment }) {
  const { rooms } = layoutFor(apartment);
  return (
    <table className={tableClasses.table}>
      <thead>
        <tr>
          <th>{T.colRoom}</th>
          <th>{T.colSize}</th>
          <th>{T.colArea}</th>
        </tr>
      </thead>
      <tbody>
        {rooms.map((r) => (
          <tr key={r.k}>
            <td>{r.name}</td>
            <td className={tableClasses.n}>{T.size(r1(r.w), r1(r.d))}</td>
            <td className={tableClasses.n}>{T.area((r.w * r.d).toFixed(1))}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
