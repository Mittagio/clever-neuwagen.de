import { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useOffers } from '../../context/OffersContext.jsx';
import { useLeads } from '../../context/LeadsContext.jsx';
import { useCustomerAuth } from '../../context/CustomerAuthContext.jsx';
import { formatPrice } from '../../data/kiaSportage.js';
import { CUSTOMER_OFFER_ACTIONS } from '../../data/offerTypes.js';
import {
  getPaymentLabel,
  printOfferPdf,
  buildOfferPath,
} from '../../logic/offerService.js';
import {
  getOfferDialogHistory,
  rememberOfferLeadId,
  recallOfferLeadId,
  findLeadForOffer,
  getActiveCounterOffer,
  canCustomerRespondToCounterOffer,
} from '../../logic/offerDialogService.js';
import { COUNTER_OFFER_STATUS } from '../../data/offerDialogTypes.js';
import OfferCompare from '../offers/OfferCompare.jsx';
import CustomerSaveOfferModal from '../customer/CustomerSaveOfferModal.jsx';
import { CUSTOMER_LABELS } from '../../data/customerFlow.js';
import OfferVehicleImage from '../shared/OfferVehicleImage.jsx';
import LegalDisclaimer from '../legal/LegalDisclaimer.jsx';
import ComplianceShieldBanner from '../compliance/ComplianceShieldBanner.jsx';
import PkwEnVkvBox from '../compliance/PkwEnVkvBox.jsx';
import { ENVKV_CHANNEL } from '../../services/vehicle/requiresPkwEnVkv.js';
import { resolveVehicleEnvironmentalData } from '../../services/vehicle/vehicleEnvironmentalData.js';
import { validateVehicleCompliance } from '../../logic/complianceShield.js';
import BrandLogo from '../layout/BrandLogo.jsx';
import OfferDocumentUpload from './OfferDocumentUpload.jsx';
import OfferInquiryModal from './OfferInquiryModal.jsx';
import OfferDialogThread from './OfferDialogThread.jsx';
import CounterOfferBanner from './CounterOfferBanner.jsx';
import { getOpenRequestForOffer, buildUnterlagenPath } from '../../logic/documentRequestService.js';
import '../../pages/sprint7/AngebotPage.css';

function mapOfferStatusToStage(status) {
  if (status === 'bestellung') return 'bestellung';
  if (status === 'interessiert') return 'interessiert';
  return 'angebot';
}

export default function OfferMiniSite() {
  const { code } = useParams();
  const [searchParams] = useSearchParams();
  const accessToken = searchParams.get('token') ?? '';
  const navigate = useNavigate();
  const { getOfferByCode, recordOpen, updateOfferStatus, getOffersForCustomer, linkLead, resolveCounterOffer } = useOffers();
  const { leads, upsertLeadFromOfferAction } = useLeads();
  const {
    isLoggedIn,
    email,
    registerOffer,
    syncVehicleStatusFromOffer,
    advanceVehicleStatus,
  } = useCustomerAuth();
  const [modal, setModal] = useState(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [paymentView, setPaymentView] = useState(null);
  const [activeImage, setActiveImage] = useState(0);
  const [counterBusy, setCounterBusy] = useState(false);

  const offer = getOfferByCode(code);
  const customerOffers = offer ? getOffersForCustomer(offer.customer) : [];

  const linkedLead = useMemo(() => {
    if (!offer) return null;
    const remembered = recallOfferLeadId(offer.code);
    if (remembered) {
      const bySession = leads.find((l) => l.id === remembered);
      if (bySession) return bySession;
    }
    return findLeadForOffer(leads, offer);
  }, [offer, leads]);

  const dialogHistory = useMemo(
    () => (linkedLead ? getOfferDialogHistory(linkedLead, offer?.code) : []),
    [linkedLead, offer?.code],
  );

  const activeCounterOffer = useMemo(
    () => (offer ? getActiveCounterOffer(offer) : null),
    [offer],
  );

  const counterAccess = useMemo(() => {
    if (!offer) return { canRespond: false };
    return canCustomerRespondToCounterOffer(offer, {
      token: accessToken,
      email: isLoggedIn ? email : '',
      hasLinkedLead: !!linkedLead,
    });
  }, [offer, accessToken, isLoggedIn, email, linkedLead]);

  const openDocRequest = useMemo(
    () => (offer ? getOpenRequestForOffer(offer.code) : null),
    [offer],
  );

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

  function handleDialogAction(action, { contact, message = '', sonderwuensche = {} }) {
    if (!offer) return;

    const result = upsertLeadFromOfferAction({
      offer,
      action,
      contact,
      message,
      sonderwuensche,
    });

    if (result?.leadId) {
      linkLead(offer.code, result.leadId);
      rememberOfferLeadId(offer.code, result.leadId);
    }

    const statusMap = {
      accept: 'interessiert',
      callback: 'interessiert',
      testdrive: 'interessiert',
      question: 'geoeffnet',
      inquiry: 'geoeffnet',
      special_request: 'geoeffnet',
      decline: 'verloren',
    };
    if (statusMap[action]) {
      updateOfferStatus(offer.code, statusMap[action]);
    }
    if (action === 'accept') {
      updateOfferStatus(offer.code, 'bestellung');
      advanceVehicleStatus(offer.code, 'bestellung');
      if (activeCounterOffer) {
        resolveCounterOffer(offer.code, activeCounterOffer.id, COUNTER_OFFER_STATUS.accepted.id);
      }
    }
    if (action === 'decline' && activeCounterOffer) {
      resolveCounterOffer(offer.code, activeCounterOffer.id, COUNTER_OFFER_STATUS.declined.id);
      updateOfferStatus(offer.code, 'verloren');
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

    showToast(
      result?.isNew
        ? 'Anfrage gesendet – neue Verkaufschance angelegt'
        : 'Anfrage gesendet – Verkaufschance aktualisiert',
    );
    setModal(null);
  }

  function defaultContactFromOffer() {
    return {
      name: linkedLead?.contact?.name ?? offer?.customer?.name ?? '',
      email: linkedLead?.contact?.email ?? offer?.customer?.email ?? email ?? '',
      phone: linkedLead?.contact?.phone ?? offer?.customer?.phone ?? '',
    };
  }

  async function handleCounterAccept() {
    if (!offer || counterBusy) return;
    setCounterBusy(true);
    handleDialogAction('accept', { contact: defaultContactFromOffer() });
    showToast('Angebot angenommen – vielen Dank!');
    setCounterBusy(false);
  }

  function handleCounterDecline() {
    if (!offer || counterBusy) return;
    setCounterBusy(true);
    handleDialogAction('decline', {
      contact: defaultContactFromOffer(),
      message: 'Angebot abgelehnt',
    });
    showToast('Angebot abgelehnt');
    setCounterBusy(false);
  }

  function handleCounterQuestion() {
    setModal('question');
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
  const pricing = activeCounterOffer?.pricing ?? offer.pricing;
  const offerCompliance = validateVehicleCompliance({
    engineId: offer.vehicle?.engineId,
    trimId: offer.vehicle?.trimId,
    brand: offer.vehicle?.brand,
    model: offer.vehicle?.model,
    label: offer.vehicle?.label,
  });
  const offerEnvironmentalData = resolveVehicleEnvironmentalData({
    engineId: offer.vehicle?.engineId,
    trimId: offer.vehicle?.trimId,
    brand: offer.vehicle?.brand,
    model: offer.vehicle?.model,
    label: offer.vehicle?.label,
    isNewPassengerCar: true,
    paymentType: pricing.paymentType ?? 'leasing',
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
          <Link to="/mein-bereich" className="angebot-page__account-link">{CUSTOMER_LABELS.myArea}</Link>
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

          {activeCounterOffer && (
            <CounterOfferBanner
              counterOffer={activeCounterOffer}
              offer={offer}
              canRespond={counterAccess.canRespond}
              authHint={
                counterAccess.reason === 'EXPIRED_TOKEN'
                  ? 'Der Link ist abgelaufen. Bitte kontaktieren Sie Ihren Verkäufer.'
                  : 'Bitte öffnen Sie den Link aus Ihrer E-Mail oder melden Sie sich in Mein Bereich an.'
              }
              onAccept={handleCounterAccept}
              onDecline={handleCounterDecline}
              onQuestion={handleCounterQuestion}
              busy={counterBusy}
            />
          )}

          {openDocRequest && (
            <section className="angebot-docreq card no-print">
              <h2>Unterlagen benötigt</h2>
              <p>
                Ihr Verkäufer hat Unterlagen angefordert. Bitte reichen Sie diese innerhalb von 48 Stunden ein.
              </p>
              <Link
                to={buildUnterlagenPath(openDocRequest.id, openDocRequest.accessToken)}
                className="angebot-btn angebot-btn--primary"
              >
                Zur Upload-Checkliste
              </Link>
            </section>
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
            <PkwEnVkvBox
              variant="label"
              channel={ENVKV_CHANNEL.OFFER}
              environmentalData={offerEnvironmentalData}
              vehicleRef={{
                engineId: offer.vehicle?.engineId,
                trimId: offer.vehicle?.trimId,
                brand: offer.vehicle?.brand,
                model: offer.vehicle?.model,
                isNewPassengerCar: true,
                paymentType: pricing.paymentType ?? 'leasing',
              }}
            />
            <LegalDisclaimer compact className="angebot-rate__disclaimer" />
            <ComplianceShieldBanner validation={offerCompliance} compact />
            <PkwEnVkvBox
              variant="detail"
              channel={ENVKV_CHANNEL.OFFER}
              environmentalData={offerEnvironmentalData}
              vehicleRef={{
                engineId: offer.vehicle?.engineId,
                trimId: offer.vehicle?.trimId,
                brand: offer.vehicle?.brand,
                model: offer.vehicle?.model,
                isNewPassengerCar: true,
                paymentType: pricing.paymentType ?? 'leasing',
              }}
            />
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

          <OfferDialogThread
            history={dialogHistory}
            sonderwuensche={linkedLead?.sonderwuensche}
          />

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
                className="angebot-btn angebot-btn--outline"
                onClick={() => setSaveOpen(true)}
              >
                {CUSTOMER_LABELS.saveOffer}
              </button>
              <button
                type="button"
                className="angebot-btn angebot-btn--primary"
                onClick={() => setModal('inquiry')}
              >
                {CUSTOMER_OFFER_ACTIONS.inquiry.label}
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
                className="angebot-btn angebot-btn--outline"
                onClick={() => setModal('special_request')}
              >
                {CUSTOMER_OFFER_ACTIONS.special_request.label}
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

      {saveOpen && (
        <CustomerSaveOfferModal offer={offer} onClose={() => setSaveOpen(false)} />
      )}
      {modal && (
        <OfferInquiryModal
          offer={offer}
          mode={modal}
          title={CUSTOMER_OFFER_ACTIONS[modal]?.label ?? 'Anfrage'}
          onClose={() => setModal(null)}
          onSubmit={(payload) => handleDialogAction(modal, payload)}
        />
      )}

      {toast && <div className="angebot-page__toast no-print">{toast}</div>}
    </div>
  );
}
