import { DELTA_THRESHOLD } from '@/domain/insights';
import { kindLabel, outdoorLabel, pct, storageLevelLabel, categoryLabel } from '@/domain/format';
import type { Apartment } from '@/domain/types';
import { he } from '@/i18n/he';
import type { TagTone } from '@/shared/ui/Content';

export interface CardTag {
  key: string;
  tone: TagTone;
  text: string;
}

/** Tags shown on an apartment card, in display order. */
export function cardTags(a: Apartment): CardTag[] {
  const tags: CardTag[] = [{ key: 'cat', tone: 'default', text: categoryLabel(a.category) }];
  if (a.kind !== 'T') tags.push({ key: 'kind', tone: 'default', text: kindLabel(a.kind) });
  tags.push({ key: 'out', tone: 'default', text: outdoorLabel(a) });
  tags.push({
    key: 'sto',
    tone: 'default',
    text:
      a.storage.floor === 'קרקע'
        ? he.card.storageGround
        : he.card.storageLevel(storageLevelLabel(a.storage.floor)),
  });
  const delta = a.comparison?.delta;
  if (delta != null) {
    tags.push({
      key: 'delta',
      tone: delta <= -DELTA_THRESHOLD ? 'good' : delta >= DELTA_THRESHOLD ? 'bad' : 'default',
      text: he.card.vsPeers(pct(delta)),
    });
  } else {
    tags.push({ key: 'delta', tone: 'warn', text: he.card.priceNotPublished });
  }
  return tags;
}
