import './dealer-landing.css';

/**
 * Fakten-Antwort aus dem Kia-Fahrzeug-Lexikon (keine KI-Schätzung).
 */
export default function DealerLexiconPanel({
  answer,
  query = '',
  compact = false,
  className = '',
}) {
  if (!answer) return null;

  const rootClass = `dl-lexicon${compact ? ' dl-lexicon--compact' : ''}${className ? ` ${className}` : ''}`;

  if (answer.kind === 'data_gap') {
    return (
      <section className={rootClass} aria-labelledby="dl-lexicon-heading">
        <header className="dl-lexicon__head">
          <span className="dl-lexicon__badge" aria-hidden>📖</span>
          <div>
            <h2 id="dl-lexicon-heading" className="dl-lexicon__title">Fahrzeug-Lexikon</h2>
            {query && <p className="dl-lexicon__query">„{query}"</p>}
          </div>
        </header>
        <p className="dl-lexicon__headline">{answer.headline}</p>
        <p className="dl-lexicon__text">{answer.explanation}</p>
        {answer.suggestion && (
          <p className="dl-lexicon__tip">
            <strong>Tipp:</strong>
            {' '}
            {answer.suggestion}
          </p>
        )}
        {answer.topByVolume?.length > 0 && (
          <div className="dl-lexicon__list-wrap">
            <p className="dl-lexicon__list-label">Größte Kofferräume im Kia-Sortiment:</p>
            <ul className="dl-lexicon__list">
              {answer.topByVolume.map((item) => (
                <li key={item.modelKey} className="dl-lexicon__item">
                  <span className="dl-lexicon__model">{item.label}</span>
                  <span className="dl-lexicon__facts">{item.detail}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    );
  }

  if (!answer.matches?.length) return null;

  const isRanking = answer.kind === 'ranking';

  return (
    <section className={rootClass} aria-labelledby="dl-lexicon-heading">
      <header className="dl-lexicon__head">
        <span className="dl-lexicon__badge" aria-hidden>📖</span>
        <div>
          <h2 id="dl-lexicon-heading" className="dl-lexicon__title">Fahrzeug-Lexikon</h2>
          {query && <p className="dl-lexicon__query">„{query}"</p>}
        </div>
      </header>
      {answer.queryInterpretation && (
        <p className="dl-lexicon__criteria">{answer.queryInterpretation}</p>
      )}
      <p className="dl-lexicon__headline">{answer.headline}</p>
      <ul className="dl-lexicon__list">
        {answer.matches.map((item) => (
          <li key={item.modelKey} className="dl-lexicon__item">
            {isRanking && item.rank != null && (
              <span className="dl-lexicon__rank">{item.rank}.</span>
            )}
            <span className="dl-lexicon__model">{item.label}</span>
            {item.factLine && (
              <span className="dl-lexicon__facts">{item.factLine}</span>
            )}
          </li>
        ))}
      </ul>
      <p className="dl-lexicon__source">
        Quelle: Kia-Stammdaten & Preislisten · {answer.lexiconSize ?? '–'} Modelllinien
      </p>
    </section>
  );
}
