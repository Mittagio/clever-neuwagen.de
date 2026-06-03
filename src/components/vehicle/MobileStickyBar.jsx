import { CUSTOMER_LABELS } from '../../data/customerFlow.js';
import '../vehicle-detail/vehicle-detail.css';

export default function MobileStickyBar({
  price,
  visible = true,
  onStartInquiry,
  onSaveOffer,
}) {
  if (!visible) return null;

  return (
    <div className="vd-mobile-bar" role="region" aria-label="Schnellaktionen">
      <div className="vd-mobile-bar__price">
        <span className="vd-mobile-bar__rate">{price?.label}</span>
        <span className="vd-mobile-bar__sub">{price?.subtitle}</span>
      </div>
      <div className="vd-mobile-bar__actions">
        <button type="button" className="vd-btn vd-btn--outline vd-btn--sm" onClick={onSaveOffer}>
          Merken
        </button>
        <button type="button" className="vd-btn vd-btn--primary vd-btn--sm" onClick={onStartInquiry}>
          {CUSTOMER_LABELS.startInquiry}
        </button>
      </div>
    </div>
  );
}
