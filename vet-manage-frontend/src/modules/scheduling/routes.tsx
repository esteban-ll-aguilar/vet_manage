import type { ComponentType } from 'react';
import { Route } from 'react-router-dom';
import { RequirePermission } from '../auth/components/require-permission';
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

// Rutas de la agenda, cada una protegida con el permiso de su sección.
export const schedulingRoutes = SCHEDULING_SECTIONS.map(({ path, permission }) => {
  const Page = PAGES[path];
  return (
    <Route
      key={path}
      path={`appointments/${path}`}
      element={<RequirePermission permission={permission}><Page /></RequirePermission>}
    />
  );
});
