import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { parseLandingQuery, buildAdvisorUrl } from '../../services/landingAdvisorBridge.js';

const ROTATING_EXAMPLES = [
  'Suche Leasingangebot bis 300 € im Umkreis von Stuttgart.',
  'Ich suche einen Porsche bis 1.000 € im Monat.',
  'SUV mit Anhängerkupplung unter 400 €.',
  'Familienauto für zwei Kinder und Hund.',
  'Welches Elektroauto passt zu 30.000 km/Jahr?',
  'Nachfolger für meinen Tiguan.',
];

export default function LandingHero() {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const [advisorText, setAdvisorText] = useState('');
  const [exampleIdx, setExampleIdx] = useState(0);
  const dynamicPlaceholder = useMemo(
    () => (advisorText ? '' : ROTATING_EXAMPLES[exampleIdx]),
    [advisorText, exampleIdx],
  );

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setExampleIdx((prev) => (prev + 1) % ROTATING_EXAMPLES.length);
    }, 3200);
    return () => clearInterval(timer);
  }, []);

  function handleAdvisorSubmit(event) {
    event.preventDefault();
    if (!advisorText.trim()) return;
    const parsed = parseLandingQuery(advisorText);
    navigate(buildAdvisorUrl(parsed.profile, parsed.query, { location: parsed.location ?? null }));
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
      if (spoken) setAdvisorText(spoken);
    };
    recognition.onend = () => inputRef.current?.focus();
    recognition.start();
  }

  return (
    <section className="lp-hero" aria-labelledby="lp-hero-title">
      <div className="lp-hero__container">
        <h1 id="lp-hero-title" className="lp-hero__title">Nicht suchen. Einfach beschreiben.</h1>
        <p className="lp-hero__sub">Die KI findet passende Fahrzeuge zu Ihrem Budget und Einsatz.</p>

        <article className="lp-hero-focus">
          <form onSubmit={handleAdvisorSubmit} className="lp-hero-card__form">
            <div className="lp-input-shell">
              <textarea
                ref={inputRef}
                className="lp-input lp-input--hero"
                rows={6}
                value={advisorText}
                onChange={(event) => setAdvisorText(event.target.value)}
                placeholder={dynamicPlaceholder}
              />
              <button type="button" className="lp-mic-inline" onClick={startSpeechInput} aria-label="Spracheingabe starten">
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path d="M12 14a3 3 0 0 0 3-3V7a3 3 0 1 0-6 0v4a3 3 0 0 0 3 3Zm5-3a1 1 0 1 1 2 0 7 7 0 0 1-6 6.92V21h3a1 1 0 1 1 0 2H8a1 1 0 0 1 0-2h3v-3.08A7 7 0 0 1 5 11a1 1 0 0 1 2 0 5 5 0 1 0 10 0Z" />
                </svg>
              </button>
            </div>
            <div className="lp-hero-main-actions">
              <button type="submit" className="lp-btn lp-btn--primary">✨ Empfehlung erhalten</button>
            </div>
          </form>
          <div className="lp-rotating-example" aria-live="polite">💬 {ROTATING_EXAMPLES[exampleIdx]}</div>
        </article>
      </div>
    </section>
  );
}
