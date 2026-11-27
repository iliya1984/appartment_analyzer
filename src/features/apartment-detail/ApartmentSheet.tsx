import * as Dialog from '@radix-ui/react-dialog';
import * as Tabs from '@radix-ui/react-tabs';
import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router';
import { categoryLabel, floorName, m2, money } from '@/domain/format';
import type { Apartment } from '@/domain/types';
import { he } from '@/i18n/he';
import { IconButton } from '@/shared/ui/Button';
import { StarButton } from '@/shared/ui/StarButton';
import { useMyListStore } from '@/store/myListStore';
import { useApartment, useIsInMyList } from '@/store/selectors';
import { isSheetTab, SHEET_TABS, type SheetTab, useUiStore } from '@/store/uiStore';
import styles from './ApartmentSheet.module.css';
import { BuildingTab } from './BuildingTab';
import { InsightsTab } from './InsightsTab';
import { readSheetParams, useCloseSheet, useSetSheetTab } from './navigation';
import { SchematicTab } from './SchematicTab';

const TAB_LABEL: Record<SheetTab, string> = he.sheet.tabs;

function SheetHeader({
  apartment: a,
  closeRef,
}: {
  apartment: Apartment;
  closeRef: React.Ref<HTMLButtonElement>;
}) {
  const inList = useIsInMyList(a.id);
  const toggle = useMyListStore((s) => s.toggle);
  return (
    <div className={styles.head}>
      <StarButton
        framed
        pressed={inList}
        label={he.common.addToMyList}
        onToggle={() => toggle(a.id)}
      />
      <div className={styles.titles}>
        <Dialog.Title>{he.sheet.title(a.building, a.number, floorName(a.floor))}</Dialog.Title>
        <Dialog.Description className={styles.subtitle}>
          {he.sheet.subtitle(
            a.rooms,
            m2(a.area),
            a.price != null ? money(a.price) : he.card.priceNotPublished,
            categoryLabel(a.category),
          )}
        </Dialog.Description>
      </div>
      <Dialog.Close asChild>
        <IconButton ref={closeRef} aria-label={he.sheet.close}>
          ✕
        </IconButton>
      </Dialog.Close>
    </div>
  );
}

/**
 * The apartment detail sheet, mounted once in the layout and driven by the URL
 * (?apt=<id>&tab=insights|building|schematic). Esc, the close button, a click outside the
 * panel and browser Back all close it.
 */
export function ApartmentSheet() {
  const location = useLocation();
  const { id, tab } = readSheetParams(location.search);
  const apartment = useApartment(id);
  const close = useCloseSheet();
  const setTab = useSetSheetTab();
  const setLastSheetTab = useUiStore((s) => s.setLastSheetTab);
  const closeRef = useRef<HTMLButtonElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  // Remember the tab for the next apartment, and start each view at the top.
  useEffect(() => {
    if (!apartment) return;
    setLastSheetTab(tab);
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
  }, [apartment, tab, setLastSheetTab]);

  return (
    <Dialog.Root
      open={apartment != null}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay}>
          {apartment && (
            <Dialog.Content
              className={styles.panel}
              onOpenAutoFocus={(e) => {
                e.preventDefault();
                closeRef.current?.focus();
              }}
            >
              <SheetHeader apartment={apartment} closeRef={closeRef} />
              <Tabs.Root
                className={styles.tabsRoot}
                value={tab}
                onValueChange={(v) => {
                  if (isSheetTab(v)) setTab(v);
                }}
              >
                <Tabs.List className={styles.tabs} aria-label={he.sheet.tabsLabel}>
                  {SHEET_TABS.map((t) => (
                    <Tabs.Trigger key={t} value={t} className={styles.tab}>
                      {TAB_LABEL[t]}
                    </Tabs.Trigger>
                  ))}
                </Tabs.List>
                <div className={styles.body} ref={bodyRef}>
                  <Tabs.Content value="insights">
                    <InsightsTab apartment={apartment} />
                  </Tabs.Content>
                  <Tabs.Content value="building">
                    <BuildingTab apartment={apartment} />
                  </Tabs.Content>
                  <Tabs.Content value="schematic">
                    <SchematicTab apartment={apartment} />
                  </Tabs.Content>
                </div>
              </Tabs.Root>
            </Dialog.Content>
          )}
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
