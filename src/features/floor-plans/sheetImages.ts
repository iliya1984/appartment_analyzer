/**
 * URLs of the pre-rendered plan sheets (resources/plans_rendered, made by `npm run plans:build`).
 * Vite copies each image into the build with a content hash, so browsers can cache them forever.
 * This module is only reached from the lazily loaded plan viewer.
 */
const files = import.meta.glob<string>('/resources/plans_rendered/*/*.webp', {
  query: '?url',
  import: 'default',
  eager: true,
});

export interface SheetImage {
  x1: string;
  x2: string;
}

const byId = new Map<string, Partial<SheetImage>>();
for (const [path, url] of Object.entries(files)) {
  const m = /\/([^/]+)@(1x|2x)\.webp$/.exec(path);
  if (!m?.[1]) continue;
  const entry = byId.get(m[1]) ?? {};
  entry[m[2] === '1x' ? 'x1' : 'x2'] = url;
  byId.set(m[1], entry);
}

/** Both resolutions of a sheet, or null when the sheet was not rendered. */
export function sheetImage(id: string): SheetImage | null {
  const e = byId.get(id);
  if (!e?.x1) return null;
  return { x1: e.x1, x2: e.x2 ?? e.x1 };
}

export const renderedSheetIds = (): string[] => [...byId.keys()].sort();
