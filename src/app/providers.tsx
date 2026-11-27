import { DirectionProvider } from '@radix-ui/react-direction';
import type { ReactNode } from 'react';

/** App-wide providers. Radix components read the reading direction from here (Hebrew, RTL). */
export function Providers({ children }: { children: ReactNode }) {
  return <DirectionProvider dir="rtl">{children}</DirectionProvider>;
}
