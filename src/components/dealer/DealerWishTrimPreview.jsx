import CleverQuoteBadge from '../cleverQuote/CleverQuoteBadge.jsx';
import './dealer-landing.css';

/**
 * Live-Vorschau: sobald Wünsche gewählt sind, Ausstattung empfehlen.
 */
export default function DealerWishTrimPreview({ recommendation }) {
  if (!recommendation?.primary) return null;

  const { vehicleTitle, vehicleShortLabel, primary, alternatives = [] } = recommendation;
  const quote = primary.cleverQuotePercent != null
    ? { percent: primary.cleverQuotePercent, matched: null, scorableTotal: null }
    : null;

  return (
    <aside className="dl-wish-preview" aria-live="polite">
      <p className="dl-wish-preview__kicker">Clever empfiehlt automatisch</p>
      <h3 className="dl-wish-preview__vehicle">{vehicleTitle}</h3>

      <div className="dl-wish-preview__trim">
        <p className="dl-wish-preview__trim-label">Empfohlene Ausstattung</p>
        <p className="dl-wish-preview__trim-name">
          <span aria-hidden>🥇</span>
          {' '}
          {primary.trimLabel}
        </p>
        {quote && (
          <CleverQuoteBadge cleverQuote={quote} size="md" showTier={false} />
        )}
      </div>

      <p className="dl-wish-preview__why-label">Warum?</p>
      <ul className="dl-wish-preview__reasons">
        {(primary.includedLines ?? primary.reasons ?? []).map((line) => (
          <li key={line}>
            <span aria-hidden>✅</span>
            {' '}
            {line}
          </li>
        ))}
        {primary.valueNote && !primary.includedLines?.includes(primary.valueNote) && (
          <li>
            <span aria-hidden>✅</span>
            {' '}
            {primary.valueNote}
          </li>
        )}
      </ul>

      <p className="dl-wish-preview__lead">
        Beim
        {' '}
        {vehicleShortLabel}
        {' '}
        passt die
        {' '}
        <strong>{primary.trimLabel}</strong>
        -Ausstattung am besten zu Ihren Wünschen.
      </p>

      {alternatives.length > 0 && (
        <div className="dl-wish-preview__alt">
          <p className="dl-wish-preview__alt-label">Weitere Möglichkeiten</p>
          <ul className="dl-wish-preview__alt-list">
            {alternatives.map((alt) => (
              <li key={alt.trimId}>
                <strong>{alt.trimLabel}</strong>
                {alt.tagline && (
                  <span>
                    {' '}
                    –
                    {' '}
                    {alt.tagline}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  );
}
