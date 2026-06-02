import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import PageShell from '../components/layout/PageShell';
import VehicleImage from '../components/shared/VehicleImage.jsx';
import LegalDisclaimer from '../components/legal/LegalDisclaimer.jsx';
import CustomerSaveOfferModal from '../components/customer/CustomerSaveOfferModal.jsx';
import CustomerInquiryModal from '../components/customer/CustomerInquiryModal.jsx';
import { MARKETPLACE_VEHICLES } from '../data/marketplaceVehicles.js';
import { CUSTOMER_LABELS } from '../data/customerFlow.js';
import { formatCurrency, getAvailabilityMeta } from '../logic/marketplaceService.js';
import { createLeadFromMarketplaceVehicle } from '../logic/marketplaceLeadService.js';
import { toggleCompareSlug, isInCompare, loadCompareSlugs } from '../services/customerCompareService.js';
import { useLeads } from '../context/LeadsContext.jsx';
import { useCustomerAuth } from '../context/CustomerAuthContext.jsx';
import './FahrzeugDetailPage.css';

const TERM_MONTHS = 48;
const MILEAGE_YEAR = 10000;
const DOWN_PAYMENT = 0;

export default function FahrzeugDetailPage() {
  const { slug } = useParams();
  const { addLead } = useLeads();
  const { registerMarketplaceInquiry, isLoggedIn } = useCustomerAuth();
  const vehicle = MARKETPLACE_VEHICLES.find((item) => item.slug === slug);

  const [paymentView, setPaymentView] = useState('leasing');
  const [saveOpen, setSaveOpen] = useState(false);
  const [inquiryModal, setInquiryModal] = useState(null);
  const [compareSlugs, setCompareSlugs] = useState(() => loadCompareSlugs());
  const [toast, setToast] = useState('');

  if (!vehicle) {
    return (
      <PageShell>
        <div className="vehicle-detail">
          <div className="vehicle-detail__container">
            <p>Fahrzeug nicht gefunden.</p>
            <Link to="/fahrzeuge">Zur Suche</Link>
          </div>
        </div>
      </PageShell>
    );
  }

  const availability = getAvailabilityMeta(vehicle.availability);
  const mapsQuery = encodeURIComponent(`${vehicle.dealerName}, ${vehicle.plz} ${vehicle.city}`);
  const inCompare = isInCompare(vehicle.slug);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  }

  function submitInquiry(action, contact) {
    const lead = createLeadFromMarketplaceVehicle(vehicle, action, contact);
    addLead(lead);
    if (contact.email) {
      registerMarketplaceInquiry(
        vehicle,
        contact,
        action === 'testdrive' ? 'testdrive' : 'inquiry',
        contact.email,
      );
    }
    showToast('Ihre Anfrage wurde gesendet.');
  }

  function handleCompare() {
    const { added } = toggleCompareSlug(vehicle.slug);
    setCompareSlugs(loadCompareSlugs());
    showToast(added ? 'Zum Vergleich hinzugefügt.' : 'Aus Vergleich entfernt.');
  }

  const paymentOptions = [
    { id: 'leasing', label: 'Leasing', value: vehicle.monthlyRate },
    { id: 'finance', label: 'Finanzierung', value: Math.round(vehicle.monthlyRate * 1.08) },
    { id: 'cash', label: 'Kauf', value: vehicle.cashPrice },
  ];

  return (
    <PageShell>
      <div className="vehicle-detail">
        <div className="vehicle-detail__container">
          <header className="vehicle-detail__top">
            <Link to="/fahrzeuge" className="vehicle-detail__back">← Zur Fahrzeugsuche</Link>
            <Link to="/mein-bereich" className="vehicle-detail__account">{CUSTOMER_LABELS.myArea}</Link>
          </header>

          <article className="vehicle-detail__hero card">
            <VehicleImage brand={vehicle.brand} model={vehicle.imageModel} className="vehicle-detail__image" />
            <div className="vehicle-detail__facts">
              <h1>{vehicle.title}</h1>
              <p className="vehicle-detail__dealer">{vehicle.dealerName} · {vehicle.city} · {vehicle.distanceKm} km</p>

              <div className="vehicle-detail__payment-tabs">
                {paymentOptions.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    className={`vehicle-detail__tab${paymentView === opt.id ? ' is-active' : ''}`}
                    onClick={() => setPaymentView(opt.id)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <p className="vehicle-detail__rate">
                {paymentView === 'cash'
                  ? formatCurrency(paymentOptions.find((p) => p.id === 'cash').value)
                  : `${formatCurrency(paymentOptions.find((p) => p.id === paymentView).value)}/Monat`}
              </p>
              <p className="vehicle-detail__meta">
                Kaufpreis {formatCurrency(vehicle.cashPrice)} · Rabatt {vehicle.discountPercent}%
              </p>
              <p>Laufzeit {TERM_MONTHS} Monate · {MILEAGE_YEAR.toLocaleString('de-DE')} km/Jahr · Anzahlung {formatCurrency(DOWN_PAYMENT)}</p>
              <p>Lieferzeit: {vehicle.deliveryTime}</p>
              <p>{availability.label}</p>

              <h2>Ausstattung</h2>
              <ul className="vehicle-detail__equipment">
                {vehicle.equipment.map((item) => <li key={item}>{item}</li>)}
              </ul>

              <h2>Ansprechpartner</h2>
              <p>{vehicle.contactName} · <a href={`tel:${vehicle.contactPhone}`}>{vehicle.contactPhone}</a></p>

              <div className="vehicle-detail__actions">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSaveOpen(true)}>
                  {CUSTOMER_LABELS.saveOffer}
                </button>
                <button type="button" className={`btn btn-secondary btn-sm${inCompare ? ' is-active' : ''}`} onClick={handleCompare}>
                  {CUSTOMER_LABELS.compare}{compareSlugs.length > 0 ? ` (${compareSlugs.length})` : ''}
                </button>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => setInquiryModal('inquiry')}>
                  {CUSTOMER_LABELS.startInquiry}
                </button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setInquiryModal('testdrive')}>
                  {CUSTOMER_LABELS.testDrive}
                </button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setInquiryModal('contact')}>
                  {CUSTOMER_LABELS.contactDealer}
                </button>
              </div>

              <LegalDisclaimer compact className="vehicle-detail__legal" />
              <p className="vehicle-detail__hint">Unverbindliches Angebot. Alle Angaben ohne Gewähr.</p>
            </div>
          </article>

          <section className="vehicle-detail__map card">
            <h2>Standort</h2>
            <p>📍 {vehicle.dealerName}, {vehicle.plz} {vehicle.city} · {vehicle.distanceKm} km entfernt</p>
            <iframe
              title="Händlerstandort"
              src={`https://maps.google.com/maps?q=${mapsQuery}&z=11&output=embed`}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </section>
        </div>
      </div>

      {saveOpen && (
        <CustomerSaveOfferModal
          vehicle={vehicle}
          onClose={() => setSaveOpen(false)}
        />
      )}

      {inquiryModal === 'inquiry' && (
        <CustomerInquiryModal
          title={CUSTOMER_LABELS.startInquiry}
          onClose={() => setInquiryModal(null)}
          onSubmit={(contact) => submitInquiry('inquiry', contact)}
        />
      )}
      {inquiryModal === 'testdrive' && (
        <CustomerInquiryModal
          title={CUSTOMER_LABELS.testDrive}
          onClose={() => setInquiryModal(null)}
          onSubmit={(contact) => submitInquiry('testdrive', contact)}
        />
      )}
      {inquiryModal === 'contact' && (
        <CustomerInquiryModal
          title={CUSTOMER_LABELS.contactDealer}
          onClose={() => setInquiryModal(null)}
          onSubmit={(contact) => submitInquiry('contact', contact)}
        />
      )}

      {toast && <div className="vehicle-detail__toast">{toast}</div>}
    </PageShell>
  );
}
