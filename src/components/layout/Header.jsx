import { Link, useLocation } from 'react-router-dom';
import './Header.css';

export default function Header() {
  const location = useLocation();
  const path = location.pathname;
  const isAdmin = path.startsWith('/admin');
  const isBackend = path.startsWith('/backend');
  const isSales = path.startsWith('/sales');
  const isCustomer = path.startsWith('/kunde');
  const isPublicMarketing = !isAdmin && !isBackend && !isSales && !isCustomer;

  if (isSales || isCustomer) return null;

  return (
    <header className={`header${isPublicMarketing ? ' header--marketing' : ''}`}>
      <div className="header-inner container">
        <Link to="/" className="header-logo">
          clever-neuwagen<span className="header-logo-dot">.de</span>
        </Link>

        {isPublicMarketing && (
          <nav className="header-nav header-nav--marketing" aria-label="Hauptnavigation">
            <Link to="/berater" className="header-link">Berater</Link>
            <Link to="/ratgeber" className="header-link">Ratgeber</Link>
            <Link to="/trends" className="header-link">Trends</Link>
            <Link to="/haendler/autohaus-trinkle" className="header-link">Händler</Link>
            <Link to="/kunde" className="header-link">Mein Bereich</Link>
          </nav>
        )}

        {!isPublicMarketing && (
          <nav className="header-nav" aria-label="Navigation">
            {isBackend && <span className="header-context">Händler-Backend</span>}
            {isAdmin && <span className="header-context">Ober-Admin</span>}
          </nav>
        )}

        <div className="header-actions">
          {isPublicMarketing ? (
            <>
              <Link to="/partner" className="header-link header-link--dealer">Für Händler</Link>
              <Link to="/kunde" className="header-link header-link--signin">Anmelden</Link>
              <Link to="/backend" className="header-btn header-btn--login">Login</Link>
            </>
          ) : (
            <>
              <Link to="/backend" className="header-action">Backend</Link>
              <Link to="/admin" className="header-action header-action-muted">Admin</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
