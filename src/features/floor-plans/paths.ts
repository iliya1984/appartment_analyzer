/** Route of the standalone building plans page. */
export const buildingPlansPath = (building: string, floor?: number | null): string =>
  `/buildings/${encodeURIComponent(building)}/plans${floor != null ? `?floor=${floor}` : ''}`;
