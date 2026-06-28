import {
  buildCleverAuswahlDetailModel,
  CUSTOMER_LINK_BUTTON_LABEL,
  variantConditionChipsDifferFromWish,
} from '../../services/sales/offerSelectionGroup.js';
import { VARIANT_OFFER_BUTTON_LABEL } from '../../services/sales/selectionVariantOffer.js';
import ConditionChipRow from './ConditionChipRow.jsx';
import './CustomerAkte.css';

export default function CustomerAkteCleverAuswahlSheet({
  group,
  onEditVariant,
  onOpenVariantOffer,
  onPrepareCustomerLink,
}) {
  const detail = buildCleverAuswahlDetailModel(group);
  if (!detail) return null;

  return (
    <div className="cust-akte-auswahl">
      <div className="cust-akte-auswahl__variants">
        {detail.variants.map((variant) => {
          const rawVariant = group?.variants?.find((v) => v.id === variant.id);
          const differs = rawVariant
            ? variantConditionChipsDifferFromWish(group, rawVariant)
            : false;

          return (
            <article key={variant.id} className="cust-akte-auswahl__variant">
              <p className="cust-akte-auswahl__variant-trim">
                {variant?.trimLabel ?? 'Ausstattung'}
              </p>
              {variant.priceLine && (
                <p className="cust-akte-auswahl__variant-price">{variant.priceLine}</p>
              )}
              {differs && variant.conditionChips?.length > 0 && (
                <ConditionChipRow chips={variant.conditionChips} />
              )}
              {variant.hasOfferPdf && (
                <p className="cust-akte-auswahl__variant-pdf">
                  PDF:
                  {' '}
                  {variant.offerPdfFileName}
                </p>
              )}
              <div className="cust-akte-auswahl__variant-actions">
                <button
                  type="button"
                  className="cust-akte-auswahl__variant-edit"
                  onClick={() => onEditVariant?.(group, variant)}
                >
                  {variant.editButtonLabel}
                </button>
                <button
                  type="button"
                  className="cust-akte-auswahl__variant-offer"
                  onClick={() => onOpenVariantOffer?.(group, variant)}
                >
                  {variant.offerButtonLabel ?? VARIANT_OFFER_BUTTON_LABEL}
                </button>
              </div>
            </article>
          );
        })}
      </div>

      <button
        type="button"
        className="cust-akte-auswahl__link-btn"
        onClick={() => onPrepareCustomerLink?.()}
      >
        {CUSTOMER_LINK_BUTTON_LABEL}
      </button>
    </div>
  );
}
