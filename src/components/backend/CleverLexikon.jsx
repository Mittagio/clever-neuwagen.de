import { useState } from 'react';
import {
  LEXICON_EXAMPLE_CHIPS,
  searchCleverLexicon,
} from '../../services/cleverLexicon.js';

export default function CleverLexikon() {
  const [query, setQuery] = useState('');
  const [searchState, setSearchState] = useState(null);
  const [showExtras, setShowExtras] = useState(false);

  function runSearch(text) {
    const q = text.trim();
    if (!q) return;
    setQuery(q);
    setShowExtras(false);
    setSearchState(searchCleverLexicon(q));
  }

  function handleSubmit(e) {
    e.preventDefault();
    runSearch(query);
  }

  function handleChip(chip) {
    runSearch(chip.query);
  }

  return (
    <section className="backend-home__lexikon" aria-labelledby="lexikon-heading">
      <div className="backend-home__lexikon-head">
        <h3 id="lexikon-heading" className="backend-home__section-title">
          Clever-Lexikon
        </h3>
        <p className="backend-home__lexikon-subline">
          Fahrzeugwissen in Sekunden. Technische Daten, Batterie, Kofferraum, Maße und Ausstattung direkt nachschlagen.
        </p>
      </div>

      <form className="backend-home__lexikon-search" onSubmit={handleSubmit}>
        <label className="backend-home__lexikon-field" htmlFor="clever-lexikon-query">
          <span className="backend-home__lexikon-field-icon" aria-hidden="true">✨</span>
          <input
            id="clever-lexikon-query"
            type="search"
            className="backend-home__lexikon-input"
            placeholder="z. B. EV2 Kofferraum, Stonic Länge, EV3 Batterie ..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
          />
        </label>
        <button type="submit" className="backend-home__lexikon-submit">
          Nachschlagen
        </button>
      </form>

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

      <div className="backend-home__lexikon-result" aria-live="polite">
        {!searchState && (
          <p className="backend-home__lexikon-empty">
            Fragen Sie nach Modell, Ausstattung oder technischen Daten.
          </p>
        )}

        {searchState && !searchState.ok && (
          <div className="backend-home__lexikon-card backend-home__lexikon-card--error">
            <p className="backend-home__lexikon-question">{searchState.question}</p>
            <p className="backend-home__lexikon-answer">{searchState.error}</p>
          </div>
        )}

        {searchState?.ok && searchState.result && (
          <article className="backend-home__lexikon-card">
            <p className="backend-home__lexikon-question">{searchState.question}</p>
            <h4 className="backend-home__lexikon-model">{searchState.result.modelTitle}</h4>
            <p className="backend-home__lexikon-field-label">{searchState.result.fieldLabel}</p>
            <p className="backend-home__lexikon-answer">{searchState.result.answer}</p>
            {searchState.result.source && (
              <p className="backend-home__lexikon-source">{searchState.result.source}</p>
            )}
            {(searchState.result.extras?.length ?? 0) > 0 && (
              <>
                <button
                  type="button"
                  className="backend-home__lexikon-more"
                  onClick={() => setShowExtras((v) => !v)}
                  aria-expanded={showExtras}
                >
                  {showExtras ? 'Weniger anzeigen' : 'Weitere Daten anzeigen'}
                </button>
                {showExtras && (
                  <ul className="backend-home__lexikon-extras">
                    {searchState.result.extras.map((row) => (
                      <li key={row.label}>
                        <span>{row.label}</span>
                        <strong>{row.value}</strong>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </article>
        )}
      </div>
    </section>
  );
}
