import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { buildWishSearchUrl } from '../../services/wish/wishUrlService.js';
import { isSpeechRecognitionSupported, startSpeechRecognition } from '../../services/sales/conversationVoiceParser.js';
import {
  DEALER_SEARCH_CHIPS,
  DEALER_SEARCH_PLACEHOLDERS,
} from '../../data/dealerLandingContent.js';
import AiAssistantIcon from './AiAssistantIcon.jsx';
import './dealer-landing.css';

export default function DealerSearchHero({ dealerName, city, brand = 'Kia' }) {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const [searchText, setSearchText] = useState('');
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const [listening, setListening] = useState(false);
  const [voiceError, setVoiceError] = useState('');

  const dynamicPlaceholder = useMemo(
    () => (searchText ? '' : DEALER_SEARCH_PLACEHOLDERS[placeholderIdx]),
    [searchText, placeholderIdx],
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setPlaceholderIdx((prev) => (prev + 1) % DEALER_SEARCH_PLACEHOLDERS.length);
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

  function handleChipClick(query) {
    submitSearch(query);
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
      <header className="dl-hero__intro">
        <h1 id="dl-hero-title" className="dl-hero__title">
          KI-Berater von {dealerName}
        </h1>
        <p className="dl-hero__sub">
          Beschreiben Sie einfach Ihr Wunschfahrzeug.
          <br />
          Wir finden das passende {brand}-Modell für Sie.
        </p>
      </header>

      <div className="dl-hero__search-block">
        <h2 className="dl-hero__search-label">
          <span className="dl-hero__ai-badge" aria-hidden>
            <AiAssistantIcon size={18} />
          </span>
          Fahrzeug finden
        </h2>

        <form className="dl-hero__form" onSubmit={handleSubmit}>
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
            <AiAssistantIcon size={16} />
            Fahrzeug finden
          </button>
        </form>

        <div className="dl-hero__chips" aria-label="Schnellvorschläge">
          {DEALER_SEARCH_CHIPS.map((chip) => (
            <button
              key={chip.label}
              type="button"
              className="dl-chip"
              onClick={() => handleChipClick(chip.query)}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
