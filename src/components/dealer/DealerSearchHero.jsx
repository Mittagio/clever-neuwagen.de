import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { buildWishSearchUrl } from '../../services/wish/wishUrlService.js';
import { isSpeechRecognitionSupported, startSpeechRecognition } from '../../services/sales/conversationVoiceParser.js';
import { DEALER_SEARCH_EXAMPLES } from '../../data/dealerLandingContent.js';
import './dealer-landing.css';

const PLACEHOLDERS = [
  'SUV für die Familie, maximal 400 € im Monat',
  'Elektroauto mit über 400 km Reichweite',
  'Sportage Hybrid sofort verfügbar',
  'Kompaktwagen für die Stadt',
];

export default function DealerSearchHero({ dealerName, city, brand = 'Kia' }) {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const [searchText, setSearchText] = useState('');
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const [listening, setListening] = useState(false);
  const [voiceError, setVoiceError] = useState('');

  const dynamicPlaceholder = useMemo(
    () => (searchText ? '' : PLACEHOLDERS[placeholderIdx]),
    [searchText, placeholderIdx],
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setPlaceholderIdx((prev) => (prev + 1) % PLACEHOLDERS.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  function submitSearch(text) {
    const value = (text ?? searchText).trim();
    if (!value) {
      navigate(`/fahrzeuge?q=${encodeURIComponent(city)}&brand=${encodeURIComponent(brand.toLowerCase())}`);
      return;
    }
    const url = buildWishSearchUrl(`${value} ${city}`.trim());
    navigate(url);
  }

  function handleSubmit(event) {
    event.preventDefault();
    submitSearch();
  }

  function handleExampleClick(example) {
    setSearchText(example);
    inputRef.current?.focus();
  }

  function startVoice() {
    if (!isSpeechRecognitionSupported()) {
      setVoiceError('Spracheingabe nicht verfügbar – bitte tippen.');
      inputRef.current?.focus();
      return;
    }
    setVoiceError('');
    setListening(true);
    startSpeechRecognition({
      onResult: ({ finalText }) => {
        if (finalText) setSearchText(finalText);
        setListening(false);
        inputRef.current?.focus();
      },
      onError: (msg) => {
        setVoiceError(msg);
        setListening(false);
      },
      onEnd: () => setListening(false),
    });
  }

  return (
    <section className="dl-hero" aria-labelledby="dl-hero-title">
      <p className="dl-hero__eyebrow">{brand} Partner · {dealerName}</p>
      <h2 id="dl-hero-title" className="dl-hero__title">
        Finden Sie Ihr passendes {brand}-Modell
      </h2>
      <p className="dl-hero__sub">Welches Fahrzeug suchen Sie?</p>

      <form className="dl-hero__form card" onSubmit={handleSubmit}>
        <div className="dl-hero__input-wrap">
          <textarea
            ref={inputRef}
            className="dl-hero__input"
            rows={3}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder={dynamicPlaceholder}
            aria-label="Fahrzeugwunsch beschreiben"
          />
          <button
            type="button"
            className={`dl-hero__mic${listening ? ' is-active' : ''}`}
            onClick={startVoice}
            aria-label="Spracheingabe"
            title="Spracheingabe"
          >
            🎤
          </button>
        </div>
        {voiceError && <p className="dl-hero__voice-error" role="alert">{voiceError}</p>}
        <button type="submit" className="btn btn-primary dl-hero__cta">
          Fahrzeug finden
        </button>
      </form>

      <div className="dl-hero__chips" aria-label="Beliebte Suchvorschläge">
        {DEALER_SEARCH_EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            className="dl-chip"
            onClick={() => handleExampleClick(example)}
          >
            {example}
          </button>
        ))}
      </div>
    </section>
  );
}
