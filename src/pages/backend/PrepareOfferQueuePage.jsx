import { useMemo } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useLeads } from '../../context/LeadsContext.jsx';
import { useOffers } from '../../context/OffersContext.jsx';
import {
  buildKundenaktePath,
  formatInquiryCustomerName,
  formatInquiryPaymentLabel,
  formatInquiryVehicleLine,
  getLeadReferenceCode,
  getNeedsOfferLeads,
} from '../../services/leadAkteEntry.js';
import './NewInquiriesQueue.css';

export default function PrepareOfferQueuePage() {
  const navigate = useNavigate();
  const { leads } = useLeads();
  const { offers } = useOffers();

  const queue = useMemo(
    () => getNeedsOfferLeads(leads, offers),
    [leads, offers],
  );

  if (queue.length === 1) {
    return <Navigate to={buildKundenaktePath(queue[0].id)} replace />;
  }

  return (
    <div className="new-inq">
      <header className="new-inq__header">
        <Link to="/backend" className="new-inq__back" aria-label="Zurück zur Startseite">
          ←
        </Link>
        <div>
          <h1 className="new-inq__title">Angebot vorbereiten</h1>
          <p className="new-inq__sub">
            {queue.length > 0
              ? 'Diese Chancen warten auf ein Angebot.'
              : 'Aktuell keine Chancen ohne Angebot.'}
          </p>
        </div>
      </header>

      {queue.length === 0 ? (
        <div className="new-inq__empty">
          <p>Sobald ein Fahrzeug auf dem Tisch liegt, kann hier das Angebot vorbereitet werden.</p>
          <Link to="/backend/neue-anfragen" className="new-inq__cta">
            Neue Anfragen prüfen
          </Link>
        </div>
      ) : (
        <ul className="new-inq__list">
          {queue.map((lead) => (
            <li key={lead.id}>
              <button
                type="button"
                className="new-inq__card new-inq__card--offer"
                onClick={() => navigate(buildKundenaktePath(lead.id))}
                aria-label={`${formatInquiryCustomerName(lead)} – Angebot vorbereiten`}
              >
                <div className="new-inq__card-top">
                  <span className="new-inq__status new-inq__status--offer">Noch kein Angebot</span>
                  {getLeadReferenceCode(lead) && (
                    <span className="new-inq__ref">{getLeadReferenceCode(lead)}</span>
                  )}
                </div>
                <p className="new-inq__name">{formatInquiryCustomerName(lead)}</p>
                <p className="new-inq__vehicle">{formatInquiryVehicleLine(lead)}</p>
                <p className="new-inq__source">{formatInquiryPaymentLabel(lead)}</p>
                <span className="new-inq__open">Angebot vorbereiten ›</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <footer className="new-inq__footer">
        <Link to="/backend/verkaufschancen?filter=needs-offer" className="new-inq__all">
          Alle anzeigen
        </Link>
      </footer>
    </div>
  );
}
