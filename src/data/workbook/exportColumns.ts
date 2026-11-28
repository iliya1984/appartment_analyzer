import { categoryLabel, kindLabel } from '@/domain/format';
import type { Apartment } from '@/domain/types';
import { he } from '@/i18n/he';
import type { Cell, ExportColumn, NumberFormat } from './exportTable';

type ApartmentValue = (a: Apartment) => Cell;

/** Values of the shared apartment columns, in `he.exportSheet.apartmentHead` order. */
const VALUES: readonly (readonly [ApartmentValue, NumberFormat?])[] = [
  [(a) => a.building],
  [(a) => a.number],
  [(a) => a.floor],
  [(a) => a.rooms],
  [(a) => a.area],
  [(a) => a.outdoor],
  [(a) => kindLabel(a.kind)],
  [(a) => a.planType],
  [(a) => a.saleType],
  [(a) => a.price ?? he.common.notPublished, '#,##0'],
  [(a) => (a.pricePerSqm != null ? Math.round(a.pricePerSqm) : '')],
  [(a) => (a.comparison ? +a.comparison.delta.toFixed(4) : ''), '0.0%'],
  [(a) => categoryLabel(a.category)],
  [(a) => a.storage.no],
  [(a) => a.storage.floor],
  [(a) => a.storage.area],
  [(a) => a.parking],
];

/**
 * The apartment columns shared by every export. `get` maps an export row to its apartment,
 * so the same columns work for list entries and for plain apartments.
 */
export function apartmentColumns<R>(get: (row: R) => Apartment): ExportColumn<R>[] {
  return he.exportSheet.apartmentHead.map((head, i) => {
    const [value, format] = VALUES[i] ?? [() => ''];
    return { head, value: (r: R) => value(get(r)), ...(format ? { format } : {}) };
  });
}
