import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePublishedDealerConditions } from '../context/DealerConditionsContext.jsx';
import { useLeads } from '../context/LeadsContext.jsx';
import { useOffers } from '../context/OffersContext.jsx';
import {
  RECOMMENDATION_PREFERENCES,
  SALES_DEFAULTS,
} from '../data/salesCatalog.js';
import { createLeadFromSales } from '../logic/leadService.js';
import { createOfferFromSales, buildOfferUrl } from '../logic/offerService.js';
import {
  buildOfferMessage,
  buildWhatsAppUrl,
  copyOfferLink,
} from '../logic/salesMatcher.js';
import {
  formatRecommendationRate,
  getRecommendations,
} from '../logic/recommendationEngine.js';
import LegalDisclaimer from '../components/legal/LegalDisclaimer.jsx';
import './RecommendationPage.css';

export default function RecommendationPage() {
  const { publishedConditions: conditions } = usePublishedDealerConditions();
  const { addLead } = useLeads();
  const { addOffer, getExistingCodes } = useOffers();

  const [input, setInput] = useState({
    rate: SALES_DEFAULTS.desiredRate,
    budget: SALES_DEFAULTS.budget,
    mileagePerYear: SALES_DEFAULTS.mileagePerYear,
    termMonths: SALES_DEFAULTS.termMonths,
    downPayment: SALES_DEFAULTS.downPayment,
    preferences: [],
  });
  const [selectedId, setSelectedId] = useState(null);
  const [toast, setToast] = useState('');

  const recommendations = useMemo(
    () => getRecommendations(input, conditions),
    [input, conditions],
  );

  const selected = recommendations.find((r) => r.id === selectedId)
    ?? recommendations[0]
    ?? null;

  function update(field, value) {
    setInput((prev) => ({ ...prev, [field]: value }));
  }

  function togglePreference(id) {
    setInput((prev) => ({
      ...prev,
      preferences: prev.preferences.includes(id)
        ? prev.preferences.filter((p) => p !== id)
        : [...prev.preferences, id],
    }));
  }

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  }

  function handleSelectOffer(offer) {
    setSelectedId(offer.id);
    const customer = {
      name: '',
      phone: '',
      email: '',
      desiredRate: input.rate,
      mileagePerYear: input.mileagePerYear,
      termMonths: input.termMonths,
      downPayment: input.downPayment,
    };
    const lead = createLeadFromSales(customer, offer, conditions);
    addLead(lead);
    showToast(`${offer.label} als Lead gespeichert`);
  }

  async function handleWhatsApp() {
    if (!selected) return;
    const customer = {
      name: 'Kunde',
      desiredRate: input.rate,
      mileagePerYear: input.mileagePerYear,
      termMonths: input.termMonths,
      downPayment: input.downPayment,
    };
    const offer = createOfferFromSales(customer, selected, conditions, getExistingCodes());
    addOffer(offer);
    const url = buildOfferUrl(offer.code);
    const msg = buildOfferMessage(customer, selected, conditions.dealerName, url);
    window.open(buildWhatsAppUrl(msg), '_blank', 'noopener');
  }

  async function handleCopyLink() {
    if (!selected) return;
    try {
      const customer = {
        name: 'Kunde',
        desiredRate: input.rate,
        mileagePerYear: input.mileagePerYear,
        termMonths: input.termMonths,
        downPayment: input.downPayment,
      };
      const offer = createOfferFromSales(customer, selected, conditions, getExistingCodes());
      addOffer(offer);
      const url = buildOfferUrl(offer.code);
      await copyOfferLink(url);
      showToast('Angebotslink kopiert');
    } catch {
      showToast('Kopieren fehlgeschlagen');
    }
  }

  return (
    <div className="rec-page">
      <header className="rec-header">
        <Link to="/sales" className="rec-header-back">←</Link>
        <div className="rec-header-center">
          <p className="rec-header-kicker">Empfehlungsengine</p>
          <h1 className="rec-header-title">System verkauft mit</h1>
        </div>
        <Link to="/leads" className="rec-header-link">Leads</Link>
      </header>

      <main className="rec-main">
        <section className="rec-section">
          <h2 className="rec-section-title">Eingaben</h2>

          <div className="rec-rate-block">
            <label className="rec-rate-label" htmlFor="rec-rate">Rate</label>
            <div className="rec-rate-row">
              <input
                id="rec-rate"
                type="number"
                className="rec-rate-input"
                min={100}
                max={2000}
                step={10}
                value={input.rate}
                onChange={(e) => update('rate', Number(e.target.value) || 0)}
              />
              <span className="rec-rate-unit">€/Monat</span>
            </div>
          </div>

          <div className="rec-budget-row">
            <label htmlFor="rec-budget">Budget (max.)</label>
            <input
              id="rec-budget"
              type="number"
              className="rec-field"
              min={100}
              step={10}
              value={input.budget}
              onChange={(e) => update('budget', Number(e.target.value) || 0)}
            />
          </div>

          <div className="rec-grid-3">
            <div className="rec-mini">
              <label htmlFor="rec-km">Kilometer</label>
              <select
                id="rec-km"
                className="rec-field"
                value={input.mileagePerYear}
                onChange={(e) => update('mileagePerYear', Number(e.target.value))}
              >
                <option value={10000}>10.000 km</option>
                <option value={15000}>15.000 km</option>
                <option value={20000}>20.000 km</option>
              </select>
            </div>
            <div className="rec-mini">
              <label htmlFor="rec-term">Laufzeit</label>
              <select
                id="rec-term"
                className="rec-field"
                value={input.termMonths}
                onChange={(e) => update('termMonths', Number(e.target.value))}
              >
                <option value={36}>36 Mt.</option>
                <option value={48}>48 Mt.</option>
                <option value={60}>60 Mt.</option>
              </select>
            </div>
            <div className="rec-mini">
              <label htmlFor="rec-down">Anzahlung</label>
              <input
                id="rec-down"
                type="number"
                className="rec-field"
                min={0}
                step={500}
                value={input.downPayment}
                onChange={(e) => update('downPayment', Number(e.target.value) || 0)}
              />
            </div>
          </div>

          <div className="rec-prefs">
            {RECOMMENDATION_PREFERENCES.map((pref) => {
              const isOn = input.preferences.includes(pref.id);
              return (
                <button
                  key={pref.id}
                  type="button"
                  className={`rec-pref${isOn ? ' is-on' : ''}`}
                  onClick={() => togglePreference(pref.id)}
                  aria-pressed={isOn}
                >
                  <span>{pref.emoji}</span>
                  {pref.label}
                </button>
              );
            })}
          </div>
        </section>

        <section className="rec-results" aria-live="polite">
          <div className="rec-results-head">
            <p className="rec-results-rate">{formatRecommendationRate(input.rate)}</p>
            <span className="rec-results-arrow" aria-hidden>↓</span>
          </div>

          <h2 className="rec-results-title">
            {recommendations.length} Vorschläge · Live-Raten
          </h2>

          <div className="rec-list">
            {recommendations.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`rec-card${selected?.id === item.id ? ' is-selected' : ''}`}
                onClick={() => setSelectedId(item.id)}
              >
                <span className="rec-card-rank">{item.rank}</span>
                <div className="rec-card-body">
                  <p className="rec-card-name">{item.label}</p>
                  <p className="rec-card-meta">
                    {item.fuelLabel}
                    {item.matchReasons.length > 0 && (
                      <span className="rec-card-tags">
                        {item.matchReasons.slice(0, 2).join(' · ')}
                      </span>
                    )}
                  </p>
                </div>
                <div className="rec-card-rate">
                  <strong>{formatRecommendationRate(item.monthlyRate)}</strong>
                  <span>/Mo</span>
                </div>
              </button>
            ))}
          </div>

          <LegalDisclaimer className="rec-disclaimer" />

          {selected && (
            <div className="rec-actions">
              <button
                type="button"
                className="rec-action rec-action--primary"
                onClick={() => handleSelectOffer(selected)}
              >
                Als Lead speichern
              </button>
              <button
                type="button"
                className="rec-action"
                onClick={handleCopyLink}
              >
                Angebotslink
              </button>
              <button
                type="button"
                className="rec-action rec-action--wa"
                onClick={handleWhatsApp}
              >
                WhatsApp
              </button>
            </div>
          )}
        </section>
      </main>

      {toast && <div className="rec-toast" role="status">{toast}</div>}
    </div>
  );
}
