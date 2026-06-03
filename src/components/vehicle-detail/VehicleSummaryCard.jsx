import { CUSTOMER_LABELS } from '../../data/customerFlow.js';
import './vehicle-detail.css';

export default function VehicleSummaryCard({
  dealerName,
  distanceKm,
  pricing,
  onSave,
  onInquiry,
}) {
  return (
    <aside className="vd-cta-card" aria-label="Ihr nächster Schritt">
      <div className="vd-cta-card__inner">
        <p className="vd-cta-card__eyebrow">Ihr nächster Schritt</p>
        <p className="vd-cta-card__rate">{pricing.priceLabel}</p>
        <p className="vd-cta-card__dealer">
          {dealerName} · {distanceKm} km
        </p>
        <button type="button" className="vd-btn vd-btn--primary vd-btn--block" onClick={onInquiry}>
          {CUSTOMER_LABELS.startInquiry}
        </button>
        <button type="button" className="vd-cta-card__save" onClick={onSave}>
          {CUSTOMER_LABELS.saveOffer}
        </button>
        <p className="vd-cta-card__footnote">Unverbindlich anfragen</p>
      </div>
    </aside>
  );
}
