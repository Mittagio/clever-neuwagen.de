import { Link } from 'react-router-dom';
import { PILOT_DEALER_ID } from '../../config/pilotLive.js';
import './PilotLiveBanner.css';

export default function PilotLiveBanner() {
  return (
    <aside className="pilot-live-banner" role="status" aria-live="polite">
      <div className="pilot-live-banner__inner">
        <span className="pilot-live-banner__badge">Pilot LIVE</span>
        <div className="pilot-live-banner__copy">
          <strong>Autohaus Trinkle · nur Kia · echte Leads</strong>
          <p>
            Demo-Leads sind aus. Kunde durchklicken → Anfrage absenden → Lead erscheint unter{' '}
            <Link to="/backend/verkaufschancen">Verkaufschancen</Link>.
          </p>
        </div>
        <Link to={`/haendler/${PILOT_DEALER_ID}`} className="pilot-live-banner__cta">
          Kunden-Landing öffnen
        </Link>
      </div>
    </aside>
  );
}
