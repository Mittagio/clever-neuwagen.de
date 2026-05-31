import Footer from './Footer';
import CookieConsentBanner from '../legal/CookieConsentBanner.jsx';
import './AppLayout.css';

export default function AppLayout({ children }) {
  return (
    <div className="app-layout">
      <div className="app-layout__main">
        {children}
      </div>
      <Footer />
      <CookieConsentBanner />
    </div>
  );
}
