import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '../common/layouts/app-shell';
import { DashboardPage } from '../modules/dashboard/pages/dashboard-page';

function ComingSoonPage() {
  return <section className="empty-page"><span className="eyebrow">Módulo en preparación</span><h2>Esta sección será implementada por el equipo</h2><p>La arquitectura y el hot reload ya están listos para comenzar.</p></section>;
}

export function AppRouter() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<DashboardPage />} />
        <Route path="pets" element={<ComingSoonPage />} />
        <Route path="clients" element={<ComingSoonPage />} />
        <Route path="appointments" element={<ComingSoonPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
