import { Route, Routes } from 'react-router';
import { MyListPage } from '@/features/my-list';
import { ProjectDataPage } from '@/features/project-data';
import { AppLayout } from './AppLayout';
import { ApartmentsPage } from './pages/ApartmentsPage';
import { BuildingPlansPage } from './pages/BuildingPlansPage';
import { NotFoundPage } from './pages/NotFoundPage';

/** `/` apartments, `/my-list`, `/data`, `/buildings/:id/plans`; any of them + `?apt=<id>&tab=<tab>` opens the sheet. */
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<ApartmentsPage />} />
        <Route path="my-list" element={<MyListPage />} />
        <Route path="data" element={<ProjectDataPage />} />
        <Route path="buildings/:id/plans" element={<BuildingPlansPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
