import { Link } from 'react-router';
import { he } from '@/i18n/he';
import { EmptyState } from '@/shared/ui/Content';

export function NotFoundPage() {
  return (
    <main>
      <EmptyState>
        <p>{he.app.notFound}</p>
        <Link to="/">{he.app.backHome}</Link>
      </EmptyState>
    </main>
  );
}
