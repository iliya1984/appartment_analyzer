import { create } from 'zustand';
import { builtInDataset } from '@/data/builtIn';
import type { Dataset } from '@/domain/types';

export type DataSource = { kind: 'built-in' } | { kind: 'file'; fileName: string };

interface DatasetState {
  dataset: Dataset;
  source: DataSource;
  setDataset: (dataset: Dataset, source: DataSource) => void;
}

/** The apartments currently shown. Use the actions in `store/actions.ts` to switch datasets. */
export const useDatasetStore = create<DatasetState>()((set) => ({
  dataset: builtInDataset,
  source: { kind: 'built-in' },
  setDataset: (dataset, source) => set({ dataset, source }),
}));
