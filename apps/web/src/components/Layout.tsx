import { NavLink, Outlet } from 'react-router';
import { useAuth } from '../features/auth/auth-context';
import styles from './Layout.module.css';

const NAV_ITEMS = [
  { to: '/', label: 'Lanzamientos', end: true },
  { to: '/paises', label: 'Países', end: false },
  { to: '/mis-misiones', label: 'Mis misiones', end: false },
  { to: '/calidad-datos', label: 'Calidad de datos', end: false },
];

export function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <NavLink to="/" className={styles.brand}>
            <span className={styles.brandMark}>SLT-1</span>
            <span className={styles.brandSub}>seguimiento de lanzamientos</span>
          </NavLink>

          <nav className={styles.nav} aria-label="Principal">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  isActive ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className={styles.session}>
            {user === null ? (
              <NavLink to="/acceder" className={styles.primaryLink}>
                Acceder
              </NavLink>
            ) : (
              <>
                <span className={styles.userEmail}>{user.email}</span>
                <button type="button" className={styles.ghostButton} onClick={() => void logout()}>
                  Salir
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <Outlet />
      </main>

      <footer className={styles.footer}>
        Datos de{' '}
        <a href="https://github.com/r-spacex/SpaceX-API" target="_blank" rel="noreferrer noopener">
          SpaceX API v4
        </a>{' '}
        y{' '}
        <a href="https://restcountries.com" target="_blank" rel="noreferrer noopener">
          REST Countries v3.1
        </a>
        . El catálogo cubre únicamente lanzamientos de SpaceX.
      </footer>
    </div>
  );
}
