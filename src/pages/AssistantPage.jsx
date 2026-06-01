import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { usePublishedDealerConditions } from '../context/DealerConditionsContext.jsx';
import { useLeads } from '../context/LeadsContext.jsx';
import { useOffers } from '../context/OffersContext.jsx';
import { SALES_DEFAULTS, VEHICLE_TYPE_OPTIONS } from '../data/salesCatalog.js';
import { createOfferFromSales, buildOfferUrl, buildOfferPath } from '../logic/offerService.js';
import { createOrLinkLeadForOffer } from '../logic/offerLeadService.js';
import { getRecommendations, formatRecommendationRate } from '../services/recommendationEngine.js';
import { recordAssistantSession } from '../services/assistantAnalytics.js';
import { recordIntelligenceAdvisorSession, recordIntelligenceComparison } from '../services/intelligenceAnalytics.js';
import AssistantRecommendationCard, { AssistantComparePanel } from '../components/assistant/AssistantRecommendationCard.jsx';
import LegalDisclaimer from '../components/legal/LegalDisclaimer.jsx';
import './AssistantPage.css';

const FUEL_OPTIONS = [
  { id: 'egal', label: 'Egal' },
  { id: 'elektro', label: 'Elektro' },
  { id: 'hybrid', label: 'Hybrid' },
  { id: 'verbrenner', label: 'Verbrenner' },
];

const DEFAULT_INPUT = {
  name: '',
  phone: '',
  email: '',
  budget: SALES_DEFAULTS.budget,
  desiredRate: SALES_DEFAULTS.desiredRate,
  mileagePerYear: 15000,
  termMonths: SALES_DEFAULTS.termMonths,
  downPayment: SALES_DEFAULTS.downPayment,
  vehicleType: 'suv',
  brandModel: '',
  fuelPreference: 'egal',
  automatic: true,
  towingImportant: false,
  family: false,
  dog: false,
  deliveryImportant: false,
};

function ToggleChip({ active, onClick, children }) {
  return (
    <button
      type="button"
      className={`asst-chip${active ? ' is-active' : ''}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export default function AssistantPage() {
  const navigate = useNavigate();
  const { publishedConditions: conditions } = usePublishedDealerConditions();
  const { addLead, leads, updateLead } = useLeads();
  const { addOffer, getExistingCodes, linkLead } = useOffers();

  const [input, setInput] = useState(DEFAULT_INPUT);
  const [recommendations, setRecommendations] = useState(null);
  const [compareIds, setCompareIds] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [createdOffers, setCreatedOffers] = useState({});
  const [toast, setToast] = useState('');

  const compareItems = useMemo(
    () => recommendations?.filter((r) => compareIds.includes(r.id)) ?? [],
    [recommendations, compareIds],
  );

  function update(field, value) {
    setInput((prev) => ({ ...prev, [field]: value }));
  }

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 2800);
  }

  function handleCalculate(e) {
    e.preventDefault();
    const results = getRecommendations(input, conditions);
    setRecommendations(results);
    setCompareIds([]);
    setExpandedId(null);
    setCreatedOffers({});
    recordAssistantSession(input, results);
    recordIntelligenceAdvisorSession(
      {
        household: input.family ? (input.dog ? 'family-dog' : 'family') : 'single',
        bodyType: input.vehicleType,
        fuelPreference: input.fuelPreference,
        desiredRate: input.desiredRate,
        wishes: [
          input.towingImportant && 'anhaenger',
          input.deliveryImportant && 'schnelle-lieferung',
        ].filter(Boolean),
      },
      results.map((r) => ({
        id: r.id,
        brand: r.brand,
        model: r.model,
        variant: r.variant,
        fullLabel: r.fullLabel ?? r.label,
      })),
      { termMonths: input.termMonths, source: 'assistant' },
    );
    showToast(`${results.length} Empfehlungen berechnet`);
  }

  function buildSalesPayload(rec) {
    return {
      ...rec.sourceVehicle,
      engineId: rec.engineId,
      trimId: rec.trimId,
      colorId: rec.colorId,
      monthlyRate: rec.monthlyRate,
      availabilityLabel: rec.availabilityLabel,
      deliveryTime: rec.deliveryTime,
      hauspreis: rec.hauspreis,
    };
  }

  function buildCustomerPayload() {
    return {
      name: input.name,
      phone: input.phone,
      email: input.email,
      desiredRate: input.desiredRate,
      mileagePerYear: input.mileagePerYear,
      termMonths: input.termMonths,
      downPayment: input.downPayment,
    };
  }

  function persistOffer(rec) {
    const customer = buildCustomerPayload();
    const offer = createOfferFromSales(customer, buildSalesPayload(rec), conditions, getExistingCodes());
    addOffer(offer);
    const { lead, leadId, isNew } = createOrLinkLeadForOffer(offer, leads);
    if (isNew) addLead(lead);
    else updateLead(leadId, lead);
    linkLead(offer.code, leadId);
    const url = buildOfferUrl(offer.code);
    setCreatedOffers((prev) => ({ ...prev, [rec.id]: { offer, url } }));
    return { offer, url };
  }

  function handleCreateOffer(rec, openView = false) {
    const existing = createdOffers[rec.id];
    if (existing) {
      if (openView) navigate(buildOfferPath(existing.offer.code));
      return existing;
    }
    const result = persistOffer(rec);
    showToast(`Angebot ${result.offer.code} erstellt`);
    if (openView) {
      navigate(buildOfferPath(result.offer.code));
    }
    return result;
  }

  function handleCreateComparison() {
    if (compareItems.length < 2) {
      showToast('Mindestens 2 Fahrzeuge zum Vergleich wählen');
      return;
    }
    recordIntelligenceComparison(
      compareItems.map((r) => ({
        brand: r.brand,
        model: r.model,
        fullLabel: r.fullLabel ?? r.label,
      })),
      { source: 'assistant' },
    );
    let firstCode = null;
    for (const rec of compareItems) {
      const { offer } = createdOffers[rec.id] ?? persistOffer(rec);
      if (!firstCode) firstCode = offer.code;
    }
    showToast(`${compareItems.length} Vergleichsangebote erstellt`);
    navigate(buildOfferPath(firstCode));
  }

  function toggleCompare(id) {
    setCompareIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  return (
    <div className="assistant-page">
      <header className="assistant-header">
        <Link to="/backend" className="assistant-header__back">←</Link>
        <div className="assistant-header__center">
          <p className="assistant-header__kicker">KI-Verkaufsassistent</p>
          <h1 className="assistant-header__title">{conditions.dealerName}</h1>
        </div>
        <Link to="/offers" className="assistant-header__link">Angebote</Link>
      </header>

      <main className="assistant-main">
        <form className="assistant-form" onSubmit={handleCalculate}>
          <section className="assistant-section">
            <h2 className="assistant-section__title">Kunde</h2>
            <div className="assistant-fields">
              <input
                type="text"
                className="assistant-input"
                placeholder="Name"
                value={input.name}
                onChange={(e) => update('name', e.target.value)}
              />
              <input
                type="tel"
                className="assistant-input"
                placeholder="Telefon"
                value={input.phone}
                onChange={(e) => update('phone', e.target.value)}
              />
              <input
                type="email"
                className="assistant-input"
                placeholder="E-Mail"
                value={input.email}
                onChange={(e) => update('email', e.target.value)}
              />
            </div>
          </section>

          <section className="assistant-section">
            <h2 className="assistant-section__title">Budget & Rate</h2>
            <div className="assistant-rate-hero">
              <label htmlFor="desiredRate">Wunschrate</label>
              <div className="assistant-rate-row">
                <input
                  id="desiredRate"
                  type="number"
                  min={100}
                  max={2000}
                  step={10}
                  value={input.desiredRate}
                  onChange={(e) => update('desiredRate', Number(e.target.value) || 0)}
                />
                <span>€/Monat</span>
              </div>
            </div>
            <div className="assistant-grid-2">
              <label className="assistant-mini">
                Budget (max.)
                <input
                  type="number"
                  className="assistant-input"
                  min={100}
                  step={10}
                  value={input.budget}
                  onChange={(e) => update('budget', Number(e.target.value) || 0)}
                />
              </label>
              <label className="assistant-mini">
                Anzahlung
                <input
                  type="number"
                  className="assistant-input"
                  min={0}
                  step={500}
                  value={input.downPayment}
                  onChange={(e) => update('downPayment', Number(e.target.value) || 0)}
                />
              </label>
            </div>
            <div className="assistant-grid-2">
              <label className="assistant-mini">
                Laufzeit
                <select
                  className="assistant-input"
                  value={input.termMonths}
                  onChange={(e) => update('termMonths', Number(e.target.value))}
                >
                  <option value={36}>36 Monate</option>
                  <option value={48}>48 Monate</option>
                  <option value={60}>60 Monate</option>
                </select>
              </label>
              <label className="assistant-mini">
                Kilometer/Jahr
                <select
                  className="assistant-input"
                  value={input.mileagePerYear}
                  onChange={(e) => update('mileagePerYear', Number(e.target.value))}
                >
                  <option value={10000}>10.000 km</option>
                  <option value={15000}>15.000 km</option>
                  <option value={20000}>20.000 km</option>
                </select>
              </label>
            </div>
          </section>

          <section className="assistant-section">
            <h2 className="assistant-section__title">Fahrzeugwunsch</h2>
            <div className="assistant-type-tabs">
              {VEHICLE_TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={`assistant-type-tab${input.vehicleType === opt.id ? ' is-active' : ''}`}
                  onClick={() => update('vehicleType', opt.id)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="assistant-fuel-tabs">
              {FUEL_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={`assistant-fuel-tab${input.fuelPreference === opt.id ? ' is-active' : ''}`}
                  onClick={() => update('fuelPreference', opt.id)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <input
              type="text"
              className="assistant-input"
              placeholder="Marke / Modell optional"
              value={input.brandModel}
              onChange={(e) => update('brandModel', e.target.value)}
            />
          </section>

          <section className="assistant-section">
            <h2 className="assistant-section__title">Anforderungen</h2>
            <div className="assistant-chips">
              <ToggleChip active={input.automatic} onClick={() => update('automatic', !input.automatic)}>
                Automatik
              </ToggleChip>
              <ToggleChip active={input.family} onClick={() => update('family', !input.family)}>
                Familie
              </ToggleChip>
              <ToggleChip active={input.dog} onClick={() => update('dog', !input.dog)}>
                Hund
              </ToggleChip>
              <ToggleChip active={input.towingImportant} onClick={() => update('towingImportant', !input.towingImportant)}>
                Anhängelast
              </ToggleChip>
              <ToggleChip active={input.deliveryImportant} onClick={() => update('deliveryImportant', !input.deliveryImportant)}>
                Lieferzeit wichtig
              </ToggleChip>
            </div>
          </section>

          <button type="submit" className="assistant-submit">
            Empfehlungen berechnen
          </button>
        </form>

        {recommendations && (
          <section className="assistant-results" aria-live="polite">
            <header className="assistant-results__head">
              <h2>{recommendations.length} Empfehlungen</h2>
              <p>Wunsch {formatRecommendationRate(input.desiredRate)}/Monat</p>
            </header>

            <div className="assistant-results__list">
              {recommendations.map((rec) => (
                <AssistantRecommendationCard
                  key={rec.id}
                  recommendation={rec}
                  inCompare={compareIds.includes(rec.id)}
                  expanded={expandedId === rec.id}
                  createdOffer={createdOffers[rec.id]?.offer ?? null}
                  offerUrl={createdOffers[rec.id]?.url ?? ''}
                  onCreateOffer={handleCreateOffer}
                  onToggleCompare={toggleCompare}
                  onToggleDetails={(id) => setExpandedId((p) => (p === id ? null : id))}
                />
              ))}
            </div>

            <AssistantComparePanel
              items={compareItems}
              onRemove={(id) => setCompareIds((prev) => prev.filter((x) => x !== id))}
            />

            <LegalDisclaimer className="assistant-disclaimer" />
          </section>
        )}
      </main>

      {compareIds.length >= 2 && (
        <footer className="assistant-compare-bar">
          <p>{compareIds.length} im Vergleich</p>
          <button type="button" onClick={handleCreateComparison}>
            Vergleichsangebote erstellen
          </button>
        </footer>
      )}

      {toast && <p className="assistant-toast" role="status">{toast}</p>}
    </div>
  );
}
