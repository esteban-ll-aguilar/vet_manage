import type { ComponentType } from 'react';
import { Route } from 'react-router-dom';
import { RequirePermission } from '../auth/components/require-permission';
import { BlockRegisterPage } from './blocks/block-register-page';
import { BlocksPage } from './blocks/blocks-page';
import { MyAvailabilityPage } from './my-availability/my-availability-page';
import { SCHEDULING_SECTIONS, type SchedulingPath } from './navigation';
import { RatesPage } from './rates/rates-page';
import { ResourcesPage } from './resources/resources-page';
import { SaturdayShiftsPage } from './saturday-shifts/saturday-shifts-page';
import { WorkSchedulesPage } from './work-schedules/work-schedules-page';

const PAGES: Record<SchedulingPath, ComponentType> = {
  resources: ResourcesPage,
  'work-schedules': WorkSchedulesPage,
  'saturday-shifts': SaturdayShiftsPage,
  'my-availability': MyAvailabilityPage,
  blocks: BlocksPage,
  rates: RatesPage,
};

// Páginas de una sección que no aparecen en el menú, como los formularios de registro.
const SUBPAGES: { path: string; permission: string; Page: ComponentType }[] = [
  { path: 'blocks/new', permission: 'schedule-blocks:create', Page: BlockRegisterPage },
];

const routes = [
  ...SCHEDULING_SECTIONS.map(({ path, permission }) => ({ path, permission, Page: PAGES[path] })),
  ...SUBPAGES,
];

// Rutas de la agenda, cada una protegida con su permiso.
export const schedulingRoutes = routes.map(({ path, permission, Page }) => (
  <Route
    key={path}
    path={`appointments/${path}`}
    element={<RequirePermission permission={permission}><Page /></RequirePermission>}
  />
));
