import { useLocation } from 'react-router-dom';
import Footer from './Footer';
import CookieConsentBanner from '../legal/CookieConsentBanner.jsx';
import InternalTestEnvBadge from '../shared/InternalTestEnvBadge.jsx';
import { CleverComposerProvider } from '../../context/CleverComposerContext.jsx';
import CleverGlobalComposer from '../clever/CleverGlobalComposer.jsx';
import { getSiteFooterVariant, isDealerAppRoute } from '../../logic/dealerAppRoutes.js';
import './AppLayout.css';

export default function AppLayout({ children }) {
  const { pathname } = useLocation();
  const dealerApp = isDealerAppRoute(pathname);
  const footerVariant = getSiteFooterVariant(pathname);

  return (
    <CleverComposerProvider>
      <div className={`app-layout${dealerApp ? ' app-layout--dealer-app' : ''}`}>
        <InternalTestEnvBadge />
        <div className="app-layout__main">
          {children}
        </div>
        {/* Außerhalb von __main: feste Fußleiste, kein flex:1-Konflikt */}
        {dealerApp ? <CleverGlobalComposer /> : null}
        <Footer variant={footerVariant} />
        <CookieConsentBanner />
      </div>
    </CleverComposerProvider>
  );
}
