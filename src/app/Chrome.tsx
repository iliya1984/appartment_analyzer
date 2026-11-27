import { useEffect } from 'react';
import { he } from '@/i18n/he';
import { TOAST_MS, useUiStore } from '@/store/uiStore';
import styles from './AppLayout.module.css';

export function Notice() {
  const dismissed = useUiStore((s) => s.noticeDismissed);
  const dismiss = useUiStore((s) => s.dismissNotice);
  if (dismissed) return null;
  return (
    <div className={styles.notice} role="note">
      <span aria-hidden="true">ℹ️</span>
      <div>{he.app.notice}</div>
      <button type="button" aria-label={he.app.noticeClose} onClick={dismiss}>
        ×
      </button>
    </div>
  );
}

export function Footer() {
  return <p className={styles.foot}>{he.app.footer}</p>;
}

/** One message at a time, hidden after 3.2 s. The live region is always present. */
export function Toaster() {
  const toast = useUiStore((s) => s.toast);
  const clear = useUiStore((s) => s.clearToast);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => clear(toast.id), TOAST_MS);
    return () => clearTimeout(t);
  }, [toast, clear]);
  return (
    <div role="status" aria-live="polite">
      {toast && (
        <div className={styles.toast} key={toast.id}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
