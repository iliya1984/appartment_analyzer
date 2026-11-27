import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { MemoryRouter, useLocation } from 'react-router';
import { Providers } from '@/app/providers';
import { AppRoutes } from '@/app/routes';
import { resetToBuiltIn } from '@/store/actions';
import { useMyListStore } from '@/store/myListStore';
import { useUiStore } from '@/store/uiStore';

/** Exposes the current URL to tests. */
export const currentLocation = { pathname: '', search: '' };
function LocationProbe() {
  const l = useLocation();
  currentLocation.pathname = l.pathname;
  currentLocation.search = l.search;
  return null;
}

/** Resets every store to a clean state. */
export function resetStores() {
  resetToBuiltIn();
  useMyListStore.setState({ entries: [], orientation: {} });
  useUiStore.setState({ lastSheetTab: 'insights', noticeDismissed: false, toast: null });
}

/** Renders the full app at `url` (routes, layout, sheet). */
export function renderApp(url = '/') {
  resetStores();
  const user = userEvent.setup();
  const utils = render(
    <Providers>
      <MemoryRouter initialEntries={[url]}>
        <AppRoutes />
        <LocationProbe />
      </MemoryRouter>
    </Providers>,
  );
  return { user, ...utils };
}

/** Renders a single component inside router + providers. */
export function renderWithRouter(ui: ReactElement, url = '/') {
  const user = userEvent.setup();
  const utils = render(
    <Providers>
      <MemoryRouter initialEntries={[url]}>
        {ui}
        <LocationProbe />
      </MemoryRouter>
    </Providers>,
  );
  return { user, ...utils };
}
