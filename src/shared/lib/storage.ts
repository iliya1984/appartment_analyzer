/**
 * localStorage access that never throws (private mode, quota exceeded, disabled storage).
 */
export const safeStorage = {
  get(key: string): string | null {
    try {
      return globalThis.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string): boolean {
    try {
      globalThis.localStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  },
};
