import {
  buildCleverAuswahlDetailModel,
  variantConditionChipsDifferFromWish,
} from '../../services/sales/offerSelectionGroup.js';
import ConditionChipRow from './ConditionChipRow.jsx';
import './OfferVariantConfigurator.css';

export default function CustomerAkteCleverAuswahlSheet({
  group,
  onBack,
  onEditVariant,
  onOpenVariantOffer,
  onPrepareCustomerLink,
  onDuplicateVariant,
  onGroupActionReview,
}) {
  const detail = buildCleverAuswahlDetailModel(group);
  if (!detail) return null;

  const footerAction = detail.groupFooterAction;
  const preparedCount = detail.variants.filter(
    (variant) => variant.statusTone === 'ready' || variant.statusTone === 'sent',
  ).length;

  function handleGroupAction() {
    if (footerAction.disabled) return;
    if (footerAction.action === 'review') {
      onGroupActionReview?.(group);
      return;
    }
    onPrepareCustomerLink?.();
  }

  return (
    <div className="ovc ovc--overview" role="dialog" aria-label={detail.modelLabel}>
      <div className="ovc__scroll">
        <header className="ovc__header">
          <button type="button" className="ovc__back" onClick={onBack}>
            ← Zur Kundenakte
          </button>
          <h1 className="ovc__title">{detail.modelLabel}</h1>
          <p className="ovc__subtitle">Clever Auswahl</p>
          <div className="ovc__wish-strip">
            <ConditionChipRow label="Kundenwunsch" chips={detail.wishConditionChips} />
          </div>
        </header>

        <section className="ovc__section ovc__section--variants" aria-label="Varianten">
          {detail.variants.map((variant) => {
            const rawVariant = group?.variants?.find((entry) => entry.id === variant.id);
            const differs = rawVariant
              ? variantConditionChipsDifferFromWish(group, rawVariant)
              : false;

            return (
              <article key={variant.id} className="ovc__variant-card">
                <div className="ovc__variant-card-head">
                  <h2 className="ovc__variant-card-title">{variant.trimLabel ?? 'Ausstattung'}</h2>
                  <span className={`ovc__variant-status ovc__variant-status--${variant.statusTone}`}>
                    {variant.statusLabel}
                  </span>
                </div>

                {variant.priceLine && (
                  <p className="ovc__variant-rate">{variant.priceLine}</p>
                )}

                {variant.metaLines?.length > 0 && (
                  <ul className="ovc__variant-meta">
                    {variant.metaLines.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                )}

                {differs && variant.conditionChips?.length > 0 && (
                  <ConditionChipRow chips={variant.conditionChips} />
                )}

                {variant.hasOfferPdf && variant.offerPdfFileName && (
                  <p className="ovc__variant-pdf-note">
                    PDF:
                    {' '}
                    {variant.offerPdfFileName}
                  </p>
                )}

                <button
                  type="button"
                  className="ovc__btn ovc__btn-primary ovc__btn--variant-main"
                  onClick={() => onEditVariant?.(group, variant)}
                >
                  {variant.editButtonLabel}
                </button>

                <div className="ovc__variant-secondary">
                  <button
                    type="button"
                    className="ovc__text-btn"
                    onClick={() => onOpenVariantOffer?.(group, variant)}
                  >
                    {variant.offerButtonLabel}
                  </button>
                  {!variant.hasOfferPdf && (
                    <button
                      type="button"
                      className="ovc__text-btn"
                      onClick={() => onOpenVariantOffer?.(group, variant)}
                    >
                      {variant.uploadPdfButtonLabel}
                    </button>
                  )}
                  <button
                    type="button"
                    className="ovc__text-btn"
                    onClick={() => onDuplicateVariant?.(group, variant)}
                  >
                    Duplizieren
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      </div>

      <footer className="ovc__footer ovc__footer--overview">
        <p className="ovc__overview-summary">
          {detail.variants.length}
          {' '}
          Varianten
          {preparedCount > 0 && (
            <>
              {' '}
              ·
              {' '}
              {preparedCount}
              {' '}
              vorbereitet
            </>
          )}
        </p>
        <button
          type="button"
          className="ovc__btn ovc__btn-primary ovc__btn--footer-save"
          onClick={handleGroupAction}
          disabled={footerAction.disabled}
        >
          {footerAction.label}
        </button>
      </footer>
    </div>
  );
}
