import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { buildDealerWishSearchUrl } from '../../services/wish/wishUrlService.js';
import { isSpeechRecognitionSupported, startSpeechRecognition } from '../../services/sales/conversationVoiceParser.js';
import {
  getDealerWishChipDisplay,
  getExtraDealerChips,
  getPrimaryDealerChips,
} from '../../services/dealer/dealerWishChips.js';
import { DEALER_SEARCH_PLACEHOLDERS } from '../../data/dealerLandingContent.js';
import DealerRecognizedWishes from './DealerRecognizedWishes.jsx';
import './dealer-landing.css';

function ChipButton({ chip, active, onToggle }) {
  const display = getDealerWishChipDisplay(chip);
  return (
    <button
      type="button"
      className={`dl-chip${active ? ' dl-chip--active' : ''}`}
      aria-pressed={active}
      aria-label={active ? `${chip.label} entfernen` : chip.label}
      onClick={() => onToggle?.(chip.id)}
    >
      {display.emoji && (
        <span className="dl-chip__emoji" aria-hidden>{display.emoji}</span>
      )}
      <span className="dl-chip__label">{display.label}</span>
      {active && <span className="dl-chip__remove" aria-hidden>✕</span>}
    </button>
  );
}

export default function DealerSearchHero({
  dealerName,
  city,
  dealerSlug = '',
  onSearch,
  onQueryChange,
  onChipToggle,
  selectedChipIds = [],
  recognizedWishes = [],
  inputRef: externalInputRef,
  queryValue = '',
}) {
  const navigate = useNavigate();
  const internalInputRef = useRef(null);
  const inputRef = externalInputRef ?? internalInputRef;
  const [searchText, setSearchText] = useState(queryValue);
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const [placeholderVisible, setPlaceholderVisible] = useState(true);
  const [listening, setListening] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const [showMoreChips, setShowMoreChips] = useState(false);

  const primaryChips = useMemo(() => getPrimaryDealerChips(), []);
  const extraChips = useMemo(() => getExtraDealerChips(), []);

  const dynamicPlaceholder = useMemo(
    () => (searchText ? '' : DEALER_SEARCH_PLACEHOLDERS[placeholderIdx]),
    [searchText, placeholderIdx],
  );

  useEffect(() => {
    if (searchText) return undefined;
    const timer = setInterval(() => {
      setPlaceholderVisible(false);
      setTimeout(() => {
        setPlaceholderIdx((prev) => (prev + 1) % DEALER_SEARCH_PLACEHOLDERS.length);
        setPlaceholderVisible(true);
      }, 180);
    }, 2600);
    return () => clearInterval(timer);
  }, [searchText]);

  useEffect(() => {
    setSearchText(queryValue);
  }, [queryValue]);

  function submitSearch(text) {
    const value = (text ?? searchText).trim();
    if (onSearch) {
      onSearch(value);
      return;
    }
    if (!value) return;
    navigate(buildDealerWishSearchUrl(value, { city, dealerSlug }));
  }

  function handleQueryInput(nextValue) {
    setSearchText(nextValue);
    onQueryChange?.(nextValue);
  }

  function handleSubmit(event) {
    event.preventDefault();
    submitSearch();
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submitSearch();
    }
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
        if (finalText) handleQueryInput(finalText);
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

  const hasSelection = Boolean(searchText.trim());

  return (
    <section className="dl-hero dl-hero--chat" aria-labelledby="dl-hero-title">
      <header className="dl-hero__head">
        <h1 id="dl-hero-title" className="dl-hero__prompt">
          Wonach suchen Sie?
        </h1>
        <p className="dl-hero__dealer">{dealerName}</p>
      </header>

      <form className="dl-hero__composer" onSubmit={handleSubmit}>
        <div className={`dl-hero__composer-box${hasSelection ? ' dl-hero__composer-box--filled' : ''}`}>
          {!searchText && dynamicPlaceholder && (
            <span
              className={`dl-hero__placeholder${placeholderVisible ? ' dl-hero__placeholder--visible' : ''}`}
              aria-hidden
            >
              {dynamicPlaceholder}
            </span>
          )}
          <textarea
            ref={inputRef}
            className="dl-hero__composer-input"
            rows={3}
            value={searchText}
            onChange={(e) => handleQueryInput(e.target.value)}
            onKeyDown={handleKeyDown}
            aria-label="Fahrzeugwunsch beschreiben"
          />
          <div className="dl-hero__composer-actions">
            <button
              type="button"
              className={`dl-hero__mic${listening ? ' is-active' : ''}`}
              onClick={startVoice}
              aria-label="Spracheingabe"
              title="Spracheingabe"
            >
              🎤
            </button>
            <button
              type="submit"
              className="dl-hero__send"
              disabled={!hasSelection}
              aria-label="Suche starten"
            >
              ↑
            </button>
          </div>
        </div>
        {voiceError && (
          <p className="dl-hero__voice-error" role="alert">{voiceError}</p>
        )}
        <DealerRecognizedWishes wishes={recognizedWishes} compact />
      </form>

      <div className="dl-hero__chips" aria-label="Schnellauswahl">
        {primaryChips.map((chip) => (
          <ChipButton
            key={chip.id}
            chip={chip}
            active={selectedChipIds.includes(chip.id)}
            onToggle={onChipToggle}
          />
        ))}
        {showMoreChips && extraChips.map((chip) => (
          <ChipButton
            key={chip.id}
            chip={chip}
            active={selectedChipIds.includes(chip.id)}
            onToggle={onChipToggle}
          />
        ))}
        {!showMoreChips && extraChips.length > 0 && (
          <button
            type="button"
            className="dl-chip dl-chip--more"
            onClick={() => setShowMoreChips(true)}
          >
            Mehr
          </button>
        )}
      </div>
    </section>
  );
}
