import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { usePublishedDealerConditions } from '../context/DealerConditionsContext.jsx';
import { useLeads } from '../context/LeadsContext.jsx';
import { useOffers } from '../context/OffersContext.jsx';
import { SALES_DEFAULTS, VEHICLE_TYPE_OPTIONS } from '../data/salesCatalog.js';
import { createOfferFromSales, buildOfferUrl, buildOfferPath } from '../logic/offerService.js';
import { createOrLinkLeadForOffer } from '../logic/offerLeadService.js';
import { matchSalesOffers } from '../logic/salesMatcher.js';
import SalesSuggestionCard from '../components/sales/SalesSuggestionCard.jsx';
import LegalDisclaimer from '../components/legal/LegalDisclaimer.jsx';
import './SalesPage.css';

function formatRate(value) {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value);
}

export default function SalesPage() {
  const navigate = useNavigate();
  const { publishedConditions: conditions } = usePublishedDealerConditions();
  const { addLead, leads, updateLead } = useLeads();
  const { addOffer, getExistingCodes, linkLead } = useOffers();

  const [customer, setCustomer] = useState({
    name: '',
    phone: '',
    email: '',
    desiredRate: SALES_DEFAULTS.desiredRate,
    mileagePerYear: SALES_DEFAULTS.mileagePerYear,
    termMonths: SALES_DEFAULTS.termMonths,
    downPayment: SALES_DEFAULTS.downPayment,
    vehicleType: SALES_DEFAULTS.vehicleType,
    brandModel: SALES_DEFAULTS.brandModel,
  });
  const [suggestions, setSuggestions] = useState(null);
  const [compareIds, setCompareIds] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [toast, setToast] = useState('');

  const compareSuggestions = useMemo(
    () => suggestions?.filter((s) => compareIds.includes(s.id)) ?? [],
    [suggestions, compareIds],
  );

  function update(field, value) {
    setCustomer((prev) => ({ ...prev, [field]: value }));
  }

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 2800);
  }

  function handleCalculate(e) {
    e.preventDefault();
    const results = matchSalesOffers(customer, conditions);
    setSuggestions(results);
    setCompareIds([]);
    setExpandedId(null);
    showToast(`${results.length} Vorschläge berechnet`);
  }

  function persistOffer(salesSuggestion) {
    const offer = createOfferFromSales(customer, salesSuggestion, conditions, getExistingCodes());
    addOffer(offer);
    const { lead, leadId, isNew } = createOrLinkLeadForOffer(offer, leads);
    if (isNew) {
      addLead(lead);
    } else {
      updateLead(leadId, lead);
    }
    linkLead(offer.code, leadId);
    return { offer, url: buildOfferUrl(offer.code), leadId };
  }

  function handleCreateOffer(suggestion) {
    const { offer } = persistOffer(suggestion);
    showToast(`Angebot ${offer.code} erstellt`);
    navigate('/offers', { state: { selectedCode: offer.code } });
  }

  function handleCreateComparison() {
    if (compareSuggestions.length < 2) {
      showToast('Mindestens 2 Fahrzeuge zum Vergleich wählen');
      return;
    }

    let firstCode = null;
    for (const suggestion of compareSuggestions) {
      const { offer } = persistOffer(suggestion);
      if (!firstCode) firstCode = offer.code;
    }

    showToast(`${compareSuggestions.length} Vergleichsangebote erstellt`);
    navigate(buildOfferPath(firstCode));
  }

  function toggleCompare(id) {
    setCompareIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function toggleDetails(id) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  return (
    <div className="sales-page">
      <header className="sales-header">
        <Link to="/backend" className="sales-header-back">←</Link>
        <div className="sales-header-center">
          <p className="sales-header-kicker">Verkäufermodus</p>
          <h1 className="sales-header-title">{conditions.dealerName}</h1>
        </div>
        <Link to="/assistant" className="sales-header-timer sales-header-link">
          Assistent
        </Link>
        <Link to="/offers" className="sales-header-link sales-header-link--secondary">
          Angebote
        </Link>
      </header>

      <main className="sales-main">
        <form className="sales-form" onSubmit={handleCalculate}>
          <section className="sales-section">
            <h2 className="sales-section-title">Kunde</h2>
            <div className="sales-fields">
              <input
                type="text"
                className="sales-input"
                placeholder="Name"
                value={customer.name}
                onChange={(e) => update('name', e.target.value)}
                autoComplete="name"
              />
              <input
                type="tel"
                className="sales-input"
                placeholder="Telefon"
                value={customer.phone}
                onChange={(e) => update('phone', e.target.value)}
                autoComplete="tel"
                inputMode="tel"
              />
              <input
                type="email"
                className="sales-input"
                placeholder="E-Mail"
                value={customer.email}
                onChange={(e) => update('email', e.target.value)}
                autoComplete="email"
                inputMode="email"
              />
            </div>
          </section>

          <section className="sales-section">
            <h2 className="sales-section-title">Wunsch</h2>
            <div className="sales-wish-hero">
              <label className="sales-wish-label" htmlFor="desiredRate">Wunschrate</label>
              <div className="sales-wish-rate">
                <input
                  id="desiredRate"
                  type="number"
                  className="sales-wish-input"
                  min={100}
                  max={2000}
                  step={10}
                  value={customer.desiredRate}
                  onChange={(e) => update('desiredRate', Number(e.target.value) || 0)}
                />
                <span className="sales-wish-unit">€/Monat</span>
              </div>
            </div>

            <div className="sales-grid-3">
              <div className="sales-mini-field">
                <label htmlFor="term">Laufzeit</label>
                <select
                  id="term"
                  className="sales-select"
                  value={customer.termMonths}
                  onChange={(e) => update('termMonths', Number(e.target.value))}
                >
                  <option value={36}>36 Mt.</option>
                  <option value={48}>48 Mt.</option>
                  <option value={60}>60 Mt.</option>
                </select>
              </div>
              <div className="sales-mini-field">
                <label htmlFor="mileage">Kilometer</label>
                <select
                  id="mileage"
                  className="sales-select"
                  value={customer.mileagePerYear}
                  onChange={(e) => update('mileagePerYear', Number(e.target.value))}
                >
                  <option value={10000}>10.000 km</option>
                  <option value={15000}>15.000 km</option>
                  <option value={20000}>20.000 km</option>
                </select>
              </div>
              <div className="sales-mini-field">
                <label htmlFor="down">Anzahlung</label>
                <input
                  id="down"
                  type="number"
                  className="sales-select"
                  min={0}
                  step={500}
                  value={customer.downPayment}
                  onChange={(e) => update('downPayment', Number(e.target.value) || 0)}
                />
              </div>
            </div>
          </section>

          <section className="sales-section">
            <h2 className="sales-section-title">Fahrzeugwunsch</h2>
            <div className="sales-type-tabs">
              {VEHICLE_TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={`sales-type-tab${customer.vehicleType === opt.id ? ' is-active' : ''}`}
                  onClick={() => update('vehicleType', opt.id)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <input
              type="text"
              className="sales-input sales-input--optional"
              placeholder="Marke / Modell optional (z. B. Sportage, EV4)"
              value={customer.brandModel}
              onChange={(e) => update('brandModel', e.target.value)}
            />
          </section>

          <button type="submit" className="sales-calc-btn">
            Vorschläge berechnen
          </button>
        </form>

        {suggestions && (
          <section className="sales-results" aria-live="polite">
            <h2 className="sales-results-title">
              {suggestions.length} Vorschläge · Wunsch {formatRate(customer.desiredRate)}/Monat
            </h2>

            <div className="sales-suggestion-list">
              {suggestions.map((suggestion) => (
                <SalesSuggestionCard
                  key={suggestion.id}
                  suggestion={suggestion}
                  inCompare={compareIds.includes(suggestion.id)}
                  expanded={expandedId === suggestion.id}
                  onCreateOffer={handleCreateOffer}
                  onToggleCompare={toggleCompare}
                  onToggleDetails={toggleDetails}
                />
              ))}
            </div>

            <LegalDisclaimer className="sales-disclaimer" />
          </section>
        )}
      </main>

      {compareIds.length > 0 && (
        <footer className="sales-compare-bar">
          <p className="sales-compare-bar__text">
            {compareIds.length} Fahrzeug{compareIds.length !== 1 ? 'e' : ''} im Vergleich
          </p>
          <button
            type="button"
            className="sales-compare-bar__btn"
            onClick={handleCreateComparison}
            disabled={compareIds.length < 2}
          >
            Vergleichsangebote erstellen
          </button>
        </footer>
      )}

      {toast && (
        <div className="sales-toast" role="status">{toast}</div>
      )}
    </div>
  );
}
