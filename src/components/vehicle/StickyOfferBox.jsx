import { CUSTOMER_LABELS } from '../../data/customerFlow.js';
import '../vehicle-detail/vehicle-detail.css';

export default function StickyOfferBox({
  price,
  dealer,
  onStartInquiry,
  onSaveOffer,
}) {
  return (
    <aside className="vd-cta-card" aria-label="Ihr nächster Schritt">
      <div className="vd-cta-card__inner">
        <p className="vd-cta-card__eyebrow">Ihr nächster Schritt</p>
        <p className="vd-cta-card__rate">{price?.label}</p>
        <p className="vd-cta-card__dealer">
          {dealer?.name} · {dealer?.distanceKm} km
        </p>
        <button type="button" className="vd-btn vd-btn--primary vd-btn--block" onClick={onStartInquiry}>
          Anfrage starten
        </button>
        <button type="button" className="vd-cta-card__save" onClick={onSaveOffer}>
          {CUSTOMER_LABELS.saveOffer}
        </button>
        <p className="vd-cta-card__footnote">Unverbindlich anfragen</p>
      </div>
    </aside>
  );
}
