import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { buildWishSearchUrl } from '../../services/wish/wishUrlService.js';

export const LANDING_PLACEHOLDER_ROTATION = [
  'E-Auto bis 400 € in Schorndorf',
  'Familien-SUV bis 350 €',
  'Sportage Benziner Automatik in meiner Nähe',
  'Kleinwagen bis 15.000 €',
  'Auto mit Anhängerkupplung',
  'Elektroauto über 400 km Reichweite',
];

/** Beispiel-Chips – Text ins Suchfeld übernehmen */
export const LANDING_EXAMPLE_SEARCHES = [
  'E-Auto bis 400 €',
  'Familien-SUV',
  'Sportage Benziner',
  'Kleinwagen bis 15.000 €',
  'Anhängerkupplung',
  'Sofort verfügbar',
  '7-Sitzer',
  'Elektroauto über 400 km',
];

/** @deprecated Alias für Tests/Imports */
export const LANDING_POPULAR_SEARCHES = LANDING_EXAMPLE_SEARCHES;

export default function LandingHero() {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const [searchText, setSearchText] = useState('');
  const [placeholderIdx, setPlaceholderIdx] = useState(0);

  const dynamicPlaceholder = useMemo(
    () => (searchText ? '' : LANDING_PLACEHOLDER_ROTATION[placeholderIdx]),
    [searchText, placeholderIdx],
  );

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setPlaceholderIdx((prev) => (prev + 1) % LANDING_PLACEHOLDER_ROTATION.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  function submitSearch(text) {
    const value = (text ?? searchText).trim();
    if (!value) {
      navigate('/fahrzeuge');
      return;
    }
    navigate(buildWishSearchUrl(value));
  }

  function handleSubmit(event) {
    event.preventDefault();
    submitSearch();
  }

  function handleExampleClick(example) {
    setSearchText(example);
    inputRef.current?.focus();
  }

  function startSpeechInput() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      window.alert('Spracheingabe wird in diesem Browser nicht unterstützt. Bitte tippen Sie Ihre Suche.');
      inputRef.current?.focus();
      return;
    }
    const recognition = new SR();
    recognition.lang = 'de-DE';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const spoken = event.results?.[0]?.[0]?.transcript ?? '';
      if (spoken) {
        setSearchText(spoken);
        inputRef.current?.focus();
      }
    };
    recognition.onend = () => inputRef.current?.focus();
    recognition.start();
  }

  return (
    <section className="lp-hero lp-hero--search" aria-labelledby="lp-hero-title">
      <div className="lp-hero__container">
        <h1 id="lp-hero-title" className="lp-hero__title">
          Was passt zu dir – und was gibt es in deiner Nähe?
        </h1>
        <p className="lp-hero__sub">
          Beschreibe einfach, was du suchst. Wir finden passende Neuwagenangebote bei regionalen Händlern.
        </p>

        <article className="lp-hero-focus lp-hero-focus--search">
          <form onSubmit={handleSubmit} className="lp-hero-card__form">
            <div className="lp-input-shell">
              <textarea
                id="lp-search-input"
                ref={inputRef}
                className="lp-input lp-input--hero lp-input--search"
                rows={5}
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder={dynamicPlaceholder}
                aria-label="Neuwagen suchen"
              />
              <button
                type="button"
                className="lp-mic-inline"
                onClick={startSpeechInput}
                aria-label="Spracheingabe starten"
                title="Suche per Sprache"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path d="M12 14a3 3 0 0 0 3-3V7a3 3 0 1 0-6 0v4a3 3 0 0 0 3 3Zm5-3a1 1 0 1 1 2 0 7 7 0 0 1-6 6.92V21h3a1 1 0 1 1 0 2H8a1 1 0 0 1 0-2h3v-3.08A7 7 0 0 1 5 11a1 1 0 0 1 2 0 5 5 0 1 0 10 0Z" />
                </svg>
              </button>
            </div>

            <div className="lp-hero-main-actions">
              <button type="submit" className="lp-btn lp-btn--primary">
                Fahrzeuge finden
              </button>
            </div>
          </form>

          <div className="lp-popular-searches" aria-label="Beispiel-Suchen">
            <p className="lp-popular-searches__label">Beispiel-Suchen</p>
            <div className="lp-popular-searches__chips">
              {LANDING_EXAMPLE_SEARCHES.map((example) => (
                <button
                  key={example}
                  type="button"
                  className="lp-popular-chip"
                  onClick={() => handleExampleClick(example)}
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}
