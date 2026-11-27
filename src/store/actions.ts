import { builtInDataset } from '@/data/builtIn';
import { buildDataset } from '@/domain/dataset';
import type { Dataset, RawRow } from '@/domain/types';
import { type DataSource, useDatasetStore } from './datasetStore';
import { useFiltersStore } from './filtersStore';
import { useMyListStore } from './myListStore';

function activate(dataset: Dataset, source: DataSource) {
  useDatasetStore.getState().setDataset(dataset, source);
  useFiltersStore.getState().reset();
  useMyListStore.getState().prune(dataset.byId);
}

/**
 * Replaces the apartments with rows from an uploaded workbook (in memory only, as before).
 * Keeps the project meta of the current dataset; resets filters and drops list entries whose
 * apartment no longer exists.
 */
export function loadWorkbookRows(rows: readonly RawRow[], fileName: string): Dataset {
  const dataset = buildDataset(rows, useDatasetStore.getState().dataset.meta);
  activate(dataset, { kind: 'file', fileName });
  return dataset;
}

/** Back to the workbook shipped with the app. */
export function resetToBuiltIn(): void {
  activate(builtInDataset, { kind: 'built-in' });
}
