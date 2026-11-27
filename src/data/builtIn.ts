import { buildDataset } from '@/domain/dataset';
import type { Dataset } from '@/domain/types';
import { META, RAW } from './apartments.data';

/** The dataset shipped with the app (from apartments.data.ts), built once. */
export const builtInDataset: Dataset = buildDataset(RAW, META);
