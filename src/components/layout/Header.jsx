import { Link, useLocation } from 'react-router-dom';
import BrandLogo from './BrandLogo.jsx';
import { useDealerSubdomain } from '../../context/DealerSubdomainContext.jsx';
import './BrandLogo.css';
import './Header.css';

export default function Header() {
  const { isSubdomain } = useDealerSubdomain();
  const location = useLocation();
  const path = location.pathname;
  const isAdmin = path.startsWith('/admin');
  const isBackend = path.startsWith('/backend');
  const isSales = path.startsWith('/sales');
  const isCustomer = path.startsWith('/kunde') || path.startsWith('/account') || path.startsWith('/mein-bereich') || path.startsWith('/login');
  const isOfferPage = path.startsWith('/angebot') || path.startsWith('/offer') || path.startsWith('/fahrzeug');
  const isLanding = path === '/';
  const isPublicMarketing = !isAdmin && !isBackend && !isSales && !isCustomer && !isOfferPage;

  if (isSales || isCustomer || isOfferPage || isSubdomain) return null;

  return (
    <header className={`header${isPublicMarketing ? ' header--marketing' : ''}${isLanding ? ' header--landing' : ''}`}>
      <div className="header-inner container">
        <Link to="/" className="header-logo" aria-label="Clever-Neuwagen Startseite">
          <BrandLogo />
        </Link>

        {isPublicMarketing && (
          <nav className="header-nav header-nav--marketing" aria-label="Hauptnavigation">
            <Link to="/fahrzeuge" className="header-link header-link--primary">Fahrzeuge finden</Link>
            <Link to="/partner/register" className="header-link">Für Händler</Link>
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
              <Link to="/login" className="header-btn header-btn--login">Login</Link>
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
