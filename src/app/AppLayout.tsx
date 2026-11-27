import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router';
import { ApartmentSheet } from '@/features/apartment-detail';
import styles from './AppLayout.module.css';
import { Footer, Notice, Toaster } from './Chrome';
import { Header } from './Header';

/** Scroll to the top when switching views (not when only the sheet params change). */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export function AppLayout() {
  return (
    <>
      <ScrollToTop />
      <div className={styles.wrap}>
        <Header />
        <Notice />
        <Outlet />
        <Footer />
      </div>
      <ApartmentSheet />
      <Toaster />
    </>
  );
}
