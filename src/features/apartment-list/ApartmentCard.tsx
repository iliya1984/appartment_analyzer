import { memo } from 'react';
import { floorLabel, fmt, m2, money } from '@/domain/format';
import type { Apartment } from '@/domain/types';
import { ApartmentLink, PlanLink } from '@/features/apartment-detail';
import { he } from '@/i18n/he';
import { cx } from '@/shared/lib/cx';
import { Tag, Tags } from '@/shared/ui/Content';
import { StarButton } from '@/shared/ui/StarButton';
import styles from './ApartmentCard.module.css';
import { cardTags } from './cardTags';

export interface ApartmentCardProps {
  apartment: Apartment;
  inMyList: boolean;
  onToggleMyList: (id: string) => void;
}

export const ApartmentCard = memo(function ApartmentCard({
  apartment: a,
  inMyList,
  onToggleMyList,
}: ApartmentCardProps) {
  const sub = [
    he.card.roomsArea(a.rooms, m2(a.area)),
    a.pricePerSqm ? he.card.perSqm(fmt(a.pricePerSqm)) : null,
    he.card.saleType(a.saleType),
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <article className={cx(styles.card, a.category === 'free' && styles.free)} data-id={a.id}>
      <div className={styles.top}>
        <ApartmentLink apartmentId={a.id} className={styles.open}>
          {he.card.heading(a.building, a.number, floorLabel(a.floor))}
        </ApartmentLink>
        <div className={styles.actions}>
          <PlanLink apartment={a} className={styles.planLink} />
          <StarButton
            className={styles.star}
            pressed={inMyList}
            label={he.common.addToMyList}
            onToggle={() => onToggleMyList(a.id)}
          />
        </div>
      </div>
      <div>
        <div className={`${styles.price} num`}>
          {a.price != null ? money(a.price) : he.common.free}
        </div>
        <div className={`${styles.sub} num`}>{sub}</div>
      </div>
      <Tags>
        {cardTags(a).map((t) => (
          <Tag key={t.key} tone={t.tone}>
            {t.text}
          </Tag>
        ))}
      </Tags>
    </article>
  );
});
