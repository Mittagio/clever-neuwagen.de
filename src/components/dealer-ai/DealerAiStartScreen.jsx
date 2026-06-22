import { useMemo, useState } from 'react';
import DealerAiInlineMic from './DealerAiInlineMic.jsx';
import {
  getRecentCustomerRecords,
  searchCustomers,
} from '../../services/crm/customerSearchService.js';
import './DealerAiStart.css';

const PLACEHOLDER = 'z. B. SUV, Benziner, Automatik, ca. 250 €, Rückfahrkamera';
const SEARCH_PLACEHOLDER = 'Name, Telefon, E-Mail, Fahrzeug oder CN-Nummer suchen…';

const INPUT_MODES = [
  { id: 'paste', label: 'Einfügen', icon: '📋' },
  { id: 'speak', label: 'Sprechen', icon: '🎤' },
  { id: 'type', label: 'Tippen', icon: '⌨' },
];

function CustomerHitCard({ result, onOpen }) {
  return (
    <button
      type="button"
      className="dai-search-hit"
      onClick={() => onOpen?.(result.leadId)}
    >
      <div className="dai-search-hit__main">
        <p className="dai-search-hit__name">{result.customerName}</p>
        <p className="dai-search-hit__vehicle">{result.vehicleLabel}</p>
        <div className="dai-search-hit__meta">
          <span className="dai-search-hit__status">{result.statusLabel}</span>
          {result.lastActivityLabel && (
            <span className="dai-search-hit__activity">{result.lastActivityLabel}</span>
          )}
        </div>
        {result.warningLabel && (
          <p className="dai-search-hit__warning">{result.warningLabel}</p>
        )}
      </div>
      <span className="dai-search-hit__action">Kundenakte öffnen</span>
    </button>
  );
}

function RecentHitCard({ result, onOpen }) {
  return (
    <button
      type="button"
      className="dai-recent-hit"
      onClick={() => onOpen?.(result.leadId)}
    >
      <p className="dai-recent-hit__name">{result.customerName}</p>
      <p className="dai-recent-hit__vehicle">{result.vehicleLabel}</p>
      <p className="dai-recent-hit__status">{result.statusLabel}</p>
    </button>
  );
}

export default function DealerAiStartScreen({
  text = '',
  onTextChange,
  onVoiceParsed,
  onEvaluate,
  onStartAdvice,
  onStartModel,
  isAnalyzing = false,
  inputRef,
  carryCustomer = null,
  leads = [],
  onOpenCustomerRecord,
  onStartNewWishWithQuery,
}) {
  const [inputMode, setInputMode] = useState('paste');
  const [searchQuery, setSearchQuery] = useState('');
  const canEvaluate = Boolean(text?.trim());

  const searchResults = useMemo(
    () => searchCustomers(searchQuery, leads),
    [searchQuery, leads],
  );

  const recentRecords = useMemo(
    () => getRecentCustomerRecords(leads),
    [leads],
  );

  const showSearchResults = searchQuery.trim().length >= 2;
  const hasSearchResults = searchResults.length > 0;

  function appendTranscript(spoken) {
    onTextChange?.(text?.trim() ? `${text.trim()} ${spoken}` : spoken);
  }

  function handleModeChange(mode) {
    setInputMode(mode);
    if (mode === 'type' || mode === 'paste') {
      inputRef?.current?.focus();
    }
  }

  function handleStartNewWishFromSearch() {
    const q = searchQuery.trim();
    if (!q) return;
    onStartNewWishWithQuery?.(q);
    setSearchQuery('');
  }

  return (
    <section className="dai-start" aria-label="Einstieg Verkaufsassistent">
      {carryCustomer?.contact?.name && (
        <p className="dai-start__carry" role="status">
          <strong>{carryCustomer.contact.name.replace('Kunde (offen)', '').trim()}</strong>
          {' '}wird übernommen – jetzt den neuen Wunsch erfassen.
        </p>
      )}

      <article className="dai-entry dai-entry--search">
        <h2 className="dai-search__title">Kundenakte suchen</h2>
        <label className="dai-search__field-wrap">
          <span className="visually-hidden">Kundenakte suchen</span>
          <input
            type="search"
            className="dai-search__field"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={SEARCH_PLACEHOLDER}
            autoComplete="off"
            enterKeyHint="search"
          />
        </label>

        {showSearchResults && hasSearchResults && (
          <div className="dai-search__results" role="listbox" aria-label="Suchergebnisse">
            {searchResults.map((result) => (
              <CustomerHitCard
                key={result.leadId}
                result={result}
                onOpen={onOpenCustomerRecord}
              />
            ))}
          </div>
        )}

        {showSearchResults && !hasSearchResults && (
          <div className="dai-search__empty">
            <p>Keine Kundenakte gefunden.</p>
            <button
              type="button"
              className="dai-search__new-wish"
              onClick={handleStartNewWishFromSearch}
            >
              Neuen Kundenwunsch mit dieser Eingabe starten
            </button>
          </div>
        )}
      </article>

      {recentRecords.length > 0 && (
        <section className="dai-recent" aria-label="Zuletzt geöffnet">
          <h2 className="dai-recent__title">Zuletzt geöffnet</h2>
          <div className="dai-recent__list">
            {recentRecords.map((result) => (
              <RecentHitCard
                key={result.leadId}
                result={result}
                onOpen={onOpenCustomerRecord}
              />
            ))}
          </div>
        </section>
      )}

      <section className="dai-start__new-wish" aria-label="Neuen Kundenwunsch erfassen">
        <h2 className="dai-start__section-title">Neuen Kundenwunsch erfassen</h2>

        <div className="dai-start__stack">
          <article className="dai-entry dai-entry--hero">
            <div className="dai-entry__head">
              <div className="dai-entry__icon dai-entry__icon--blue" aria-hidden>⚡</div>
              <div className="dai-entry__body">
                <h3 className="dai-entry__title">Clever KI-Check</h3>
                <p className="dai-entry__text">
                  Kundenwunsch eintippen, sprechen oder Nachricht einfügen.
                </p>
              </div>
            </div>

            <div className="dai-mode-tabs" role="tablist" aria-label="Eingabeart">
              {INPUT_MODES.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  role="tab"
                  aria-selected={inputMode === mode.id}
                  className={`dai-mode-tab${inputMode === mode.id ? ' is-active' : ''}`}
                  onClick={() => handleModeChange(mode.id)}
                >
                  <span aria-hidden>{mode.icon}</span>
                  {mode.label}
                </button>
              ))}
            </div>

            <div className="dai-capture">
              <textarea
                id="dai-quick-capture"
                ref={inputRef}
                className="dai-capture__field"
                rows={4}
                value={text}
                onChange={(e) => onTextChange?.(e.target.value)}
                placeholder={PLACEHOLDER}
                disabled={isAnalyzing}
              />
              <DealerAiInlineMic
                variant="fab"
                onTranscript={appendTranscript}
                onParsed={onVoiceParsed}
                disabled={isAnalyzing}
              />
            </div>

            <button
              type="button"
              className="dai-cta dai-cta--primary"
              onClick={onEvaluate}
              disabled={!canEvaluate || isAnalyzing}
            >
              <span className="dai-cta__spark" aria-hidden>✦</span>
              {isAnalyzing ? 'Wird ausgewertet …' : 'Kundenwunsch auswerten'}
            </button>
          </article>

          <button
            type="button"
            className="dai-entry dai-entry--link"
            onClick={onStartAdvice}
            disabled={isAnalyzing}
          >
            <div className="dai-entry__icon dai-entry__icon--green" aria-hidden>💬</div>
            <div className="dai-entry__body">
              <h3 className="dai-entry__title">Clever-Beratung</h3>
              <p className="dai-entry__text">
                Schritt für Schritt zum passenden Fahrzeug – ideal, wenn der Kunde noch offen ist.
              </p>
            </div>
            <span className="dai-entry__chev" aria-hidden>›</span>
          </button>

          <button
            type="button"
            className="dai-entry dai-entry--link"
            onClick={onStartModel}
            disabled={isAnalyzing}
          >
            <div className="dai-entry__icon dai-entry__icon--purple" aria-hidden>🚗</div>
            <div className="dai-entry__body">
              <h3 className="dai-entry__title">Modell wählen</h3>
              <p className="dai-entry__text">
                Kunde weiß schon, was er möchte? Modell auswählen und direkt loslegen.
              </p>
            </div>
            <span className="dai-entry__chev" aria-hidden>›</span>
          </button>
        </div>
      </section>
    </section>
  );
}
