import {
  CUSTOMER_SEARCH_COPY,
  buildCustomerFitLines,
} from '../../services/dealer/customerSearchResultPresentation.js';
import './dealer-landing.css';

/**
 * Ruhige Kunden-Einschätzung statt CleverQuote-Score-Box.
 */
export default function CustomerSearchAssessment({
  cleverQuote,
  checks = [],
  wishLines = [],
}) {
  const lines = buildCustomerFitLines(cleverQuote, checks, wishLines);

  return (
    <div className="dl-customer-fit" aria-label="Clever Einschätzung">
      <p className="dl-customer-fit__title">{CUSTOMER_SEARCH_COPY.assessmentTitle}</p>
      <p className="dl-customer-fit__verdict">{CUSTOMER_SEARCH_COPY.assessmentVerdict}</p>

      {lines.length > 0 && (
        <>
          <p className="dl-customer-fit__matches-label">{CUSTOMER_SEARCH_COPY.matchesLabel}</p>
          <ul className="dl-customer-fit__matches">
            {lines.map((line) => (
              <li key={line} className="dl-customer-fit__match">
                <span aria-hidden>✓</span>
                {line}
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="dl-customer-fit__hint">{CUSTOMER_SEARCH_COPY.disclaimer}</p>
    </div>
  );
}
