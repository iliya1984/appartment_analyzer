import { useState } from 'react';
import { exportMyList } from '@/data/workbook/exportMyList';
import { loadXlsx, type XlsxModule } from '@/data/workbook/xlsx';
import { he } from '@/i18n/he';
import { downloadBlob } from '@/shared/lib/download';
import { Button } from '@/shared/ui/Button';
import { useMyListStore } from '@/store/myListStore';
import { useDataset } from '@/store/selectors';
import { useUiStore } from '@/store/uiStore';

export interface ExportButtonProps {
  /** For tests. */
  load?: () => Promise<XlsxModule>;
  download?: (blob: Blob, name: string) => void;
}

/** Downloads the list as .xlsx (RTL, formatted), or .csv when SheetJS cannot load. */
export function ExportButton({ load = loadXlsx, download = downloadBlob }: ExportButtonProps) {
  const dataset = useDataset();
  const showToast = useUiStore((s) => s.showToast);
  const [busy, setBusy] = useState(false);

  const onClick = async () => {
    const entries = useMyListStore.getState().entries;
    if (!entries.length) {
      showToast(he.myList.emptyToast);
      return;
    }
    setBusy(true);
    try {
      const file = await exportMyList(entries, dataset, load);
      if (!file) {
        showToast(he.myList.emptyToast);
        return;
      }
      download(file.blob, file.name);
      showToast(he.myList.savedToast);
    } catch {
      showToast(he.myList.exportFailed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button variant="primary" onClick={() => void onClick()} disabled={busy}>
      {he.myList.export}
    </Button>
  );
}
