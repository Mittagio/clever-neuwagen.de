import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { buildWishSearchUrl } from '../../services/wish/wishUrlService.js';

export const LANDING_PLACEHOLDER_ROTATION = [
  'Leasing bis 300 € in Stuttgart',
  'Sportage Vision Benziner in meiner Nähe',
  'Familien-SUV mit Anhängerkupplung',
  'Elektroauto über 400 km Reichweite',
  'Kleinwagen bis 15.000 €',
  'Sofort verfügbar in 25 km Umkreis',
];

export const LANDING_POPULAR_SEARCHES = [
  'Leasing bis 300 €',
  'Elektroauto über 400 km',
  'Familien-SUV',
  'Sportage Vision',
  'Anhängelast über 2 Tonnen',
  'Kleinwagen bis 15.000 €',
  'Sofort verfügbar',
  'Elektroauto unter 200 €',
];

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
    }, 4000);
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

  function handlePopularClick(example) {
    setSearchText(example);
    inputRef.current?.focus();
  }

  function startSpeechInput() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      navigate('/assistant?mode=voice');
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
    <section className="lp-hero lp-hero--v4" aria-labelledby="lp-hero-title">
      <div className="lp-hero__container">
        <h1 id="lp-hero-title" className="lp-hero__title">
          Beschreibe einfach dein Wunschauto.
        </h1>
        <p className="lp-hero__sub">
          Keine Filter. Keine Fahrzeugkenntnisse.
          <br />
          Einfach schreiben oder sprechen.
        </p>

        <article className="lp-hero-focus lp-hero-focus--v4">
          <form onSubmit={handleSubmit} className="lp-hero-card__form">
            <div className="lp-input-shell">
              <textarea
                id="lp-search-input"
                ref={inputRef}
                className="lp-input lp-input--hero lp-input--v4"
                rows={5}
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder={dynamicPlaceholder}
                aria-label="Wunschauto beschreiben"
              />
              <button
                type="button"
                className="lp-mic-inline"
                onClick={startSpeechInput}
                aria-label="Spracheingabe starten"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path d="M12 14a3 3 0 0 0 3-3V7a3 3 0 1 0-6 0v4a3 3 0 0 0 3 3Zm5-3a1 1 0 1 1 2 0 7 7 0 0 1-6 6.92V21h3a1 1 0 1 1 0 2H8a1 1 0 0 1 0-2h3v-3.08A7 7 0 0 1 5 11a1 1 0 0 1 2 0 5 5 0 1 0 10 0Z" />
                </svg>
              </button>
            </div>

            <div className="lp-hero-main-actions">
              <button type="submit" className="lp-btn lp-btn--primary">Fahrzeuge finden</button>
            </div>
          </form>

          <div className="lp-popular-searches" aria-label="Beliebte Suchen">
            <p className="lp-popular-searches__label">Beliebte Suchen</p>
            <div className="lp-popular-searches__chips">
              {LANDING_POPULAR_SEARCHES.map((example) => (
                <button
                  key={example}
                  type="button"
                  className="lp-popular-chip"
                  onClick={() => handlePopularClick(example)}
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
