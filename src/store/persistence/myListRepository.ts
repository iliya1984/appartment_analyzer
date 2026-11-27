import { z } from 'zod';
import { isOrientation, type Orientation } from '@/domain/orientation';
import { safeStorage } from '@/shared/lib/storage';

/** Same key and payload shape as the legacy site, so existing lists keep working. */
export const LEGACY_STORAGE_KEY = 'almogim2181.v2';

export interface MyListEntry {
  id: string;
  note: string;
}

export interface MyListSnapshot {
  entries: MyListEntry[];
  /** Facade orientation chosen per apartment id. */
  orientation: Record<string, Orientation>;
}

type MaybePromise<T> = T | Promise<T>;

/**
 * Where the personal list is stored. Today: localStorage. A server-backed implementation can be
 * added later without touching the UI (load may then return a Promise).
 */
export interface MyListRepository {
  load(): MaybePromise<MyListSnapshot | null>;
  save(snapshot: MyListSnapshot): MaybePromise<void>;
}

/** Legacy payload: `{ prio: [{ id, note }], az: { [id]: degrees } }`. */
const legacyPayloadSchema = z.object({
  prio: z.array(z.unknown()).catch([]),
  az: z.record(z.string(), z.unknown()).catch({}),
});

const entrySchema = z.object({
  id: z.string().min(1),
  note: z.string().catch(''),
});

/**
 * Parses and sanitises a stored payload. Invalid parts are dropped, never thrown:
 * bad entries are skipped, duplicate ids keep the first, invalid orientations are ignored.
 */
export function parseSnapshot(raw: unknown): MyListSnapshot | null {
  const parsed = legacyPayloadSchema.safeParse(raw);
  if (!parsed.success) return null;
  const seen = new Set<string>();
  const entries: MyListEntry[] = [];
  for (const item of parsed.data.prio) {
    const e = entrySchema.safeParse(item);
    if (!e.success || seen.has(e.data.id)) continue;
    seen.add(e.data.id);
    entries.push({ id: e.data.id, note: e.data.note });
  }
  const orientation: Record<string, Orientation> = {};
  for (const [id, v] of Object.entries(parsed.data.az)) {
    const deg = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
    if (isOrientation(deg)) orientation[id] = deg;
  }
  return { entries, orientation };
}

export function toLegacyPayload(s: MyListSnapshot): {
  prio: MyListEntry[];
  az: Record<string, number>;
} {
  return { prio: s.entries.map(({ id, note }) => ({ id, note })), az: { ...s.orientation } };
}

export class LocalStorageMyListRepository implements MyListRepository {
  private readonly key: string;

  constructor(key: string = LEGACY_STORAGE_KEY) {
    this.key = key;
  }

  load(): MyListSnapshot | null {
    const raw = safeStorage.get(this.key);
    if (raw == null) return null;
    try {
      return parseSnapshot(JSON.parse(raw));
    } catch {
      return null;
    }
  }

  save(snapshot: MyListSnapshot): void {
    safeStorage.set(this.key, JSON.stringify(toLegacyPayload(snapshot)));
  }
}
