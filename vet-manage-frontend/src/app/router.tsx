import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '../common/layouts/app-shell';
import { RequireAuth } from '../modules/auth/components/require-auth';
import { RequirePermission } from '../modules/auth/components/require-permission';
import { LoginPage } from '../modules/auth/pages/login-page';
import { CatalogsPage } from '../modules/catalogs/pages/catalogs-page';
import { ClientRegisterPage } from '../modules/clients/pages/client-register-page';
import { ClientsPage } from '../modules/clients/pages/clients-page';
import { DashboardPage } from '../modules/dashboard/pages/dashboard-page';
import { BatchEntryPage } from '../modules/inventory/pages/batch-entry-page';
import { PatientsPage } from '../modules/pets/pages/patients-page';
import { CatalogPage } from '../modules/inventory/pages/catalog-page';
import { ProductFormPage } from '../modules/inventory/pages/product-form-page';
import { ProductsPage } from '../modules/inventory/pages/products-page';
import { schedulingRoutes } from '../modules/scheduling/routes';
import { UsersPage } from '../modules/users/pages/users-page';
import { UserRegisterPage } from '../modules/users/pages/user-register-page';
import { UserRoleAssignmentPage } from '../modules/users/pages/user-role-assignment-page';

function ComingSoonPage() {
  return <section className="empty-page"><span className="eyebrow">Módulo en preparación</span><h2>Esta sección será implementada por el equipo</h2><p>La arquitectura y el hot reload ya están listos para comenzar.</p></section>;
}

export function AppRouter() {
  return (
    <Routes>
      <Route path="login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="pets" element={<PatientsPage />} />
          <Route path="catalogs" element={<CatalogsPage />} />
          <Route path="clients" element={<RequirePermission permission="clients:read"><ClientsPage /></RequirePermission>} />
          <Route path="clients/new" element={<RequirePermission permission="clients:create"><ClientRegisterPage /></RequirePermission>} />
          <Route path="appointments" element={<ComingSoonPage />} />
          {schedulingRoutes}
          <Route path="inventory/products" element={<RequirePermission permission="inventory:read"><ProductsPage /></RequirePermission>} />
          <Route path="inventory/products/new" element={<RequirePermission permission="inventory:manage-products"><ProductFormPage /></RequirePermission>} />
          <Route path="inventory/products/:id/edit" element={<RequirePermission permission="inventory:manage-products"><ProductFormPage /></RequirePermission>} />
          <Route path="inventory/categories" element={<RequirePermission permission="inventory:read"><CatalogPage type="category" /></RequirePermission>} />
          <Route path="inventory/brands" element={<RequirePermission permission="inventory:read"><CatalogPage type="brand" /></RequirePermission>} />
          <Route path="inventory/batches/new" element={<RequirePermission permission="inventory:register-entry"><BatchEntryPage /></RequirePermission>} />
          <Route path="users" element={<RequirePermission permission="users:read"><UsersPage /></RequirePermission>} />
          <Route path="users/new" element={<RequirePermission permission="users:create"><UserRegisterPage /></RequirePermission>} />
          <Route path="users/:id/roles" element={<RequirePermission permission="users:assign-roles"><UserRoleAssignmentPage /></RequirePermission>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Route>
    </Routes>
  );
}
