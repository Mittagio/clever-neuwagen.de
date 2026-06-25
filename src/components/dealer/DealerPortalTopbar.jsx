import { Link } from 'react-router-dom';
import BrandLogo from '../layout/BrandLogo.jsx';
import '../layout/BrandLogo.css';
import './dealer-landing.css';

/**
 * Minimale Kopfzeile: Logo + Login (Autoportal-Stil).
 */
export default function DealerPortalTopbar() {
  return (
    <header className="dl-portal-topbar" aria-label="Seitenkopf">
      <Link to="/" className="dl-portal-topbar__logo" aria-label="Clever-Neuwagen Startseite">
        <BrandLogo />
      </Link>
      <Link to="/login" className="dl-portal-topbar__login">
        Login
      </Link>
    </header>
  );
}
