import { useMemo } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useLeads } from '../../context/LeadsContext.jsx';
import {
  buildKundenaktePath,
  formatInquiryCustomerName,
  formatInquiryVehicleLine,
  getLeadReferenceCode,
  getLeadSourceLabel,
  getNewInquiryLeads,
} from '../../services/leadAkteEntry.js';
import './NewInquiriesQueue.css';

export default function NewInquiriesQueuePage() {
  const navigate = useNavigate();
  const { leads } = useLeads();

  const newInquiries = useMemo(() => getNewInquiryLeads(leads), [leads]);

  if (newInquiries.length === 1) {
    return <Navigate to={buildKundenaktePath(newInquiries[0].id)} replace />;
  }

  return (
    <div className="new-inq">
      <header className="new-inq__header">
        <Link to="/backend" className="new-inq__back" aria-label="Zurück zur Startseite">
          ←
        </Link>
        <div>
          <h1 className="new-inq__title">Neue Anfragen</h1>
          <p className="new-inq__sub">
            {newInquiries.length > 0
              ? 'Diese Kundenwünsche warten auf dich.'
              : 'Aktuell keine neuen Anfragen.'}
          </p>
        </div>
      </header>

      {newInquiries.length === 0 ? (
        <div className="new-inq__empty">
          <p>Neue Kundenwünsche erscheinen hier – von Landingpage oder Verkaufsassistent.</p>
          <Link to="/verkaufsassistent" className="new-inq__cta">
            Verkaufsassistent öffnen
          </Link>
        </div>
      ) : (
        <ul className="new-inq__list">
          {newInquiries.map((lead) => (
            <li key={lead.id}>
              <button
                type="button"
                className="new-inq__card"
                onClick={() => navigate(buildKundenaktePath(lead.id))}
                aria-label={`${formatInquiryCustomerName(lead)} öffnen`}
              >
                <div className="new-inq__card-top">
                  <span className="new-inq__status">Neu</span>
                  {getLeadReferenceCode(lead) && (
                    <span className="new-inq__ref">{getLeadReferenceCode(lead)}</span>
                  )}
                </div>
                <p className="new-inq__name">{formatInquiryCustomerName(lead)}</p>
                <p className="new-inq__vehicle">{formatInquiryVehicleLine(lead)}</p>
                <p className="new-inq__source">{getLeadSourceLabel(lead.source)}</p>
                <span className="new-inq__open">Öffnen ›</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <footer className="new-inq__footer">
        <Link to="/backend/verkaufschancen" className="new-inq__all">
          Alle anzeigen
        </Link>
      </footer>
    </div>
  );
}
