import { CUSTOMER_ADVISOR_COPY } from '../../services/dealer/customerAdvisorPresentation.js';
import '../vehicle-detail/vehicle-detail.css';

/**
 * Abschlusskarte nach Clever Einschätzung – unverbindlich, Verkäufer als Ansprechpartner.
 */
export default function CustomerAdvisorCompletionCard({
  directionLabel,
  onContactRequest,
  onEdit,
}) {
  return (
    <article className="vd-customer-advisor-complete" aria-label="Beratungsabschluss">
      <h3 className="vd-customer-advisor-complete__title">
        {CUSTOMER_ADVISOR_COPY.completionHeadline}
      </h3>
      {directionLabel && (
        <p className="vd-customer-advisor-complete__direction">
          {directionLabel.includes(' oder ')
            ? `${directionLabel} könnten passen.`
            : `${directionLabel} könnte passen.`}
        </p>
      )}
      <p className="vd-customer-advisor-complete__text">
        {CUSTOMER_ADVISOR_COPY.completionText}
      </p>
      <p className="vd-customer-advisor-complete__hint">
        {CUSTOMER_ADVISOR_COPY.completionHint}
      </p>
      <div className="vd-customer-advisor-complete__actions">
        <button
          type="button"
          className="vd-btn vd-btn--primary vd-btn--block"
          onClick={onContactRequest}
        >
          {CUSTOMER_ADVISOR_COPY.contactCta}
        </button>
        <button
          type="button"
          className="vd-btn vd-btn--secondary vd-btn--block"
          onClick={onEdit}
        >
          {CUSTOMER_ADVISOR_COPY.editCta}
        </button>
      </div>
    </article>
  );
}
