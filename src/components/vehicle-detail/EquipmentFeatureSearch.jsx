import { useCallback, useMemo, useRef, useState } from 'react';
import {
  isSpeechRecognitionSupported,
  mapSpeechRecognitionError,
  startSpeechRecognition,
} from '../../services/sales/conversationVoiceParser.js';
import {
  createReservedSearchItem,
  getSearchedFeatureStatusCopy,
  isSearchItemConfirmed,
  isSearchItemPending,
  isSearchItemUnavailable,
  searchEquipmentFeature,
} from '../../services/configuration/equipmentFeatureSearch.js';
import {
  LEARNING_SOURCE_AREAS,
} from '../../services/admin/cleverLearningRequestService.js';
import CleverLearningRequestCard from '../shared/CleverLearningRequestCard.jsx';

function PickedFeatureItem({ item, onRemove }) {
  const pending = isSearchItemPending(item);
  const unavailable = isSearchItemUnavailable(item);
  const confirmed = isSearchItemConfirmed(item);
  const { statusLine, hint } = getSearchedFeatureStatusCopy(item);

  const markClass = pending
    ? ' vd-eq-search__picked-mark--pending'
    : unavailable
      ? ' vd-eq-search__picked-mark--unavailable'
      : confirmed
        ? ' vd-eq-search__picked-mark--ok'
        : ' vd-eq-search__picked-mark--pending';
  const itemClass = pending
    ? ' vd-eq-search__picked-item--pending'
    : unavailable
      ? ' vd-eq-search__picked-item--unavailable'
      : '';

  return (
    <li className={`vd-eq-search__picked-item${itemClass}`}>
      <span
        className={`vd-eq-search__picked-mark${markClass}`}
        aria-hidden
      >
        {pending ? '?' : unavailable ? '−' : confirmed ? '✓' : '?'}
      </span>
      <div className="vd-eq-search__picked-body">
        <p className="vd-eq-search__picked-name">{item.label}</p>
        <p className="vd-eq-search__picked-status">{statusLine}</p>
        {hint && (
          <p className="vd-eq-search__picked-hint">{hint}</p>
        )}
      </div>
      <button
        type="button"
        className="vd-eq-search__picked-remove"
        onClick={() => onRemove?.(item.id)}
        aria-label={`${item.label} entfernen`}
      >
        ×
      </button>
    </li>
  );
}

export default function EquipmentFeatureSearch({
  brand,
  model,
  modelKey,
  selectedFeatureIds = [],
  searchedFeatures = [],
  onAddSearchedFeature,
  onRemoveSearchedFeature,
}) {
  const [query, setQuery] = useState('');
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [spokenText, setSpokenText] = useState(null);
  const [voiceError, setVoiceError] = useState(null);
  const [searchState, setSearchState] = useState(null);
  const recognitionRef = useRef(null);
  const voiceSupported = isSpeechRecognitionSupported();

  const selectedChipIds = useMemo(
    () => selectedFeatureIds,
    [selectedFeatureIds],
  );

  const searchCtx = useMemo(() => ({
    selectedFeatureIds,
    searchedFeatures,
    selectedChipIds,
  }), [selectedFeatureIds, searchedFeatures, selectedChipIds]);

  const addFeature = useCallback((item) => {
    onAddSearchedFeature?.(item);
    setSearchState(null);
    setQuery('');
    setSpokenText(null);
  }, [onAddSearchedFeature]);

  const runSearch = useCallback((rawQuery, { fromVoice = false } = {}) => {
    const q = rawQuery.trim();
    if (!q) return;
    const result = searchEquipmentFeature(q, brand, model, modelKey, searchCtx);
    setSearchState(result);
    if (fromVoice) setSpokenText(q);
    if (result.type === 'match' && result.item) {
      addFeature(result.item);
    }
  }, [addFeature, brand, model, modelKey, searchCtx]);

  function handleSubmit(event) {
    event?.preventDefault();
    runSearch(query);
  }

  function handlePickSuggestion(item) {
    addFeature(item);
  }

  function handleReserveWish() {
    if (!searchState?.query) return;
    const feature = searchState.feature ?? null;
    addFeature(createReservedSearchItem(searchState.query, feature));
  }

  function startListening() {
    if (!voiceSupported || listening) return;
    setVoiceError(null);
    setInterim('');
    setSearchState(null);
    setListening(true);
    recognitionRef.current = startSpeechRecognition({
      onResult: ({ finalText, interimText }) => {
        if (interimText) setInterim(interimText);
        if (finalText) {
          setQuery(finalText);
          setInterim('');
          runSearch(finalText, { fromVoice: true });
        }
      },
      onError: (msg) => {
        setVoiceError(typeof msg === 'string' ? msg : mapSpeechRecognitionError('unknown'));
        setListening(false);
      },
      onEnd: () => setListening(false),
    });
  }

  function stopListening() {
    recognitionRef.current?.stop?.();
    setListening(false);
  }

  return (
    <div className="vd-eq-search vd-eq-search--compact">
      <p className="vd-eq-search__kicker">Nicht dabei?</p>
      <p className="vd-eq-search__subline">
        Suchen oder sprechen Sie Ihre Wunschausstattung.
      </p>

      <form className="vd-eq-search__form" onSubmit={handleSubmit}>
        <div className={`vd-eq-search__field${listening ? ' vd-eq-search__field--listening' : ''}`}>
          <span className="vd-eq-search__field-icon" aria-hidden>🔍</span>
          <input
            type="search"
            className="vd-eq-search__input"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSearchState(null);
            }}
            placeholder='z. B. „Beifahrersitz elektrisch?“ oder „Sitzheizung hinten?“'
            aria-label="Ausstattung suchen oder sprechen"
            enterKeyHint="search"
          />
          {voiceSupported && (
            <button
              type="button"
              className={`vd-eq-search__mic${listening ? ' vd-eq-search__mic--active' : ''}`}
              onClick={listening ? stopListening : startListening}
              aria-label={listening ? 'Aufnahme beenden' : 'Spracheingabe starten'}
              aria-pressed={listening}
            >
              <span className="vd-eq-search__mic-icon" aria-hidden>🎙</span>
            </button>
          )}
        </div>
      </form>

      {listening && (
        <p className="vd-eq-search__listening" role="status">Ich höre zu…</p>
      )}
      {interim && listening && (
        <p className="vd-eq-search__interim">{interim}</p>
      )}
      {spokenText && !listening && (
        <p className="vd-eq-search__recognized">
          Erkannt: „{spokenText}“
        </p>
      )}
      {voiceError && (
        <p className="vd-eq-search__error" role="alert">{voiceError}</p>
      )}

      {searchState?.type === 'duplicate' && (
        <p className="vd-eq-search__hint">{searchState.message}</p>
      )}

      {searchState?.type === 'ambiguous' && (
        <div className="vd-eq-search__suggestions" role="region" aria-label="Suchvorschläge">
          <p className="vd-eq-search__suggestions-title">{searchState.message}</p>
          <div className="vd-eq-search__suggestions-list">
            {searchState.suggestions?.map((item) => (
              <button
                key={`${item.catalogId}-${item.label}`}
                type="button"
                className="vd-eq-search__suggestion"
                onClick={() => handlePickSuggestion(item)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {searchState?.type === 'not_found' && (
        <div className="vd-eq-search__not-found">
          <CleverLearningRequestCard
            query={searchState.query}
            modelKey={modelKey}
            modelLabel={`${brand} ${model}`}
            sourceArea={LEARNING_SOURCE_AREAS.CUSTOMER_EQUIPMENT_SEARCH}
            pageContext="Ausstattungssuche"
            detectedFeatureId={searchState.feature?.id ?? null}
          />
          <button
            type="button"
            className="vd-eq-search__reserve-btn"
            onClick={handleReserveWish}
          >
            Wunsch vormerken
          </button>
        </div>
      )}

      {searchState?.type === 'unconfirmed' && (
        <div className="vd-eq-search__not-found">
          <CleverLearningRequestCard
            query={searchState.query}
            modelKey={modelKey}
            modelLabel={`${brand} ${model}`}
            sourceArea={LEARNING_SOURCE_AREAS.CUSTOMER_EQUIPMENT_SEARCH}
            pageContext="Ausstattungssuche"
            detectedFeatureId={searchState.feature?.id ?? null}
          />
          <button
            type="button"
            className="vd-eq-search__reserve-btn"
            onClick={handleReserveWish}
          >
            Wunsch vormerken
          </button>
        </div>
      )}

      {searchedFeatures.length > 0 && (
        <div className="vd-eq-search__picked">
          <p className="vd-eq-search__picked-label">Gesuchte Ausstattung</p>
          <ul className="vd-eq-search__picked-list">
            {searchedFeatures.map((item) => (
              <PickedFeatureItem
                key={item.id}
                item={item}
                onRemove={onRemoveSearchedFeature}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
