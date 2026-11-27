import { BrowserRouter } from 'react-router';
import { Providers } from './providers';
import { AppRoutes } from './routes';

export function App() {
  return (
    <Providers>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <AppRoutes />
      </BrowserRouter>
    </Providers>
  );
}
