import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useOffers } from '../context/OffersContext.jsx';
import { useLeads } from '../context/LeadsContext.jsx';
import { formatPrice } from '../data/kiaSportage.js';
import { CUSTOMER_OFFER_ACTIONS } from '../data/offerTypes.js';
import { createLeadFromOffer } from '../logic/offerLeadService.js';
import {
  getPaymentLabel,
  printOfferPdf,
} from '../logic/offerService.js';
import OfferCompare from '../components/offers/OfferCompare.jsx';
import OfferVehicleImage from '../components/shared/OfferVehicleImage.jsx';
import LegalDisclaimer from '../components/legal/LegalDisclaimer.jsx';
import './OfferPage.css';

function ActionModal({ title, offer, onClose, onSubmit, requireMessage = false }) {
  const [contact, setContact] = useState({
    name: offer.customer?.name ?? '',
    email: offer.customer?.email ?? '',
    phone: offer.customer?.phone ?? '',
  });
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    onSubmit(contact, message);
    setSent(true);
    setTimeout(onClose, 1800);
  }

  return (
    <div className="offer-modal-overlay" onClick={onClose} role="presentation">
      <div className="offer-modal" onClick={(e) => e.stopPropagation()} role="dialog">
        <h2>{title}</h2>
        {sent ? (
          <p className="offer-modal__success">✓ Anfrage wurde gesendet. Wir melden uns bei Ihnen.</p>
        ) : (
          <form onSubmit={handleSubmit}>
            <label>
              Name
              <input
                type="text"
                value={contact.name}
                onChange={(e) => setContact((c) => ({ ...c, name: e.target.value }))}
                required
              />
            </label>
            <label>
              E-Mail
              <input
                type="email"
                value={contact.email}
                onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))}
                required
              />
            </label>
            <label>
              Telefon
              <input
                type="tel"
                value={contact.phone}
                onChange={(e) => setContact((c) => ({ ...c, phone: e.target.value }))}
              />
            </label>
            {requireMessage && (
              <label>
                Ihre Frage
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  required
                  placeholder="Was möchten Sie wissen?"
                />
              </label>
            )}
            <button type="submit" className="offer-btn offer-btn--primary">
              Absenden
            </button>
          </form>
        )}
        <button type="button" className="offer-modal__close" onClick={onClose}>Schließen</button>
      </div>
    </div>
  );
}

export default function OfferPage() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { getOfferByCode, recordOpen, updateOfferStatus, getOffersForCustomer } = useOffers();
  const { addLead } = useLeads();
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState('');
  const [paymentView, setPaymentView] = useState(null);

  const offer = getOfferByCode(code);
  const customerOffers = offer
    ? getOffersForCustomer(offer.customer)
    : [];

  useEffect(() => {
    if (code) recordOpen(code);
  // Einmal pro Angebots-Code tracken
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  useEffect(() => {
    if (offer && !paymentView) {
      setPaymentView(offer.pricing.paymentType ?? 'leasing');
    }
  }, [offer, paymentView]);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  }

  function handleAction(action, contact, message = '') {
    if (!offer) return;
    const lead = createLeadFromOffer(offer, action, contact);
    if (message) {
      lead.notes = `${lead.notes}\n\nNachricht: ${message}`;
      lead.history.push({
        id: `hist-${Date.now()}`,
        at: new Date().toISOString(),
        type: 'note',
        text: message,
      });
    }
    addLead(lead);

    const statusMap = {
      accept: 'interessiert',
      callback: 'interessiert',
      testdrive: 'interessiert',
      question: 'geoeffnet',
    };
    if (statusMap[action]) {
      updateOfferStatus(offer.code, statusMap[action]);
    }
    if (action === 'accept') {
      updateOfferStatus(offer.code, 'bestellung');
    }
  }

  if (!offer) {
    return (
      <div className="offer-page offer-page--empty">
        <div className="offer-page__empty-card">
          <h1>Angebot nicht gefunden</h1>
          <p>Der Link <strong>/offer/{code}</strong> ist ungültig oder abgelaufen.</p>
          <Link to="/" className="offer-btn offer-btn--primary">Zur Startseite</Link>
        </div>
      </div>
    );
  }

  const contact = offer.dealer.contact ?? {};
  const pricing = offer.pricing;

  const paymentOptions = [
    { id: 'leasing', label: 'Leasing', rate: pricing.leasingRate },
    { id: 'finance', label: 'Finanzierung', rate: pricing.financeRate },
    { id: 'cash', label: 'Kauf', rate: pricing.cashPrice },
  ].filter((p) => p.rate != null);

  const activePayment = paymentView ?? pricing.paymentType ?? 'leasing';
  const displayedRate = activePayment === 'finance'
    ? pricing.financeRate
    : activePayment === 'cash'
      ? pricing.cashPrice
      : pricing.leasingRate;

  return (
    <div className="offer-page">
      <header className="offer-page__header no-print">
        <div className="offer-page__header-inner">
          <p className="offer-page__dealer">{offer.dealer.name}</p>
          <p className="offer-page__code">Angebot {offer.code}</p>
        </div>
      </header>

      <main className="offer-page__main">
        {customerOffers.length > 1 && (
          <div className="no-print">
            <OfferCompare
              offers={customerOffers}
              activeCode={offer.code}
              onSelect={(c) => navigate(`/offer/${c}`)}
            />
          </div>
        )}

        <section className="offer-page__hero card">
          <OfferVehicleImage
            offer={offer}
            dealerId={offer.dealer?.dealerId}
            className="offer-page__visual"
            imageClassName="offer-page__visual-img"
          />
          <div className="offer-page__hero-body">
            <h1 className="offer-page__vehicle">{offer.vehicle.label}</h1>
            {offer.vehicle.engine && (
              <p className="offer-page__engine">{offer.vehicle.engine}</p>
            )}
          </div>
        </section>

        <section className="offer-page__card card">
          <h2>Konfiguration</h2>
          <ul className="offer-page__config">
            {offer.configuration.lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>

        <section className="offer-page__pricing card">
          {paymentOptions.length > 1 && (
            <div className="offer-page__payment-tabs no-print">
              {paymentOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={`offer-page__payment-tab${activePayment === opt.id ? ' is-active' : ''}`}
                  onClick={() => setPaymentView(opt.id)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
          <div className="offer-page__rate-block">
            <span className="offer-page__rate-label">
              {getPaymentLabel(activePayment)}
            </span>
            <p className="offer-page__rate">
              {activePayment === 'cash'
                ? formatPrice(displayedRate ?? 0)
                : `${formatPrice(displayedRate ?? 0)}/Monat`}
            </p>
            {activePayment === 'leasing' && (
              <p className="offer-page__rate-sub">
                {pricing.termMonths} Monate · {pricing.mileagePerYear?.toLocaleString('de-DE')} km/Jahr
              </p>
            )}
            {activePayment === 'finance' && pricing.termMonths && (
              <p className="offer-page__rate-sub">{pricing.termMonths} Monate Laufzeit</p>
            )}
          </div>
          <dl className="offer-page__details">
            <div>
              <dt>Hauspreis</dt>
              <dd>{formatPrice(pricing.hauspreis)}</dd>
            </div>
            <div>
              <dt>Lieferzeit</dt>
              <dd>{offer.deliveryTime}</dd>
            </div>
            {offer.availability?.label && (
              <div>
                <dt>Verfügbarkeit</dt>
                <dd>{offer.availability.label}</dd>
              </div>
            )}
          </dl>
          <LegalDisclaimer compact className="offer-page__rate-disclaimer" />
        </section>

        <section className="offer-page__contact card">
          <h2>Ansprechpartner</h2>
          <p className="offer-page__contact-name">
            {contact.name}
            {contact.role && <span> · {contact.role}</span>}
          </p>
          {contact.phone && (
            <a href={`tel:${contact.phone}`} className="offer-page__contact-link">{contact.phone}</a>
          )}
          {contact.email && (
            <a href={`mailto:${contact.email}`} className="offer-page__contact-link">{contact.email}</a>
          )}
          <p className="offer-page__contact-address">
            {offer.dealer.address && `${offer.dealer.address}, `}
            {offer.dealer.plz} {offer.dealer.city}
          </p>
        </section>

        <section className="offer-page__actions no-print">
          <button
            type="button"
            className="offer-btn offer-btn--primary"
            onClick={() => setModal('accept')}
          >
            {CUSTOMER_OFFER_ACTIONS.accept.label}
          </button>
          <button
            type="button"
            className="offer-btn offer-btn--secondary"
            onClick={() => setModal('callback')}
          >
            {CUSTOMER_OFFER_ACTIONS.callback.label}
          </button>
          <button
            type="button"
            className="offer-btn offer-btn--secondary"
            onClick={() => setModal('testdrive')}
          >
            {CUSTOMER_OFFER_ACTIONS.testdrive.label}
          </button>
          <button
            type="button"
            className="offer-btn offer-btn--outline"
            onClick={() => setModal('question')}
          >
            {CUSTOMER_OFFER_ACTIONS.question.label}
          </button>
          <button
            type="button"
            className="offer-btn offer-btn--outline"
            onClick={() => {
              printOfferPdf();
              showToast('Druckdialog geöffnet – als PDF speichern');
            }}
          >
            PDF herunterladen
          </button>
        </section>

        <p className="offer-page__disclaimer">
          Unverbindliches Angebot · Gültig bis{' '}
          {new Date(offer.validUntil).toLocaleDateString('de-DE')}
        </p>
      </main>

      {modal === 'accept' && (
        <ActionModal
          title={CUSTOMER_OFFER_ACTIONS.accept.label}
          offer={offer}
          onClose={() => setModal(null)}
          onSubmit={(c) => handleAction('accept', c)}
        />
      )}
      {modal === 'callback' && (
        <ActionModal
          title={CUSTOMER_OFFER_ACTIONS.callback.label}
          offer={offer}
          onClose={() => setModal(null)}
          onSubmit={(c) => handleAction('callback', c)}
        />
      )}
      {modal === 'testdrive' && (
        <ActionModal
          title={CUSTOMER_OFFER_ACTIONS.testdrive.label}
          offer={offer}
          onClose={() => setModal(null)}
          onSubmit={(c) => handleAction('testdrive', c)}
        />
      )}
      {modal === 'question' && (
        <ActionModal
          title={CUSTOMER_OFFER_ACTIONS.question.label}
          offer={offer}
          requireMessage
          onClose={() => setModal(null)}
          onSubmit={(c, msg) => handleAction('question', c, msg)}
        />
      )}

      {toast && <div className="offer-page__toast no-print">{toast}</div>}
    </div>
  );
}
