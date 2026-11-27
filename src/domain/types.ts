/**
 * One row of the contractor's price workbook ("דירות" sheet), in column order:
 * [building, plot, unitNo, planType, saleType, floor, rooms, area, outdoorArea, storageArea,
 *  parking, isTargetPrice (1|0), price | null, storageNo, storageFloor]
 */
export type RawRow = readonly [
  building: string,
  plot: number,
  unitNo: number,
  planType: string,
  saleType: string,
  floor: number,
  rooms: number,
  area: number,
  outdoorArea: number,
  storageArea: number,
  parking: number,
  isTargetPrice: 0 | 1,
  price: number | null,
  storageNo: string,
  storageFloor: string,
];

export interface ProjectMeta {
  /** Developer / contractor name. */
  dev: string;
  lottery: number;
  /** Base price per m² incl. VAT, before discount (₪). */
  base: number;
  /** Source workbook file name. */
  file: string;
}

/** Third letter of the plan type: T = regular, G = garden, P = penthouse. */
export type ApartmentKind = 'T' | 'G' | 'P';
export type PriceCategory = 'target' | 'free';
/** 'קרקע' (ground) or a numeric level such as '-1'. */
export type StorageFloor = string;
export type StorageSub = '' | 'עליון' | 'תחתון';

export interface StorageUnit {
  no: string;
  area: number;
  floor: StorageFloor;
  sub: StorageSub;
}

/** How a priced apartment compares with its peer group (same plan, or same rooms + kind). */
export interface PeerComparison {
  key: string;
  /** Hebrew label used in sentences, e.g. "מתוכנית T-T5A". */
  label: string;
  /** Mean price per m² of the group. */
  mean: number;
  /** pricePerSqm / mean - 1. */
  delta: number;
  /** 1 = cheapest per m² in the group. */
  rank: number;
  size: number;
  min: number;
  max: number;
  /** Mean outdoor area (balcony / garden) of the group. */
  meanOutdoor: number;
}

export interface Apartment {
  id: string;
  building: string;
  plot: number;
  number: number;
  planType: string;
  saleType: string;
  floor: number;
  rooms: number;
  /** min(6, floor(rooms)) — used by the rooms filter and peer grouping. */
  roomsBucket: number;
  area: number;
  outdoor: number;
  kind: ApartmentKind;
  parking: number;
  category: PriceCategory;
  price: number | null;
  pricePerSqm: number | null;
  storage: StorageUnit;
  isTopFloor: boolean;
  isBottomFloor: boolean;
  comparison: PeerComparison | null;
}

export interface BuildingStats {
  id: string;
  units: number;
  plot: number;
  floorMin: number;
  floorMax: number;
  targetUnits: number;
  avgArea: number;
  priceMin: number | null;
  priceMax: number | null;
  avgStorageArea: number;
}

export interface Dataset {
  meta: ProjectMeta;
  apartments: readonly Apartment[];
  byId: ReadonlyMap<string, Apartment>;
  /** Building ids in display order (letter, then number). */
  buildings: readonly string[];
  buildingStats: ReadonlyMap<string, BuildingStats>;
}
