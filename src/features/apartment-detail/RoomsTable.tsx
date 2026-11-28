import { m2, r1 } from '@/domain/format';
import { netArea, type PlanModel } from '@/domain/planModel';
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

/** Real room areas from the plan model (net, without walls) and the official area. */
export function PlanRoomsTable({ apartment, model }: { apartment: Apartment; model: PlanModel }) {
  const TM = he.model;
  const rows = [...model.rooms, ...model.outdoor];
  return (
    <>
      <table className={tableClasses.table}>
        <thead>
          <tr>
            <th>{TM.colRoom}</th>
            <th>{TM.colArea}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.label}</td>
              <td className={tableClasses.n}>{T.area(r.areaM2.toFixed(1))}</td>
            </tr>
          ))}
          <tr>
            <th scope="row">{TM.totalNet}</th>
            <td className={tableClasses.n}>{T.area(netArea(model).toFixed(1))}</td>
          </tr>
        </tbody>
      </table>
      <p className="muted" style={{ fontSize: 13, margin: '8px 0 0' }}>
        {TM.officialArea(m2(apartment.area))}
      </p>
    </>
  );
}
