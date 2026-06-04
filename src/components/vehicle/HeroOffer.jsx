import VehicleImage from '../shared/VehicleImage.jsx';
import { getAvailabilityPlainLabel } from '../../logic/marketplaceService.js';
import CleverQuoteBadge from '../cleverQuote/CleverQuoteBadge.jsx';
import { RecommendReasonsPanel } from '../cleverQuote/CleverQuoteWhyPanel.jsx';
import { CUSTOMER_LABELS } from '../../data/customerFlow.js';
import '../vehicle-detail/vehicle-detail.css';

export default function HeroOffer({
  vehicle,
  dealer,
  price,
  onStartInquiry,
  onOpenPricing,
  onOpenWishes,
  onOpenCompare,
  displayTitle,
  discountPercent = 0,
  colorId,
  cleverQuote,
  onCleverQuoteWhy,
  onUnderstandEquipment,
  recommendReasons = [],
  wishesActive = false,
  compareActive = false,
}) {
  const availabilityLabel = getAvailabilityPlainLabel(dealer?.availability ?? vehicle?.availability);
  const statusLine = dealer?.deliveryTime
    ? `${availabilityLabel} · ${dealer.deliveryTime}`
    : availabilityLabel;
  const title = displayTitle ?? vehicle?.title ?? '';
  const pricingLabel = price?.label ?? '';
  const pricingSubtitle = price?.subtitle ?? '';
  const openEquipment = onUnderstandEquipment ?? onCleverQuoteWhy;
  const paymentHint = price?.type === 'cash' ? 'Kaufpreis' : 'Leasing';

  return (
    <section className="vd-hero vd-hero--stage vd-hero--mobile-first vd-hero--s36" aria-label="Fahrzeugangebot">
      <div className="vd-hero__mobile">
        <div className="vd-hero__mobile-scroll">
          <div className="vd-hero__media">
            <VehicleImage
              brand={vehicle.brand}
              model={vehicle.imageModel ?? vehicle.model}
              className={`vd-hero__image${colorId ? ` vd-hero__image--${colorId}` : ''}`}
            />
          </div>
          <div className="vd-hero__mobile-content">
            <h1 className="vd-hero__title">{title}</h1>
            {cleverQuote && (
              <div className="vd-hero__clever-quote">
                <CleverQuoteBadge
                  cleverQuote={cleverQuote}
                  size="md"
                  showTier={false}
                  onWhyClick={onCleverQuoteWhy}
                />
              </div>
            )}
            <RecommendReasonsPanel reasons={recommendReasons} title="Warum passt er zu Ihnen?" />
          </div>
        </div>
        <div className="vd-hero__mobile-dock">
          <button
            type="button"
            className="vd-hero__price-block vd-hero__price-block--dock vd-hero__price-block--tap"
            onClick={onOpenPricing}
            aria-label={`${paymentHint} anpassen`}
          >
            <p className="vd-hero__price">{pricingLabel}</p>
            <p className="vd-hero__price-type">{pricingSubtitle || `${paymentHint} · ändern`}</p>
          </button>
          <button type="button" className="vd-btn vd-btn--primary vd-btn--block vd-hero__cta" onClick={onStartInquiry}>
            {CUSTOMER_LABELS.startInquiry}
          </button>
          {openEquipment && cleverQuote && (
            <button type="button" className="vd-hero__understand" onClick={openEquipment}>
              Ausstattung verstehen
            </button>
          )}
        </div>
      </div>

      <div className="vd-hero__desktop">
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
          <RecommendReasonsPanel reasons={recommendReasons} title="Warum passt er zu Ihnen?" />
          <div className="vd-hero__meta vd-hero__meta--ebene2">
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
          <div className="vd-hero__actions vd-hero__actions--desktop">
            <button type="button" className="vd-btn vd-btn--primary" onClick={onStartInquiry}>
              {CUSTOMER_LABELS.startInquiry}
            </button>
            {openEquipment && cleverQuote && (
              <button type="button" className="vd-btn vd-btn--outline" onClick={openEquipment}>
                Ausstattung verstehen
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
