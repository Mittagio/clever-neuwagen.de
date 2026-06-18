import { useLocation } from 'react-router-dom';
import Footer from './Footer';
import CookieConsentBanner from '../legal/CookieConsentBanner.jsx';
import InternalTestEnvBadge from '../shared/InternalTestEnvBadge.jsx';
import { getSiteFooterVariant, isDealerAppRoute } from '../../logic/dealerAppRoutes.js';
import './AppLayout.css';

export default function AppLayout({ children }) {
  const { pathname } = useLocation();
  const dealerApp = isDealerAppRoute(pathname);
  const footerVariant = getSiteFooterVariant(pathname);

  return (
    <div className={`app-layout${dealerApp ? ' app-layout--dealer-app' : ''}`}>
      <InternalTestEnvBadge />
      <div className="app-layout__main">
        {children}
      </div>
      <Footer variant={footerVariant} />
      <CookieConsentBanner />
    </div>
  );
}
