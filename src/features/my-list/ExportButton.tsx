import { exportMyList } from '@/data/workbook/exportMyList';
import { loadXlsx, type XlsxModule } from '@/data/workbook/xlsx';
import { he } from '@/i18n/he';
import { downloadBlob } from '@/shared/lib/download';
import { ExportButton as GenericExportButton } from '@/shared/ui/ExportButton';
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

  return (
    <GenericExportButton
      build={() => exportMyList(useMyListStore.getState().entries, dataset, load)}
      onEmpty={() => showToast(he.myList.emptyToast)}
      onDone={() => showToast(he.myList.savedToast)}
      onError={() => showToast(he.myList.exportFailed)}
      download={download}
    >
      {he.myList.export}
    </GenericExportButton>
  );
}
