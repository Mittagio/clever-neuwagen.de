import { useState } from 'react';
import {
  LEXICON_EXAMPLE_CHIPS,
  searchCleverLexicon,
  buildLexiconAkteChip,
} from '../../services/lexicon/cleverLexiconSearchService.js';
import { fetchLexikonQuery } from '../../services/lexicon/lexikonQueryApi.js';
import {
  LEARNING_SOURCE_AREAS,
  lexiconNeedsLearningFeedback,
} from '../../services/admin/cleverLearningRequestService.js';
import CleverLearningRequestCard from '../shared/CleverLearningRequestCard.jsx';
import './CleverLexikon.css';

export default function CleverLexikon({
  className = '',
  subline = 'Fahrzeugwissen in Sekunden. Technische Daten, Ausstattung und Paketverfügbarkeit – aus Konfigurator- und Importdaten.',
  placeholder = 'z. B. EV4 Wärmepumpe, Sportage Anhängelast, EV3 V2L …',
  showChips = true,
  onAdoptToAkte = null,
}) {
  const [query, setQuery] = useState('');
  const [searchState, setSearchState] = useState(null);
  const [showRelated, setShowRelated] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  async function runSearch(text) {
    const q = text.trim();
    if (!q) return;
    setQuery(q);
    setShowRelated(false);
    setIsSearching(true);

    try {
      const response = await fetchLexikonQuery({ query: q });
      setSearchState(response.searchState ?? searchCleverLexicon(q));
    } catch {
      setSearchState(searchCleverLexicon(q));
    } finally {
      setIsSearching(false);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    runSearch(query);
  }

  function handleChip(chip) {
    runSearch(chip.query);
  }

  const result = searchState?.result;
  const showLearning = searchState && lexiconNeedsLearningFeedback(searchState);
  const adoptChip = searchState?.ok && onAdoptToAkte ? buildLexiconAkteChip(searchState) : null;

  function handleAdopt() {
    if (!onAdoptToAkte || !searchState) return;
    onAdoptToAkte(searchState);
  }

  return (
    <section className={`backend-home__lexikon${className ? ` ${className}` : ''}`} aria-labelledby="lexikon-heading">
      <div className="backend-home__lexikon-head">
        <h3 id="lexikon-heading" className="backend-home__section-title">
          Clever-Lexikon
        </h3>
        {subline && (
          <p className="backend-home__lexikon-subline">
            {subline}
          </p>
        )}
      </div>

      <form className="backend-home__lexikon-search" onSubmit={handleSubmit}>
        <label className="backend-home__lexikon-field" htmlFor="clever-lexikon-query">
          <span className="backend-home__lexikon-field-icon" aria-hidden="true">✨</span>
          <input
            id="clever-lexikon-query"
            type="search"
            className="backend-home__lexikon-input"
            placeholder={placeholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
          />
        </label>
        <button type="submit" className="backend-home__lexikon-submit" disabled={isSearching}>
          {isSearching ? 'Suche …' : 'Nachschlagen'}
        </button>
      </form>

      {showChips && (
        <div className="backend-home__lexikon-chips" role="list" aria-label="Beispiel-Fragen">
          {LEXICON_EXAMPLE_CHIPS.map((chip) => (
            <button
              key={chip.id}
              type="button"
              className="backend-home__lexikon-chip"
              onClick={() => handleChip(chip)}
            >
              {chip.label}
            </button>
          ))}
        </div>
      )}

      <div className="backend-home__lexikon-result" aria-live="polite">
        {!searchState && (
          <p className="backend-home__lexikon-empty">
            Fragen Sie nach Modell, Ausstattung oder technischen Daten.
          </p>
        )}

        {searchState && !searchState.ok && (
          <div className="backend-home__lexikon-card backend-home__lexikon-card--soft">
            <p className="backend-home__lexikon-question">{searchState.question}</p>
            {searchState.error && (
              <p className="backend-home__lexikon-soft-hint">{searchState.error}</p>
            )}
            {result?.suggestions?.length > 0 && (
              <ul className="backend-home__lexikon-suggestions">
                {result.suggestions.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            )}
            {showLearning && (
              <CleverLearningRequestCard
                query={searchState.question}
                modelKey={result?.modelKey ?? null}
                modelLabel={result?.title ?? result?.modelTitle ?? null}
                sourceArea={LEARNING_SOURCE_AREAS.LEXICON}
                pageContext="Clever-Lexikon"
                detectedIntent={result?.intentType ?? null}
                detectedFeatureId={result?.featureId ?? null}
              />
            )}
          </div>
        )}

        {searchState?.ok && result && (
          <article className={`backend-home__lexikon-card${result.needsReview ? ' backend-home__lexikon-card--review' : ''}`}>
            <p className="backend-home__lexikon-question">{searchState.question}</p>
            <h4 className="backend-home__lexikon-model">{result.title ?? result.modelTitle}</h4>
            <p className="backend-home__lexikon-field-label">{result.fieldLabel}</p>

            {result.statusLabel && (
              <p className={`backend-home__lexikon-status backend-home__lexikon-status--${result.needsReview ? 'review' : 'verified'}`}>
                {result.statusLabel}
              </p>
            )}

            {result.needsReview ? (
              <div className="backend-home__lexikon-review">
                <p className="backend-home__lexikon-review-title">Datenprüfung nötig</p>
                <p className="backend-home__lexikon-review-text">
                  {result.shortAnswer || 'Für diese Version liegt Clever aktuell kein geprüfter Wert vor. Bitte Datenquelle ergänzen oder Preislisten-Import prüfen.'}
                </p>
                {result.reviewHints?.length > 0 && (
                  <ul className="backend-home__lexikon-review-hints">
                    {result.reviewHints.map((hint) => (
                      <li key={hint}>{hint}</li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <>
                {result.primaryFacts?.map((fact) => (
                  <p key={fact.label} className="backend-home__lexikon-primary">
                    <span className="backend-home__lexikon-primary-label">{fact.label}</span>
                    <strong className="backend-home__lexikon-primary-value">{fact.value}</strong>
                  </p>
                ))}

                {!result.primaryFacts?.length && result.answer && (
                  <p className="backend-home__lexikon-primary-value backend-home__lexikon-primary-value--solo">
                    {result.answer}
                  </p>
                )}
              </>
            )}

            {!result.needsReview && result.shortAnswer && (
              <p className="backend-home__lexikon-short">
                <span className="backend-home__lexikon-short-label">Kurzantwort: </span>
                {result.shortAnswer}
              </p>
            )}

            {result.availabilityByTrim?.length > 0 && (
              <div className="backend-home__lexikon-trims">
                <p className="backend-home__lexikon-trims-title">
                  {result.intentType === 'technical' ? 'Je Motorisierung' : 'Verfügbarkeit je Linie'}
                </p>
                <table className="backend-home__lexikon-trim-table">
                  <tbody>
                    {result.availabilityByTrim.map((row) => (
                      <tr key={`${row.trim}-${row.label}`}>
                        <th scope="row">{row.trim}</th>
                        <td>{row.label}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {result.warnings?.length > 0 && (
              <ul className="backend-home__lexikon-warnings">
                {result.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            )}

            {result.source && (
              <p className="backend-home__lexikon-source">{result.source}</p>
            )}

            {(result.relatedFacts?.length > 0 || result.extras?.length > 0) && (
              <>
                <button
                  type="button"
                  className="backend-home__lexikon-more"
                  onClick={() => setShowRelated((v) => !v)}
                  aria-expanded={showRelated}
                >
                  {showRelated ? 'Weniger anzeigen' : 'Weitere Angaben'}
                </button>
                {showRelated && (
                  <ul className="backend-home__lexikon-extras">
                    {(result.relatedFacts ?? result.extras ?? []).map((row) => (
                      <li key={row.label}>
                        <span>{row.label}</span>
                        <strong>{row.value}</strong>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}

            {showLearning && (
              <CleverLearningRequestCard
                query={searchState.question}
                modelKey={result.modelKey ?? null}
                modelLabel={result.title ?? result.modelTitle ?? null}
                sourceArea={LEARNING_SOURCE_AREAS.LEXICON}
                pageContext="Clever-Lexikon"
                detectedIntent={result.intentType ?? null}
                detectedFeatureId={result.featureId ?? null}
              />
            )}

            {result.needsReview && onAdoptToAkte && (
              <button
                type="button"
                className="backend-home__lexikon-adopt backend-home__lexikon-adopt--secondary"
                onClick={() => onAdoptToAkte({
                  ...searchState,
                  result: {
                    ...result,
                    adoptNote: `${result.fieldLabel}: Prüfung nötig – ${searchState.question}`,
                  },
                })}
              >
                In Kundenakte vormerken
              </button>
            )}

            {adoptChip && (
              <button
                type="button"
                className="backend-home__lexikon-adopt"
                onClick={handleAdopt}
              >
                In Kundenakte übernehmen
              </button>
            )}
          </article>
        )}
      </div>
    </section>
  );
}
