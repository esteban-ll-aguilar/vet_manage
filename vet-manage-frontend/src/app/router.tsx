import { createBrowserRouter, createRoutesFromElements, Navigate, Route, RouterProvider } from 'react-router-dom';
import { AppShell } from '../common/layouts/app-shell';
import { RequireAuth } from '../modules/auth/components/require-auth';
import { RequirePermission } from '../modules/auth/components/require-permission';
import { ChangePasswordPage } from '../modules/auth/pages/change-password-page';
import { ForgotPasswordPage } from '../modules/auth/pages/forgot-password-page';
import { LoginPage } from '../modules/auth/pages/login-page';
import { ResetPasswordPage } from '../modules/auth/pages/reset-password-page';
import { CATALOG_PERMISSIONS } from '../modules/catalogs/catalog-tabs';
import { CatalogsPage } from '../modules/catalogs/pages/catalogs-page';
import { ClientRegisterPage } from '../modules/clients/pages/client-register-page';
import { ClientsPage } from '../modules/clients/pages/clients-page';
import { DashboardPage } from '../modules/dashboard/pages/dashboard-page';
import { BatchDetailPage } from '../modules/inventory/pages/batch-detail-page';
import { BatchEntryPage } from '../modules/inventory/pages/batch-entry-page';
import { PatientsPage } from '../modules/pets/pages/patients-page';
import { CatalogPage } from '../modules/inventory/pages/catalog-page';
import { ProductDetailPage } from '../modules/inventory/pages/product-detail-page';
import { ProductFormPage } from '../modules/inventory/pages/product-form-page';
import { ProductsPage } from '../modules/inventory/pages/products-page';
import { RolePermissionsPage } from '../modules/roles/pages/role-permissions-page';
import { schedulingRoutes } from '../modules/scheduling/routes';
import { SupplierFormPage } from '../modules/suppliers/pages/supplier-form-page';
import { SuppliersPage } from '../modules/suppliers/pages/suppliers-page';
import { UsersPage } from '../modules/users/pages/users-page';
import { UserRegisterPage } from '../modules/users/pages/user-register-page';
import { UserRoleAssignmentPage } from '../modules/users/pages/user-role-assignment-page';

function ComingSoonPage() {
  return <section className="empty-page"><span className="eyebrow">Módulo en preparación</span><h2>Esta sección será implementada por el equipo</h2><p>La arquitectura y el hot reload ya están listos para comenzar.</p></section>;
}

const router = createBrowserRouter(
  createRoutesFromElements(
    <>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/" element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="change-password" element={<ChangePasswordPage />} />
          <Route path="pets" element={<RequirePermission permission="pets:read"><PatientsPage /></RequirePermission>} />
          <Route path="catalogs" element={<RequirePermission permission={CATALOG_PERMISSIONS}><CatalogsPage /></RequirePermission>} />
          <Route path="clients" element={<RequirePermission permission="clients:read"><ClientsPage /></RequirePermission>} />
          <Route path="clients/new" element={<RequirePermission permission="clients:create"><ClientRegisterPage /></RequirePermission>} />
          <Route path="appointments" element={<ComingSoonPage />} />
          {schedulingRoutes}
          <Route path="inventory/products" element={<RequirePermission permission="inventory:read"><ProductsPage /></RequirePermission>} />
          <Route path="inventory/products/new" element={<RequirePermission permission="inventory:manage-products"><ProductFormPage /></RequirePermission>} />
          <Route path="inventory/products/:id/edit" element={<RequirePermission permission="inventory:manage-products"><ProductFormPage /></RequirePermission>} />
          <Route path="inventory/categories" element={<RequirePermission permission="inventory:read"><CatalogPage type="category" /></RequirePermission>} />
          <Route path="inventory/brands" element={<RequirePermission permission="inventory:read"><CatalogPage type="brand" /></RequirePermission>} />
          <Route path="inventory/products/:id" element={<RequirePermission permission="inventory:read"><ProductDetailPage /></RequirePermission>} />
          <Route path="inventory/batches/new" element={<RequirePermission permission="inventory:register-entry"><BatchEntryPage /></RequirePermission>} />
          <Route path="inventory/batches/:id" element={<RequirePermission permission="inventory:read"><BatchDetailPage /></RequirePermission>} />
          <Route path="inventory/suppliers" element={<RequirePermission permission="suppliers:read"><SuppliersPage /></RequirePermission>} />
          <Route path="inventory/suppliers/new" element={<RequirePermission permission="suppliers:create"><SupplierFormPage /></RequirePermission>} />
          <Route path="inventory/suppliers/:id/edit" element={<RequirePermission permission="suppliers:read"><RequirePermission permission="suppliers:update"><SupplierFormPage /></RequirePermission></RequirePermission>} />
          <Route path="users" element={<RequirePermission permission="users:read"><UsersPage /></RequirePermission>} />
          <Route path="users/new" element={<RequirePermission permission="users:create"><UserRegisterPage /></RequirePermission>} />
          <Route path="users/:id/roles" element={<RequirePermission permission="users:assign-roles"><UserRoleAssignmentPage /></RequirePermission>} />
          <Route path="roles/permissions" element={<RequirePermission permission="roles:manage-permissions"><RolePermissionsPage /></RequirePermission>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Route>
    </>,
  ),
);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
