import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LANDING_EXAMPLE_CHIPS,
  parseLandingQuery,
  buildAdvisorUrl,
  profileFromChip,
} from '../../services/landingAdvisorBridge.js';
import { recordIntelligenceSearch } from '../../services/intelligenceAnalytics.js';
import LandingSpeechModal from './LandingSpeechModal.jsx';
import LandingHeroVisual from './LandingHeroVisual.jsx';
import {
  MARKETPLACE_RADIUS_OPTIONS,
  MARKETPLACE_RATE_OPTIONS,
  MARKETPLACE_PRICE_OPTIONS,
  MARKETPLACE_TYPE_OPTIONS,
} from '../../data/marketplaceVehicles.js';
import { buildMarketplaceSearch } from '../../logic/marketplaceService.js';

const HERO_BENEFITS = [
  {
    icon: '🎯',
    title: 'Individuell & unabhängig',
    text: 'Ehrliche Empfehlungen ohne Herstellerbindung',
  },
  {
    icon: '📈',
    title: 'Aktuelle Deals',
    text: 'Tagesaktuelle Leasingraten & Aktionen',
  },
  {
    icon: '⚡',
    title: 'Schnell & einfach',
    text: 'In 2 Minuten zur passenden Empfehlung',
  },
];

export default function LandingHero() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [speechOpen, setSpeechOpen] = useState(false);
  const [marketSearch, setMarketSearch] = useState({
    q: '',
    radius: 50,
    maxRate: 400,
    maxPrice: null,
    type: 'all',
  });

  function goToAdvisor(text, profileOverride) {
    const parsed = profileOverride
      ? { profile: profileOverride, query: text }
      : parseLandingQuery(text);
    if (parsed.query) {
      recordIntelligenceSearch(parsed.query, { source: 'landing-hero' });
    }
    navigate(buildAdvisorUrl(parsed.profile, parsed.query));
  }

  function handleChip(chip) {
    const { profile, query: q } = profileFromChip(chip);
    setQuery(q);
    goToAdvisor(q, profile);
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!query.trim()) return;
    goToAdvisor(query);
  }

  function handleMarketSubmit(event) {
    event.preventDefault();
    const queryString = buildMarketplaceSearch(marketSearch);
    navigate(`/fahrzeuge${queryString ? `?${queryString}` : ''}`);
  }

  const displayChips = LANDING_EXAMPLE_CHIPS.filter((c) =>
    ['family', 'electro', 'suv-tow', 'company', 'tiguan'].includes(c.id),
  );

  return (
    <section className="lp-hero" aria-labelledby="lp-hero-title">
      <div className="lp-hero__grid">
        <div className="lp-hero__content">
          <span className="lp-hero__badge">✨ Ihr smarter Weg zum passenden Auto</span>

          <h1 id="lp-hero-title" className="lp-hero__title">
            ChatGPT + ImmoScout für Neuwagen:
            <span className="lp-hero__title-accent"> KI Beratung oder Umkreissuche.</span>
          </h1>

          <p className="lp-hero__sub">
            Zwei Einstiege für jeden Kundentyp: per KI den Bedarf klären oder direkt
            Angebote in der Nähe mit Rate, Kaufpreis und Verfügbarkeit durchsuchen.
          </p>

          <div className="lp-entry-grid">
            <article className="lp-entry-card">
              <h2>🤖 KI Kaufberater</h2>
              <p>Beschreiben Sie einfach Ihr Wunschfahrzeug.</p>
              <form className="lp-hero__form" onSubmit={handleSubmit}>
                <div className="lp-hero__input-wrap">
                  <label htmlFor="lp-query" className="visually-hidden">Fahrprofil beschreiben</label>
                  <textarea
                    id="lp-query"
                    className="lp-hero__input"
                    rows={4}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Familienauto bis 400 € · Elektroauto für 25.000 km/Jahr · SUV mit Anhängerkupplung"
                  />
                  <span className="lp-hero__input-sparkle" aria-hidden>✨</span>
                </div>
                <div className="lp-hero__actions">
                  <button type="submit" className="lp-btn lp-btn--gradient" disabled={!query.trim()}>
                    KI Empfehlung erhalten
                  </button>
                  <button
                    type="button"
                    className="lp-btn lp-btn--outline"
                    onClick={() => setSpeechOpen(true)}
                  >
                    🎙 Spracheingabe starten
                  </button>
                </div>
              </form>
            </article>

            <article className="lp-entry-card">
              <h2>🔍 Fahrzeuge in Ihrer Nähe</h2>
              <p>Finden wie bei ImmoScout: Ort, Radius, Budget und Typ filtern.</p>
              <form className="lp-market-form" onSubmit={handleMarketSubmit}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="PLZ oder Ort"
                  value={marketSearch.q}
                  onChange={(e) => setMarketSearch((prev) => ({ ...prev, q: e.target.value }))}
                />
                <select
                  className="form-select"
                  value={marketSearch.radius ?? ''}
                  onChange={(e) => setMarketSearch((prev) => ({ ...prev, radius: e.target.value ? Number(e.target.value) : null }))}
                >
                  {MARKETPLACE_RADIUS_OPTIONS.map((item) => <option key={item.id} value={item.value ?? ''}>{item.label}</option>)}
                </select>
                <select
                  className="form-select"
                  value={marketSearch.maxRate ?? ''}
                  onChange={(e) => setMarketSearch((prev) => ({ ...prev, maxRate: e.target.value ? Number(e.target.value) : null }))}
                >
                  {MARKETPLACE_RATE_OPTIONS.map((item) => <option key={item.id} value={item.value ?? ''}>{item.label}</option>)}
                </select>
                <select
                  className="form-select"
                  value={marketSearch.maxPrice ?? ''}
                  onChange={(e) => setMarketSearch((prev) => ({ ...prev, maxPrice: e.target.value ? Number(e.target.value) : null }))}
                >
                  {MARKETPLACE_PRICE_OPTIONS.map((item) => <option key={item.id} value={item.value ?? ''}>{item.label}</option>)}
                </select>
                <select
                  className="form-select"
                  value={marketSearch.type}
                  onChange={(e) => setMarketSearch((prev) => ({ ...prev, type: e.target.value }))}
                >
                  {MARKETPLACE_TYPE_OPTIONS.filter((item) => item.id !== 'all').map((item) => (
                    <option key={item.id} value={item.id}>{item.label}</option>
                  ))}
                </select>
                <button type="submit" className="lp-btn lp-btn--gradient">🔍 Fahrzeuge finden</button>
              </form>
            </article>
          </div>

          <div className="lp-chips-block">
            <p className="lp-chips-block__label">Beliebte Anfragen</p>
            <div className="lp-chips" aria-label="Beispiele">
              {displayChips.map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  className="lp-chip"
                  onClick={() => handleChip(chip)}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="lp-hero__aside">
          <ul className="lp-hero-benefits">
            {HERO_BENEFITS.map((b) => (
              <li key={b.title} className="lp-hero-benefit">
                <span className="lp-hero-benefit__icon" aria-hidden>{b.icon}</span>
                <div>
                  <p className="lp-hero-benefit__title">{b.title}</p>
                  <p className="lp-hero-benefit__text">{b.text}</p>
                </div>
              </li>
            ))}
          </ul>
          <LandingHeroVisual />
        </div>
      </div>

      <LandingSpeechModal
        open={speechOpen}
        onClose={() => setSpeechOpen(false)}
        onUseText={(text) => {
          setQuery(text);
          setSpeechOpen(false);
        }}
      />
    </section>
  );
}
