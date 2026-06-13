import {
  buildCleverQuoteSubline,
  buildCleverQuoteWishLines,
} from '../../services/dealer/dealerAdvisorPresentation.js';
import './dealer-landing.css';

export default function DealerAdvisorCleverQuote({
  cleverQuote,
  checks = [],
  wishLines = [],
  variant = 'default',
}) {
  const percent = cleverQuote?.percent;
  if (percent == null && !checks.length && !wishLines.length) return null;

  const score = percent ?? 0;
  const subline = buildCleverQuoteSubline(cleverQuote, checks);
  const fulfilledLines = buildCleverQuoteWishLines(cleverQuote, checks, wishLines);
  const perfect = score >= 100;
  const isHero = variant === 'hero';
  const isCompact = variant === 'compact';

  return (
    <div
      className={`dl-advisor-cq${perfect ? ' dl-advisor-cq--perfect' : ''}${isHero ? ' dl-advisor-cq--hero' : ''}${isCompact ? ' dl-advisor-cq--compact' : ''}`}
      aria-label={`CleverQuote ${score}`}
    >
      <p className="dl-advisor-cq__brand-line">
        <span className="dl-advisor-cq__trophy" aria-hidden>🏆</span>
        {' '}
        <span className="dl-advisor-cq__brand-name">CleverQuote</span>
        {' '}
        <strong className="dl-advisor-cq__score">{score}</strong>
      </p>

      {!isCompact && subline && (
        <p className="dl-advisor-cq__headline">{subline}</p>
      )}

      {!isCompact && fulfilledLines.length > 0 && (
        <ul className="dl-advisor-cq__wishes">
          {fulfilledLines.map((line) => (
            <li key={line} className="dl-advisor-cq__wish">
              <span className="dl-advisor-cq__wish-icon" aria-hidden>✓</span>
              {line}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
