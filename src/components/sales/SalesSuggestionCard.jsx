import { formatPrice } from '../../data/kiaSportage.js';

function formatRate(value) {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value ?? 0);
}

function formatHauspreis(value) {
  if (!value) return '–';
  return formatPrice(value);
}

export default function SalesSuggestionCard({
  suggestion,
  inCompare,
  expanded,
  onCreateOffer,
  onToggleCompare,
  onToggleDetails,
}) {
  const isUnder = suggestion.signedDiff <= 0;

  return (
    <article className={`sales-suggestion-card${expanded ? ' is-expanded' : ''}`}>
      <div className="sales-suggestion-card__head">
        <span className="sales-suggestion-card__rank">#{suggestion.rank}</span>
        <div className="sales-suggestion-card__titles">
          <h3 className="sales-suggestion-card__vehicle">
            {suggestion.brand} {suggestion.label}
          </h3>
          <p className="sales-suggestion-card__trim">{suggestion.variant}</p>
        </div>
        <p className="sales-suggestion-card__rate">{formatRate(suggestion.monthlyRate)}</p>
      </div>

      <dl className="sales-suggestion-card__facts">
        <div>
          <dt>Hauspreis</dt>
          <dd>{formatHauspreis(suggestion.hauspreis)}</dd>
        </div>
        <div>
          <dt>Lieferzeit</dt>
          <dd>{suggestion.deliveryTime}</dd>
        </div>
      </dl>

      <div className="sales-suggestion-card__reason">
        <p className="sales-suggestion-card__reason-label">Warum empfohlen?</p>
        <p className="sales-suggestion-card__reason-text">{suggestion.recommendReason}</p>
      </div>

      <p className={`sales-suggestion-card__deviation${isUnder ? ' is-under' : ''}`}>
        {suggestion.rateDeviationLabel}
      </p>

      {expanded && suggestion.highlights?.length > 0 && (
        <ul className="sales-suggestion-card__highlights">
          {suggestion.highlights.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}

      <div className="sales-suggestion-card__actions">
        <button
          type="button"
          className="sales-suggestion-btn sales-suggestion-btn--primary"
          onClick={() => onCreateOffer(suggestion)}
        >
          Angebot erstellen
        </button>
        <button
          type="button"
          className={`sales-suggestion-btn sales-suggestion-btn--compare${inCompare ? ' is-active' : ''}`}
          onClick={() => onToggleCompare(suggestion.id)}
        >
          {inCompare ? '✓ Im Vergleich' : 'Zum Vergleich'}
        </button>
        <button
          type="button"
          className="sales-suggestion-btn sales-suggestion-btn--ghost"
          onClick={() => onToggleDetails(suggestion.id)}
        >
          {expanded ? 'Weniger' : 'Details'}
        </button>
      </div>
    </article>
  );
}
