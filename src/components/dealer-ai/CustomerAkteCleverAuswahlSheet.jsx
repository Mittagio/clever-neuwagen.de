import {
  buildCleverAuswahlDetailModel,
  CUSTOMER_LINK_BUTTON_LABEL,
  formatSelectionGroupStatus,
} from '../../services/sales/offerSelectionGroup.js';
import './CustomerAkte.css';

export default function CustomerAkteCleverAuswahlSheet({
  group,
  onEditVariant,
  onPrepareCustomerLink,
}) {
  const detail = buildCleverAuswahlDetailModel(group);
  if (!detail) return null;

  const status = formatSelectionGroupStatus(group);

  return (
    <div className="cust-akte-auswahl">
      <header className="cust-akte-auswahl__head">
        <p className="cust-akte-auswahl__eyebrow">{detail.title}</p>
        <h3 className="cust-akte-auswahl__model">{detail.modelLabel}</h3>
        {detail.wishConditionsLine && (
          <p className="cust-akte-auswahl__wish">
            Wunschkonditionen:
            {' '}
            {detail.wishConditionsLine}
          </p>
        )}
        <p className={`cust-akte-auswahl__status cust-akte-auswahl__status--${status.tone}`}>
          Status:
          {' '}
          {status.label}
        </p>
      </header>

      <div className="cust-akte-auswahl__variants">
        <p className="cust-akte-auswahl__variants-title">Varianten</p>
        {detail.variants.map((variant) => (
          <article key={variant.id} className="cust-akte-auswahl__variant">
            <div className="cust-akte-auswahl__variant-head">
              <span className="cust-akte-auswahl__variant-num">{variant.index}.</span>
              <div>
                <p className="cust-akte-auswahl__variant-trim">{variant.trimLabel}</p>
                <p className="cust-akte-auswahl__variant-label">{variant.label}</p>
              </div>
            </div>
            {variant.priceLine && (
              <p className="cust-akte-auswahl__variant-price">{variant.priceLine}</p>
            )}
            <p className="cust-akte-auswahl__variant-desc">{variant.shortDescription}</p>
            <button
              type="button"
              className="cust-akte-auswahl__variant-edit"
              onClick={() => onEditVariant?.(group, variant)}
            >
              {variant.editButtonLabel}
            </button>
          </article>
        ))}
      </div>

      <button
        type="button"
        className="cust-akte-auswahl__link-btn"
        onClick={() => onPrepareCustomerLink?.(group)}
      >
        {CUSTOMER_LINK_BUTTON_LABEL}
      </button>
    </div>
  );
}
