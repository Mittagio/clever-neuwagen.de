import { Link, useLocation } from 'react-router-dom';
import BrandLogo from './BrandLogo.jsx';
import { useDealerSubdomain } from '../../context/DealerSubdomainContext.jsx';
import { useCommunication } from '../../context/CommunicationContext.jsx';
import { IconChevronDown } from '../dealer-ai/AkteIcons.jsx';
import './BrandLogo.css';
import './Header.css';

function sellerInitials(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'V';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
}

export default function Header() {
  const { isSubdomain } = useDealerSubdomain();
  const { getCurrentSeller } = useCommunication();
  const location = useLocation();
  const path = location.pathname;
  const isAdmin = path.startsWith('/admin');
  const isBackend = path.startsWith('/backend');
  const isSales = path.startsWith('/sales');
  const isCustomer = path.startsWith('/kunde') || path.startsWith('/account') || path.startsWith('/mein-bereich') || path.startsWith('/login');
  const isOfferPage = path.startsWith('/angebot') || path.startsWith('/offer') || path.startsWith('/fahrzeug');
  const isLanding = path === '/';
  const isPublicMarketing = !isAdmin && !isBackend && !isSales && !isCustomer && !isOfferPage;
  const seller = isBackend ? (getCurrentSeller?.() ?? null) : null;
  const sellerName = seller?.name || 'Verkäufer';
  const sellerRole = 'Verkäufer';

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

        {(isPublicMarketing || (!isBackend && !isAdmin)) && (
          <div className="header-actions">
            {isPublicMarketing ? (
              <Link to="/login" className="header-btn header-btn--login">Login</Link>
            ) : (
              <>
                <Link to="/backend" className="header-action">Backend</Link>
                <Link to="/admin" className="header-action header-action-muted">Admin</Link>
              </>
            )}
          </div>
        )}

        {isBackend && (
          <div className="header-actions">
            <Link
              to="/backend/verwaltung"
              className="header-settings"
              aria-label="Verwaltung öffnen"
              title="Verwaltung öffnen"
            >
              <span className="header-settings__icon" aria-hidden>⚙️</span>
              <span className="header-settings__label">Verwaltung</span>
            </Link>
            <Link
              to="/backend/verwaltung"
              className="header-profile"
              aria-label={`${sellerName}, ${sellerRole}`}
              title="Profil und Verwaltung"
            >
              <span className="header-profile__avatar" aria-hidden>
                {sellerInitials(sellerName)}
              </span>
              <span className="header-profile__meta">
                <span className="header-profile__name">{sellerName}</span>
                <span className="header-profile__role">{sellerRole}</span>
              </span>
              <span className="header-profile__chevron" aria-hidden>
                <IconChevronDown />
              </span>
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
