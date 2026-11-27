import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// jsdom gaps used by the app and by Radix UI.
const noop = (): void => undefined;
globalThis.ResizeObserver = class {
  observe = noop;
  unobserve = noop;
  disconnect = noop;
};
window.scrollTo = vi.fn();
Object.assign(Element.prototype, {
  scrollIntoView: noop,
  hasPointerCapture: () => false,
  releasePointerCapture: noop,
  setPointerCapture: noop,
});
Object.assign(URL, { createObjectURL: () => 'blob:mock', revokeObjectURL: noop });

afterEach(() => {
  cleanup();
  localStorage.clear();
});
