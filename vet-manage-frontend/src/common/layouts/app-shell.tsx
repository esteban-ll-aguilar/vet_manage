import { useState } from 'react';
import type { ComponentType } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import logo from '../../assets/logo.jpeg';
import { useAuth } from '../../modules/auth/auth-context';
import { CATALOG_PERMISSIONS } from '../../modules/catalogs/catalog-tabs';
import { SCHEDULING_SECTIONS } from '../../modules/scheduling/navigation';
import { NotificationsBell } from '../../modules/notifications/components/notifications-bell';
import {
  BoxIcon,
  CalendarIcon,
  ChevronDownIcon,
  FolderIcon,
  HomeIcon,
  IdCardIcon,
  PackageIcon,
  PawIcon,
  SearchIcon,
  ShieldIcon,
  TagIcon,
  UserIcon,
  UsersIcon,
  WalletIcon,
} from '../components/icons';
import './app-shell.css';
import { UserMenu } from './user-menu';

// permission puede ser una lista: basta con tener uno de esos permisos.
type NavItem = { label: string; to: string; icon: ComponentType<{ size?: number }>; permission?: string | readonly string[] };

// Cada sección se muestra únicamente si el usuario tiene su permiso de lectura.
const mainNavigation: NavItem[] = [
  { label: 'Resumen', to: '/', icon: HomeIcon },
  { label: 'Pacientes', to: '/pets', icon: PawIcon, permission: 'pets:read' },
  { label: 'Catálogos', to: '/catalogs', icon: FolderIcon, permission: CATALOG_PERMISSIONS },
  { label: 'Clientes', to: '/clients', icon: UsersIcon, permission: 'clients:read' },
];

const schedulingIcons: Record<string, NavItem['icon']> = {
  resources: SearchIcon,
  'work-schedules': CalendarIcon,
  'saturday-shifts': UsersIcon,
  'my-availability': UserIcon,
  blocks: ShieldIcon,
  rates: WalletIcon,
};

// El grupo Agenda se oculta si el usuario no tiene permiso para ninguna sección.
const schedulingNavigation: NavItem[] = SCHEDULING_SECTIONS.map(({ label, path, permission }) => ({
  label,
  to: `/appointments/${path}`,
  icon: schedulingIcons[path] ?? CalendarIcon,
  permission,
}));

const inventoryNavigation: NavItem[] = [
  { label: 'Productos', to: '/inventory/products', icon: PackageIcon, permission: 'inventory:read' },
  { label: 'Proveedores', to: '/inventory/suppliers', icon: UsersIcon, permission: 'suppliers:read' },
  { label: 'Categorías', to: '/inventory/categories', icon: FolderIcon, permission: 'inventory:read' },
  { label: 'Marcas', to: '/inventory/brands', icon: TagIcon, permission: 'inventory:read' },
  { label: 'Entrada de lotes', to: '/inventory/batches/new', icon: BoxIcon, permission: 'inventory:register-entry' },
];

const administrationNavigation: NavItem[] = [
  { label: 'Usuarios', to: '/users', icon: IdCardIcon, permission: 'users:read' },
  { label: 'Permisos por rol', to: '/roles/permissions', icon: ShieldIcon, permission: 'roles:manage-permissions' },
];

const linkClass = (base: string) => ({ isActive }: { isActive: boolean }) =>
  isActive ? `${base} ${base}--active` : base;

export function AppShell() {
  const [inventoryOpen, setInventoryOpen] = useState(true);
  const [schedulingOpen, setSchedulingOpen] = useState(true);
  const { hasPermission } = useAuth();
  const allowed = (permission: NavItem['permission']) =>
    !permission || (typeof permission === 'string' ? hasPermission(permission) : permission.some(hasPermission));
  const visible = (items: NavItem[]) => items.filter((item) => allowed(item.permission));
  const visibleScheduling = visible(schedulingNavigation);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <img src={logo} alt="" className="sidebar-brand__logo" />
          <div>
            <strong>VetManage</strong>
            <span>Gestión veterinaria</span>
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="Navegación principal">
          <span className="sidebar-nav__label">Principal</span>
          {visible(mainNavigation).map(({ label, to, icon: ItemIcon }) => (
            <NavLink key={to} to={to} end={to === '/'} className={linkClass('sidebar-link')}>
              <ItemIcon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}

          <span className="sidebar-nav__label">Operación</span>
          {visibleScheduling.length > 0 && (
            <>
              <button
                className="sidebar-link sidebar-group__trigger"
                type="button"
                aria-expanded={schedulingOpen}
                onClick={() => setSchedulingOpen((open) => !open)}
              >
                <CalendarIcon size={18} />
                <span>Agenda</span>
                <ChevronDownIcon size={16} className={`sidebar-group__chevron${schedulingOpen ? ' sidebar-group__chevron--open' : ''}`} />
              </button>
              {schedulingOpen && (
                <div className="sidebar-group__items">
                  {visibleScheduling.map(({ label, to, icon: ItemIcon }) => (
                    <NavLink key={to} to={to} className={linkClass('sidebar-sublink')}>
                      <ItemIcon size={16} />
                      <span>{label}</span>
                    </NavLink>
                  ))}
                </div>
              )}
            </>
          )}

          <button
            className="sidebar-link sidebar-group__trigger"
            type="button"
            aria-expanded={inventoryOpen}
            onClick={() => setInventoryOpen((open) => !open)}
          >
            <BoxIcon size={18} />
            <span>Inventario</span>
            <ChevronDownIcon size={16} className={`sidebar-group__chevron${inventoryOpen ? ' sidebar-group__chevron--open' : ''}`} />
          </button>
          {inventoryOpen && (
            <div className="sidebar-group__items">
              {visible(inventoryNavigation).map(({ label, to, icon: ItemIcon }) => (
                <NavLink key={to} to={to} className={linkClass('sidebar-sublink')}>
                  <ItemIcon size={16} />
                  <span>{label}</span>
                </NavLink>
              ))}
            </div>
          )}

          {visible(administrationNavigation).length > 0 && (
            <>
              <span className="sidebar-nav__label">Administración</span>
              {visible(administrationNavigation).map(({ label, to, icon: ItemIcon }) => (
                <NavLink key={to} to={to} className={linkClass('sidebar-link')}>
                  <ItemIcon size={18} />
                  <span>{label}</span>
                </NavLink>
              ))}
            </>
          )}
        </nav>

        <NotificationsBell />
        <UserMenu />
      </aside>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
