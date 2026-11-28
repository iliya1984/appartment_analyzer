/**
 * Floor-plan manifest: the hand-maintained page → floors map (sheet-map.json) merged with what
 * `npm run plans:build` extracted from the PDFs (sheets.generated.json: image sizes, anchors).
 * Both are validated with Zod so a bad edit fails loudly in tests instead of in the UI.
 */
import { z } from 'zod';
import type { FloorPlanManifest, PlanSheet } from '@/domain/floorPlans';
import generatedJson from './sheets.generated.json';
import sheetMapJson from './sheet-map.json';

const point = z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]);

const pageSchema = z.object({
  page: z.number().int().positive(),
  kind: z.enum(['floor', 'penthouse', 'garden', 'ground', 'roof', 'unit']),
  floors: z.array(z.number().int()),
  label: z.string().min(1),
  level: z.number().optional(),
  planType: z.string().optional(),
  scale: z.union([z.literal(50), z.literal(100)]).optional(),
  regions: z.record(z.string(), z.array(point).min(3)).optional(),
});

export const sheetMapSchema = z.object({
  buildings: z.record(
    z.string(),
    z.object({ plot: z.number().int(), pages: z.array(pageSchema).min(1) }),
  ),
  planTypeAliases: z.record(z.string(), z.string()),
});

export const generatedSchema = z.record(
  z.string(),
  z.object({
    building: z.string(),
    page: z.number().int().positive(),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    anchors: z.record(z.string(), point),
  }),
);

export type SheetMap = z.infer<typeof sheetMapSchema>;
export type GeneratedSheets = z.infer<typeof generatedSchema>;

/** Merges the two sources. Sheets that were not rendered yet are left out (and reported). */
export function buildManifest(
  map: SheetMap,
  generated: GeneratedSheets,
): FloorPlanManifest & { notRendered: string[] } {
  const sheets: PlanSheet[] = [];
  const notRendered: string[] = [];
  for (const [building, b] of Object.entries(map.buildings)) {
    for (const p of b.pages) {
      const id = `${building}-p${p.page}`;
      const g = generated[id];
      if (!g) {
        notRendered.push(id);
        continue;
      }
      const sheet: PlanSheet = {
        id,
        building,
        page: p.page,
        kind: p.kind,
        floors: p.floors,
        label: p.label,
        level: p.level ?? (p.floors.length ? Math.max(...p.floors) : 0),
        scale: p.scale ?? 100,
        width: g.width,
        height: g.height,
        anchors: g.anchors,
        regions: p.regions ?? {},
      };
      if (p.planType) sheet.planType = p.planType;
      sheets.push(sheet);
    }
  }
  return { sheets, aliases: map.planTypeAliases, notRendered };
}

export const floorPlanManifest: FloorPlanManifest = buildManifest(
  sheetMapSchema.parse(sheetMapJson),
  generatedSchema.parse(generatedJson),
);
