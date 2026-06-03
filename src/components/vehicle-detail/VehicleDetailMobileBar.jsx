import { CUSTOMER_LABELS } from '../../data/customerFlow.js';
import './vehicle-detail.css';

export default function VehicleDetailMobileBar({
  pricing,
  onInquiry,
  onSave,
  visible = true,
}) {
  if (!visible) return null;

  return (
    <div className="vd-mobile-bar" role="region" aria-label="Angebot buchen">
      <div className="vd-mobile-bar__start">
        <p className="vd-mobile-bar__price">{pricing.priceLabel}</p>
        {onSave && (
          <button type="button" className="vd-mobile-bar__save" onClick={onSave} aria-label={CUSTOMER_LABELS.saveOffer}>
            <span className="vd-mobile-bar__save-text">Merken</span>
          </button>
        )}
      </div>
      <button type="button" className="vd-btn vd-btn--primary vd-mobile-bar__cta" onClick={onInquiry}>
        {CUSTOMER_LABELS.startInquiry}
      </button>
    </div>
  );
}
