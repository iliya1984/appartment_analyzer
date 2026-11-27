import { type ChangeEvent, useRef, useState } from 'react';
import { parseWorkbook, WorkbookError } from '@/data/workbook/parseWorkbook';
import { loadXlsx, type XlsxModule } from '@/data/workbook/xlsx';
import { he } from '@/i18n/he';
import { Button } from '@/shared/ui/Button';
import { loadWorkbookRows, resetToBuiltIn } from '@/store/actions';
import { useUiStore } from '@/store/uiStore';

const T = he.data;

/** Load an updated contractor workbook (in memory only), or go back to the built-in data. */
export function WorkbookUpload({ load = loadXlsx }: { load?: () => Promise<XlsxModule> }) {
  const input = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState('');
  const showToast = useUiStore((s) => s.showToast);

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const el = e.currentTarget;
    const file = el.files?.[0];
    if (!file) return;
    try {
      const XLSX = await load();
      const { rows, badRows } = parseWorkbook(XLSX, await file.arrayBuffer());
      loadWorkbookRows(rows, file.name);
      setMessage(
        T.loadedMsg(rows.length) +
          (badRows.length ? T.skippedMsg(badRows.length, badRows[0] ?? 0) : ''),
      );
      showToast(T.loadedToast);
    } catch (err) {
      setMessage(T.error(err instanceof WorkbookError ? err.message : he.workbook.unreadable));
    } finally {
      el.value = '';
    }
  };

  return (
    <>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
        <Button variant="primary" onClick={() => input.current?.click()}>
          {T.upload}
        </Button>
        <input
          ref={input}
          type="file"
          accept=".xlsx,.xls"
          hidden
          aria-label={T.upload}
          data-testid="workbook-input"
          onChange={(e) => void onFile(e)}
        />
        <Button
          onClick={() => {
            resetToBuiltIn();
            setMessage('');
          }}
        >
          {T.reset}
        </Button>
      </div>
      <p className="muted" role="status" style={{ marginTop: 10 }}>
        {message}
      </p>
    </>
  );
}
