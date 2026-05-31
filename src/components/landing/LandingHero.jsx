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

  const displayChips = LANDING_EXAMPLE_CHIPS.filter((c) =>
    ['family', 'electro', 'suv-tow', 'company', 'tiguan'].includes(c.id),
  );

  return (
    <section className="lp-hero" aria-labelledby="lp-hero-title">
      <div className="lp-hero__grid">
        <div className="lp-hero__content">
          <span className="lp-hero__badge">✨ Ihr smarter Weg zum passenden Auto</span>

          <h1 id="lp-hero-title" className="lp-hero__title">
            Welches Auto passt{' '}
            <span className="lp-hero__title-accent">wirklich</span>
            {' '}zu Ihnen?
          </h1>

          <p className="lp-hero__sub">
            Beschreiben Sie einfach Ihr Fahrprofil. Unsere KI findet passende Fahrzeuge
            inklusive aktueller Leasingraten, Lieferzeiten und Händlerangebote.
          </p>

          <form className="lp-hero__form" onSubmit={handleSubmit}>
            <div className="lp-hero__input-wrap">
              <label htmlFor="lp-query" className="visually-hidden">Fahrprofil beschreiben</label>
              <textarea
                id="lp-query"
                className="lp-hero__input"
                rows={4}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ich fahre 20.000 km im Jahr, habe zwei Kinder und möchte maximal 400 € Leasingrate bezahlen."
              />
              <span className="lp-hero__input-sparkle" aria-hidden>✨</span>
            </div>

            <div className="lp-hero__actions">
              <button type="submit" className="lp-btn lp-btn--gradient" disabled={!query.trim()}>
                ✨ KI Empfehlung erhalten
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
