import type { Apartment, Dataset } from './types';

/** Apartments on the same floor of the same building, by unit number. */
export const sameFloorUnits = (d: Dataset, a: Apartment): Apartment[] =>
  d.apartments
    .filter((x) => x.building === a.building && x.floor === a.floor)
    .sort((x, y) => x.number - y.number);

/** Apartments of the same plan type in the same building, lowest floor first. */
export const samePlanUnits = (d: Dataset, a: Apartment): Apartment[] =>
  d.apartments
    .filter((x) => x.building === a.building && x.planType === a.planType)
    .sort((x, y) => x.floor - y.floor);

/** Apartments of a building on a given floor, by unit number. */
export const unitsOnFloor = (d: Dataset, building: string, floor: number): Apartment[] =>
  d.apartments
    .filter((x) => x.building === building && x.floor === floor)
    .sort((x, y) => x.number - y.number);
