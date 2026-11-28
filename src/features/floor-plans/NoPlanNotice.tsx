import { he } from '@/i18n/he';
import { Button } from '@/shared/ui/Button';
import { EmptyState } from '@/shared/ui/Content';

const T = he.plans;

/** Shown when no plan sheet covers the apartment. Never shows a wrong sheet instead. */
export function NoPlanNotice({
  otherSheets,
  onShowBuilding,
}: {
  otherSheets: number;
  onShowBuilding?: (() => void) | undefined;
}) {
  return (
    <EmptyState>
      <p>
        <b>{T.noPlanTitle}</b>
      </p>
      <p>{otherSheets > 0 ? T.noPlanBuilding(otherSheets) : T.noPlanText}</p>
      {otherSheets > 0 && onShowBuilding && (
        <Button onClick={onShowBuilding}>{T.showBuildingSheets}</Button>
      )}
    </EmptyState>
  );
}
