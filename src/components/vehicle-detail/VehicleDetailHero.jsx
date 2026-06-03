import VehicleImage from '../shared/VehicleImage.jsx';
import { getAvailabilityPlainLabel } from '../../logic/marketplaceService.js';
import { CUSTOMER_LABELS } from '../../data/customerFlow.js';
import './vehicle-detail.css';

export default function VehicleDetailHero({
  vehicle,
  displayTitle,
  dealerName,
  distanceKm,
  availability,
  deliveryTime,
  discountPercent,
  pricing,
  colorId,
  onInquiry,
  onPriceCalc,
  onRateAdjust,
}) {
  const availabilityLabel = getAvailabilityPlainLabel(availability);
  const statusLine = deliveryTime
    ? `${availabilityLabel} · ${deliveryTime}`
    : availabilityLabel;

  return (
    <section className="vd-hero vd-hero--stage" aria-label="Fahrzeugangebot">
      <div className="vd-hero__media">
        <VehicleImage
          brand={vehicle.brand}
          model={vehicle.imageModel ?? vehicle.model}
          className={`vd-hero__image${colorId ? ` vd-hero__image--${colorId}` : ''}`}
        />
      </div>
      <div className="vd-hero__body">
        <h1 className="vd-hero__title">{displayTitle}</h1>
        <div className="vd-hero__meta">
          <p className="vd-hero__meta-line">
            {dealerName} · {distanceKm} km
          </p>
          <p className="vd-hero__meta-line">{statusLine}</p>
          {discountPercent > 0 && (
            <p className="vd-hero__meta-line vd-hero__meta-line--accent">
              {discountPercent} % Preisvorteil
            </p>
          )}
        </div>
        <div className="vd-hero__price-block">
          <p className="vd-hero__price">{pricing.priceLabel}</p>
          <p className="vd-hero__price-type">{pricing.subtitle}</p>
          <button
            type="button"
            className="vd-hero__rate-link"
            onClick={onRateAdjust ?? onPriceCalc}
          >
            Rate anpassen
          </button>
        </div>
        <div className="vd-hero__actions vd-hero__actions--mobile">
          <button type="button" className="vd-btn vd-btn--primary vd-btn--block" onClick={onInquiry}>
            {CUSTOMER_LABELS.startInquiry}
          </button>
          <button
            type="button"
            className="vd-btn vd-btn--outline vd-btn--block"
            onClick={onRateAdjust ?? onPriceCalc}
          >
            Rate anpassen
          </button>
        </div>
        <div className="vd-hero__actions vd-hero__actions--desktop">
          <button type="button" className="vd-btn vd-btn--primary" onClick={onInquiry}>
            {CUSTOMER_LABELS.startInquiry}
          </button>
          <button type="button" className="vd-btn vd-btn--outline" onClick={onRateAdjust ?? onPriceCalc}>
            Rate anpassen
          </button>
        </div>
      </div>
    </section>
  );
}
