import DealerAdvisorCleverQuote from './DealerAdvisorCleverQuote.jsx';
import './dealer-landing.css';

/**
 * Phase 3 – Clever empfiehlt Ausstattung (nicht Trim-Katalog).
 */
export default function DealerCleverTrimRecommendation({
  vehicleTitle,
  trimLabel,
  matchPercent,
  wishChipLines,
}) {
  if (!trimLabel) return null;

  const fulfilled = wishChipLines?.fulfilled ?? [];
  const missing = wishChipLines?.missing ?? [];
  const cleverQuote = matchPercent != null
    ? {
      percent: matchPercent,
      matched: fulfilled.length,
      scorableTotal: fulfilled.length + missing.length || fulfilled.length,
    }
    : null;

  return (
    <section className="dl-clever-trim-rec" aria-labelledby="dl-clever-trim-rec-title">
      <p className="dl-clever-trim-rec__kicker">
        <span aria-hidden>🏆</span>
        {' '}
        Clever empfiehlt:
      </p>
      <h2 id="dl-clever-trim-rec-title" className="dl-clever-trim-rec__title">
        {vehicleTitle}
        {' '}
        {trimLabel}
      </h2>

      {matchPercent != null && (
        <DealerAdvisorCleverQuote
          cleverQuote={cleverQuote}
          wishLines={fulfilled}
          variant="default"
        />
      )}

      {missing.length > 0 && (
        <ul className="dl-clever-trim-rec__checks">
          {missing.map((label) => (
            <li key={`miss-${label}`} className="dl-clever-trim-rec__check dl-clever-trim-rec__check--miss">
              <span aria-hidden>✗</span>
              {' '}
              {label}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
