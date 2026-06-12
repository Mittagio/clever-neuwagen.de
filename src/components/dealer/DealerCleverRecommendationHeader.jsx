import './dealer-landing.css';

/**
 * Schritt 1 – Sofort klar: Warum bin ich hier?
 */
export default function DealerCleverRecommendationHeader({ recommendation }) {
  if (!recommendation?.primary) return null;

  const { vehicleTitle, primary, recommendationWhy = [] } = recommendation;
  const whyLines = recommendationWhy.length
    ? recommendationWhy
    : [
      ...(primary.reasons ?? []),
      primary.valueNote,
    ].filter(Boolean);

  return (
    <header className="dl-clever-rec" aria-labelledby="dl-clever-rec-title">
      <p className="dl-clever-rec__kicker">
        <span aria-hidden>🏆</span>
        {' '}
        Clever empfiehlt:
      </p>
      <h2 id="dl-clever-rec-title" className="dl-clever-rec__title">
        {vehicleTitle}
        {' '}
        {primary.trimLabel}
      </h2>

      {whyLines.length > 0 && (
        <div className="dl-clever-rec__why">
          <p className="dl-clever-rec__why-label">Warum?</p>
          <ul className="dl-clever-rec__why-list">
            {whyLines.map((line) => (
              <li key={line}>
                <span aria-hidden>✓</span>
                {' '}
                {line}
              </li>
            ))}
          </ul>
        </div>
      )}
    </header>
  );
}
