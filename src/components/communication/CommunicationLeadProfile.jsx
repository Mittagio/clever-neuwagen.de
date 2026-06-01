import { Link } from 'react-router-dom';
import { LEAD_STATUS, LEAD_STATUS_ORDER, PAYMENT_TYPES } from '../../data/leadTypes.js';
import { formatRate } from '../../logic/leadService.js';
import { buildOfferPath } from '../../logic/offerService.js';
import LeadVehicleImage from '../leads/LeadVehicleImage.jsx';
import './CommunicationComponents.css';

const DOC_LINKS = [
  { label: 'Selbstauskunft', href: '/selbstauskunft' },
  { label: 'Dokumenten-Tresor', href: '/backend/documents' },
];

export default function CommunicationLeadProfile({ lead, onStatusChange }) {
  if (!lead) {
    return (
      <div className="comm-profile comm-profile--empty">
        <p>Kundendaten erscheinen hier, sobald ein Lead ausgewählt ist.</p>
      </div>
    );
  }

  const status = LEAD_STATUS[lead.status] ?? LEAD_STATUS.neu;
  const payment = PAYMENT_TYPES[lead.paymentType];

  return (
    <div className="comm-profile">
      <header className="comm-profile__head">
        <LeadVehicleImage lead={lead} className="comm-profile__img" />
        <div>
          <h2 className="comm-profile__name">{lead.contact.name || 'Unbekannt'}</h2>
          <span
            className="comm-profile__status"
            style={{ color: status.color, background: status.bg }}
          >
            {status.label}
          </span>
        </div>
      </header>

      <dl className="comm-profile__dl">
        <div>
          <dt>Telefon</dt>
          <dd>
            {lead.contact.phone ? (
              <a href={`tel:${lead.contact.phone}`}>{lead.contact.phone}</a>
            ) : '—'}
          </dd>
        </div>
        <div>
          <dt>E-Mail</dt>
          <dd>
            {lead.contact.email ? (
              <a href={`mailto:${lead.contact.email}`}>{lead.contact.email}</a>
            ) : '—'}
          </dd>
        </div>
        <div>
          <dt>Fahrzeug</dt>
          <dd>{lead.vehicle?.label ?? '—'}</dd>
        </div>
        <div>
          <dt>Rate</dt>
          <dd>{formatRate(lead.currentRate ?? lead.desiredRate)}</dd>
        </div>
        <div>
          <dt>Zahlungsart</dt>
          <dd>{payment?.label ?? '—'}</dd>
        </div>
        {lead.offerCode && (
          <div>
            <dt>Angebot</dt>
            <dd>
              <Link to={buildOfferPath(lead.offerCode)}>{lead.offerCode}</Link>
            </dd>
          </div>
        )}
      </dl>

      <div className="comm-profile__status-row">
        <label htmlFor="comm-status">Status</label>
        <select
          id="comm-status"
          value={lead.status}
          onChange={(e) => onStatusChange?.(e.target.value)}
        >
          {LEAD_STATUS_ORDER.map((key) => (
            <option key={key} value={key}>{LEAD_STATUS[key].label}</option>
          ))}
        </select>
      </div>

      <section className="comm-profile__docs">
        <h3>Dokumente</h3>
        <ul>
          {DOC_LINKS.map((d) => (
            <li key={d.href}>
              <Link to={d.href}>{d.label}</Link>
            </li>
          ))}
          <li>
            <Link to="/offers">Angebotszentrum</Link>
          </li>
        </ul>
      </section>

      {lead.notes && (
        <section className="comm-profile__notes">
          <h3>Notizen</h3>
          <p>{lead.notes}</p>
        </section>
      )}
    </div>
  );
}
