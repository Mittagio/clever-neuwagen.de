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
  const isCustomer = path.startsWith('/kunde') || path.startsWith('/account');
  const isOfferPage = path.startsWith('/angebot') || path.startsWith('/offer');
  const isPublicMarketing = !isAdmin && !isBackend && !isSales && !isCustomer && !isOfferPage;

  if (isSales || isCustomer || isOfferPage || isSubdomain) return null;

  return (
    <header className={`header${isPublicMarketing ? ' header--marketing' : ''}`}>
      <div className="header-inner container">
        <Link to="/" className="header-logo" aria-label="Clever-Neuwagen Startseite">
          <BrandLogo />
        </Link>

        {isPublicMarketing && (
          <nav className="header-nav header-nav--marketing" aria-label="Hauptnavigation">
            <Link to="/berater" className="header-link">Berater</Link>
            <Link to="/ratgeber" className="header-link">Ratgeber</Link>
            <Link to="/trends" className="header-link">Trends</Link>
            <Link to="/haendler/autohaus-trinkle" className="header-link">Händler</Link>
            <Link to="/account" className="header-link">Mein Bereich</Link>
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
              <Link to="/partner/register" className="header-link header-link--dealer">Für Händler</Link>
              <Link to="/account" className="header-link header-link--signin">Anmelden</Link>
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
