import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useOffers } from '../../context/OffersContext.jsx';
import { useLeads } from '../../context/LeadsContext.jsx';
import { useCustomerAuth } from '../../context/CustomerAuthContext.jsx';
import { formatPrice } from '../../data/kiaSportage.js';
import { CUSTOMER_OFFER_ACTIONS } from '../../data/offerTypes.js';
import { createLeadFromOffer } from '../../logic/offerLeadService.js';
import {
  getPaymentLabel,
  printOfferPdf,
  buildOfferPath,
} from '../../logic/offerService.js';
import OfferCompare from '../offers/OfferCompare.jsx';
import OfferVehicleImage from '../shared/OfferVehicleImage.jsx';
import LegalDisclaimer from '../legal/LegalDisclaimer.jsx';
import ComplianceShieldBanner from '../compliance/ComplianceShieldBanner.jsx';
import { validateVehicleCompliance } from '../../logic/complianceShield.js';
import BrandLogo from '../layout/BrandLogo.jsx';
import OfferDocumentUpload from './OfferDocumentUpload.jsx';
import '../../pages/sprint7/AngebotPage.css';

function mapOfferStatusToStage(status) {
  if (status === 'bestellung') return 'bestellung';
  if (status === 'interessiert') return 'interessiert';
  return 'angebot';
}

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
    <div className="angebot-modal-overlay" onClick={onClose} role="presentation">
      <div className="angebot-modal" onClick={(e) => e.stopPropagation()} role="dialog">
        <h2>{title}</h2>
        {sent ? (
          <p className="angebot-modal__success">✓ Anfrage wurde gesendet. Wir melden uns bei Ihnen.</p>
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
            <button type="submit" className="angebot-btn angebot-btn--primary">
              Absenden
            </button>
          </form>
        )}
        <button type="button" className="angebot-modal__close" onClick={onClose}>Schließen</button>
      </div>
    </div>
  );
}

export default function OfferMiniSite() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { getOfferByCode, recordOpen, updateOfferStatus, getOffersForCustomer } = useOffers();
  const { addLead } = useLeads();
  const {
    isLoggedIn,
    email,
    registerOffer,
    syncVehicleStatusFromOffer,
    advanceVehicleStatus,
  } = useCustomerAuth();
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState('');
  const [paymentView, setPaymentView] = useState(null);
  const [activeImage, setActiveImage] = useState(0);

  const offer = getOfferByCode(code);
  const customerOffers = offer ? getOffersForCustomer(offer.customer) : [];

  useEffect(() => {
    if (code) recordOpen(code);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  useEffect(() => {
    if (!offer) return;
    const customerEmail = offer.customer?.email?.trim().toLowerCase();
    if (isLoggedIn && email && customerEmail === email.trim().toLowerCase()) {
      registerOffer(offer);
      syncVehicleStatusFromOffer(offer, mapOfferStatusToStage(offer.status));
    }
  }, [offer, isLoggedIn, email, registerOffer, syncVehicleStatusFromOffer]);

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
      advanceVehicleStatus(offer.code, 'bestellung');
    }
    if (action === 'testdrive') {
      advanceVehicleStatus(offer.code, 'interessiert');
    }

    const customerEmail = contact.email?.trim().toLowerCase();
    if (customerEmail) {
      syncVehicleStatusFromOffer(
        { ...offer, customer: { ...offer.customer, ...contact } },
        action === 'accept' ? 'bestellung' : 'interessiert',
        customerEmail,
      );
    }
  }

  if (!offer) {
    return (
      <div className="angebot-page angebot-page--empty">
        <div className="angebot-page__empty-card">
          <h1>Angebot nicht gefunden</h1>
          <p>Der Link <strong>/angebot/{code}</strong> ist ungültig oder abgelaufen.</p>
          <Link to="/" className="angebot-btn angebot-btn--primary">Zur Startseite</Link>
        </div>
      </div>
    );
  }

  const contact = offer.dealer.contact ?? {};
  const pricing = offer.pricing;
  const offerCompliance = validateVehicleCompliance({
    engineId: offer.vehicle?.engineId,
    trimId: offer.vehicle?.trimId,
    brand: offer.vehicle?.brand,
    model: offer.vehicle?.model,
    label: offer.vehicle?.label,
  });

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

  const galleryLabels = ['Frontansicht', 'Innenraum', 'Detail'];

  return (
    <div className="angebot-page">
      <header className="angebot-page__topbar no-print">
        <Link to="/" className="angebot-page__brand" aria-label="Clever-Neuwagen">
          <BrandLogo />
        </Link>
        <div className="angebot-page__topbar-actions">
          <Link to="/account" className="angebot-page__account-link">Mein Konto</Link>
        </div>
      </header>

      <div className="angebot-page__hero-band">
        <div className="angebot-page__hero-meta">
          <p className="angebot-page__dealer">{offer.dealer.name}</p>
          <p className="angebot-page__code">Persönliches Angebot · {offer.code}</p>
        </div>
        <h1 className="angebot-page__title">{offer.vehicle.label}</h1>
        {offer.vehicle.engine && (
          <p className="angebot-page__subtitle">{offer.vehicle.engine}</p>
        )}
        {offer.availability?.label && (
          <span className="angebot-page__availability">{offer.availability.label}</span>
        )}
      </div>

      <main className="angebot-page__layout">
        <div className="angebot-page__main">
          {customerOffers.length > 1 && (
            <div className="no-print angebot-page__compare">
              <OfferCompare
                offers={customerOffers}
                activeCode={offer.code}
                onSelect={(c) => navigate(buildOfferPath(c))}
              />
            </div>
          )}

          <section className="angebot-gallery card">
            <div className="angebot-gallery__main">
              <OfferVehicleImage
                offer={offer}
                dealerId={offer.dealer?.dealerId}
                className="angebot-gallery__visual"
                imageClassName="angebot-gallery__img"
              />
            </div>
            <div className="angebot-gallery__thumbs no-print">
              {galleryLabels.map((label, i) => (
                <button
                  key={label}
                  type="button"
                  className={`angebot-gallery__thumb${activeImage === i ? ' is-active' : ''}`}
                  onClick={() => setActiveImage(i)}
                  aria-label={label}
                >
                  <OfferVehicleImage
                    offer={offer}
                    dealerId={offer.dealer?.dealerId}
                    className="angebot-gallery__thumb-visual"
                    imageClassName="angebot-gallery__thumb-img"
                  />
                </button>
              ))}
            </div>
          </section>

          <section className="angebot-rate card" id="rate">
            <h2>Ihre Rate</h2>
            {paymentOptions.length > 1 && (
              <div className="angebot-rate__tabs no-print">
                {paymentOptions.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    className={`angebot-rate__tab${activePayment === opt.id ? ' is-active' : ''}`}
                    onClick={() => setPaymentView(opt.id)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
            <p className="angebot-rate__value">
              {activePayment === 'cash'
                ? formatPrice(displayedRate ?? 0)
                : `${formatPrice(displayedRate ?? 0)}`}
              {activePayment !== 'cash' && <span>/ Monat</span>}
            </p>
            <p className="angebot-rate__sub">
              {getPaymentLabel(activePayment)}
              {activePayment === 'leasing' && pricing.termMonths && (
                <> · {pricing.termMonths} Monate · {pricing.mileagePerYear?.toLocaleString('de-DE')} km/Jahr</>
              )}
            </p>
            <dl className="angebot-rate__details">
              <div>
                <dt>Hauspreis</dt>
                <dd>{formatPrice(pricing.hauspreis)}</dd>
              </div>
              <div>
                <dt>Lieferzeit</dt>
                <dd>{offer.deliveryTime}</dd>
              </div>
            </dl>
            <LegalDisclaimer compact className="angebot-rate__disclaimer" />
            <ComplianceShieldBanner validation={offerCompliance} compact />
          </section>

          <section className="angebot-config card" id="ausstattung">
            <h2>Ausstattung</h2>
            <ul className="angebot-config__list">
              {offer.configuration.lines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            {offer.vehicle.color && (
              <p className="angebot-config__color">Lackierung: {offer.vehicle.color}</p>
            )}
          </section>

          <OfferDocumentUpload offer={offer} />

          <section className="angebot-contact card" id="kontakt">
            <h2>Ansprechpartner</h2>
            <div className="angebot-contact__card">
              <p className="angebot-contact__name">
                {contact.name}
                {contact.role && <span> · {contact.role}</span>}
              </p>
              {contact.phone && (
                <a href={`tel:${contact.phone}`} className="angebot-contact__link">{contact.phone}</a>
              )}
              {contact.email && (
                <a href={`mailto:${contact.email}`} className="angebot-contact__link">{contact.email}</a>
              )}
              <p className="angebot-contact__address">
                {offer.dealer.address && `${offer.dealer.address}, `}
                {offer.dealer.plz} {offer.dealer.city}
              </p>
            </div>
          </section>

          <p className="angebot-page__valid">
            Unverbindliches Angebot · Gültig bis{' '}
            {new Date(offer.validUntil).toLocaleDateString('de-DE')}
          </p>
        </div>

        <aside className="angebot-page__sidebar no-print">
          <div className="angebot-sidebar card">
            <p className="angebot-sidebar__rate-label">{getPaymentLabel(activePayment)}</p>
            <p className="angebot-sidebar__rate">
              {activePayment === 'cash'
                ? formatPrice(displayedRate ?? 0)
                : formatPrice(displayedRate ?? 0)}
              {activePayment !== 'cash' && <span>/ Monat</span>}
            </p>
            <p className="angebot-sidebar__delivery">Lieferzeit: {offer.deliveryTime}</p>
            <div className="angebot-sidebar__actions">
              <button
                type="button"
                className="angebot-btn angebot-btn--primary"
                onClick={() => setModal('accept')}
              >
                {CUSTOMER_OFFER_ACTIONS.accept.label}
              </button>
              <button
                type="button"
                className="angebot-btn angebot-btn--secondary"
                onClick={() => setModal('testdrive')}
              >
                {CUSTOMER_OFFER_ACTIONS.testdrive.label}
              </button>
              <button
                type="button"
                className="angebot-btn angebot-btn--outline"
                onClick={() => setModal('callback')}
              >
                {CUSTOMER_OFFER_ACTIONS.callback.label}
              </button>
              <button
                type="button"
                className="angebot-btn angebot-btn--outline"
                onClick={() => setModal('question')}
              >
                {CUSTOMER_OFFER_ACTIONS.question.label}
              </button>
              <button
                type="button"
                className="angebot-btn angebot-btn--ghost"
                onClick={() => {
                  printOfferPdf();
                  showToast('Druckdialog geöffnet');
                }}
              >
                PDF speichern
              </button>
            </div>
          </div>
        </aside>
      </main>

      <div className="angebot-page__sticky no-print">
        <button
          type="button"
          className="angebot-btn angebot-btn--primary"
          onClick={() => setModal('testdrive')}
        >
          Probefahrt anfragen
        </button>
      </div>

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

      {toast && <div className="angebot-page__toast no-print">{toast}</div>}
    </div>
  );
}
