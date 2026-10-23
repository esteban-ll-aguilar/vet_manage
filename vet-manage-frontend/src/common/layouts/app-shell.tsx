import { NavLink, Outlet } from 'react-router-dom';

const navigation = [
  { label: 'Resumen', to: '/' },
  { label: 'Pacientes', to: '/pets' },
  { label: 'Clientes', to: '/clients' },
  { label: 'Agenda', to: '/appointments' },
];

export function AppShell() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">V</div>
          <div>
            <strong>Vet Manage</strong>
            <span>Gestión veterinaria</span>
          </div>
        </div>

        <nav className="main-nav" aria-label="Navegación principal">
          {navigation.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => (isActive ? 'nav-link nav-link--active' : 'nav-link')}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <span className="avatar">DR</span>
          <div>
            <strong>Demo user</strong>
            <span>Administrador</span>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <span className="eyebrow">Clínica principal</span>
            <h1>Panel de control</h1>
          </div>
          <button className="profile-button" type="button" aria-label="Abrir perfil">
            DR
          </button>
        </header>
        <Outlet />
      </main>
    </div>
  );
}
