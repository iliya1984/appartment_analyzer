import { NavLink } from 'react-router';
import { countTarget } from '@/domain/dataset';
import { he } from '@/i18n/he';
import { useDataset, useMyListCount } from '@/store/selectors';
import styles from './AppLayout.module.css';

export function Header() {
  const dataset = useDataset();
  const listCount = useMyListCount();
  const tabClass = ({ isActive }: { isActive: boolean }) =>
    isActive ? `${styles.tab} active` : styles.tab;
  return (
    <header className={styles.top}>
      <div className={styles.brand}>
        <h1>
          {he.app.brandName} <span>{he.app.brandCity}</span>
        </h1>
        <p>
          <span className="num">
            {he.app.headerStats(
              dataset.meta.lottery,
              dataset.apartments.length,
              dataset.buildings.length,
              countTarget(dataset),
            )}
          </span>
        </p>
      </div>
      <nav className={styles.tabs} aria-label={he.app.viewsLabel}>
        <NavLink to="/" end className={tabClass}>
          {he.app.tabs.apartments}
        </NavLink>
        <NavLink to="/my-list" className={tabClass}>
          {he.app.tabs.myList}{' '}
          <span className={`${styles.badge} num`} data-testid="my-list-count">
            {listCount}
          </span>
        </NavLink>
        <NavLink to="/data" className={tabClass}>
          {he.app.tabs.data}
        </NavLink>
      </nav>
    </header>
  );
}
