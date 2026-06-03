import VehicleImage from '../shared/VehicleImage.jsx';
import { getAvailabilityPlainLabel } from '../../logic/marketplaceService.js';
import CleverQuoteBadge from '../cleverQuote/CleverQuoteBadge.jsx';
import { CUSTOMER_LABELS } from '../../data/customerFlow.js';
import '../vehicle-detail/vehicle-detail.css';

export default function HeroOffer({
  vehicle,
  dealer,
  price,
  onStartInquiry,
  onOpenPricing,
  displayTitle,
  discountPercent = 0,
  colorId,
  cleverQuote,
  onCleverQuoteWhy,
}) {
  const availabilityLabel = getAvailabilityPlainLabel(dealer?.availability ?? vehicle?.availability);
  const statusLine = dealer?.deliveryTime
    ? `${availabilityLabel} · ${dealer.deliveryTime}`
    : availabilityLabel;
  const title = displayTitle ?? vehicle?.title ?? '';
  const pricingLabel = price?.label ?? '';
  const pricingSubtitle = price?.subtitle ?? '';

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
        <h1 className="vd-hero__title">{title}</h1>
        {cleverQuote && (
          <div className="vd-hero__clever-quote">
            <CleverQuoteBadge
              cleverQuote={cleverQuote}
              size="lg"
              onWhyClick={onCleverQuoteWhy}
            />
          </div>
        )}
        <div className="vd-hero__meta">
          <p className="vd-hero__meta-line">
            {dealer?.name ?? vehicle.dealerName} · {dealer?.distanceKm ?? vehicle.distanceKm} km
          </p>
          <p className="vd-hero__meta-line">{statusLine}</p>
          {discountPercent > 0 && (
            <p className="vd-hero__meta-line vd-hero__meta-line--accent">
              {discountPercent} % Preisvorteil
            </p>
          )}
        </div>
        <div className="vd-hero__price-block">
          <p className="vd-hero__price">{pricingLabel}</p>
          <p className="vd-hero__price-type">{pricingSubtitle}</p>
          <button type="button" className="vd-hero__rate-link" onClick={onOpenPricing}>
            {price?.type === 'cash' ? 'Zahlungsart ändern' : 'Rate anpassen'}
          </button>
        </div>
        <div className="vd-hero__actions vd-hero__actions--mobile">
          <button type="button" className="vd-btn vd-btn--primary vd-btn--block" onClick={onStartInquiry}>
            {CUSTOMER_LABELS.startInquiry}
          </button>
          <button type="button" className="vd-btn vd-btn--outline vd-btn--block" onClick={onOpenPricing}>
            {price?.type === 'cash' ? 'Zahlungsart ändern' : 'Rate anpassen'}
          </button>
        </div>
        <div className="vd-hero__actions vd-hero__actions--desktop">
          <button type="button" className="vd-btn vd-btn--primary" onClick={onStartInquiry}>
            {CUSTOMER_LABELS.startInquiry}
          </button>
          <button type="button" className="vd-btn vd-btn--outline" onClick={onOpenPricing}>
            {price?.type === 'cash' ? 'Zahlungsart ändern' : 'Rate anpassen'}
          </button>
        </div>
      </div>
    </section>
  );
}
