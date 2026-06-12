import { buildDealerFulfillmentHeadline } from '../../services/dealer/dealerAdvisorPresentation.js';
import './dealer-landing.css';

export default function DealerAdvisorCleverQuote({ cleverQuote, checks = [] }) {
  if (cleverQuote?.percent == null && !checks.length) return null;

  const percent = cleverQuote?.percent ?? 0;
  const headline = buildDealerFulfillmentHeadline(cleverQuote, checks);
  const perfect = percent >= 100;

  return (
    <div className={`dl-advisor-cq${perfect ? ' dl-advisor-cq--perfect' : ''}`} aria-label="CleverQuote Passung">
      <p className="dl-advisor-cq__score">
        <span className="dl-advisor-cq__dot" aria-hidden>🟢</span>
        {percent}
        {' '}
        % passend
      </p>
      {headline && (
        <p className="dl-advisor-cq__headline">{headline}</p>
      )}
      <p className="dl-advisor-cq__brand">CleverQuote</p>
    </div>
  );
}
