import { create } from 'zustand';

export const SHEET_TABS = ['insights', 'building', 'schematic'] as const;
export type SheetTab = (typeof SHEET_TABS)[number];
export const isSheetTab = (v: unknown): v is SheetTab =>
  typeof v === 'string' && (SHEET_TABS as readonly string[]).includes(v);

export const TOAST_MS = 3200;

interface Toast {
  id: number;
  message: string;
}

interface UiState {
  /** The apartment sheet reopens on the last tab used, as in the legacy site. */
  lastSheetTab: SheetTab;
  noticeDismissed: boolean;
  toast: Toast | null;
  setLastSheetTab: (tab: SheetTab) => void;
  dismissNotice: () => void;
  showToast: (message: string) => void;
  clearToast: (id: number) => void;
}

let toastSeq = 0;

export const useUiStore = create<UiState>()((set) => ({
  lastSheetTab: 'insights',
  noticeDismissed: false,
  toast: null,
  setLastSheetTab: (lastSheetTab) => set({ lastSheetTab }),
  dismissNotice: () => set({ noticeDismissed: true }),
  showToast: (message) => set({ toast: { id: ++toastSeq, message } }),
  clearToast: (id) => set((s) => (s.toast?.id === id ? { toast: null } : s)),
}));
