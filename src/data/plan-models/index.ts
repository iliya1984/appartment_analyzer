/**
 * Plan models (src/data/plan-models/<planType>.json, from `npm run plans:model`). Each JSON is
 * its own lazy chunk: only the model of the apartment being viewed is downloaded.
 */
import { z } from 'zod';
import { FURNITURE_KINDS, mirrorModel, type PlanModel } from '@/domain/planModel';

const rect = z.tuple([z.number(), z.number(), z.number().positive(), z.number().positive()]);
const pt = z.tuple([z.number(), z.number()]);
const room = z.object({
  id: z.string(),
  type: z.enum([
    'salon',
    'kitchen',
    'dining',
    'master',
    'bed',
    'mamad',
    'bath',
    'wc',
    'service',
    'storage',
    'hall',
    'balcony',
    'garden',
    'roof-terrace',
    'other',
  ]),
  label: z.string(),
  rects: z.array(rect).min(1),
  areaM2: z.number().positive(),
  center: pt,
  dims: z.tuple([z.number().positive(), z.number().positive()]).optional(),
});

export const planModelSchema = z.object({
  planType: z.string(),
  source: z.object({
    file: z.string(),
    page: z.number().int().positive(),
    scale: z.union([z.literal(50), z.literal(100)]),
    method: z.enum(['measured', 'vector', 'layers', 'colors']),
  }),
  unitsCm: z.literal(true),
  northDeg: z.number(),
  bounds: pt,
  entrance: pt.nullable(),
  walls: z.array(rect).min(4),
  openings: z.array(
    z.object({
      kind: z.enum(['door', 'entrance', 'window', 'slider']),
      rect,
      sill: z.number(),
      head: z.number(),
    }),
  ),
  rooms: z.array(room).min(1),
  outdoor: z.array(room.extend({ covered: z.boolean() })),
  rails: z.array(rect).optional(),
  furniture: z
    .array(
      z.object({
        kind: z.enum(FURNITURE_KINDS),
        rect,
        side: z.enum(['n', 'e', 's', 'w']).optional(),
      }),
    )
    .optional(),
});

const files = import.meta.glob<unknown>('./*.json', { import: 'default' });

/** Plan types drawn as exact mirrors of a modelled type (verified pairs only). */
export const MIRRORED: Readonly<Record<string, string>> = {};

const typeOf = (path: string) => /\.\/(.+)\.json$/.exec(path)?.[1] ?? '';
const MODELLED = new Set(Object.keys(files).map(typeOf));

/** Plan types with a plan-based model (the others fall back to the schematic). */
export const modelledPlanTypes = (): string[] => [...MODELLED, ...Object.keys(MIRRORED)].sort();

export const hasPlanModel = (planType: string): boolean =>
  MODELLED.has(planType) || planType in MIRRORED;

/** Loads and validates a model; null when the type has none. */
export async function loadPlanModel(planType: string): Promise<PlanModel | null> {
  const base = MIRRORED[planType] ?? planType;
  const load = files[`./${base}.json`];
  if (!load) return null;
  const model = planModelSchema.parse(await load()) as PlanModel;
  return base === planType ? model : mirrorModel(model, planType);
}
