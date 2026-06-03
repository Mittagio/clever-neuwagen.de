import VehicleImage from '../shared/VehicleImage.jsx';
import { getAvailabilityPlainLabel } from '../../logic/marketplaceService.js';
import CleverQuoteBadge from '../cleverQuote/CleverQuoteBadge.jsx';
import { RecommendReasonsPanel } from '../cleverQuote/CleverQuoteWhyPanel.jsx';
import { CUSTOMER_LABELS } from '../../data/customerFlow.js';
import '../vehicle-detail/vehicle-detail.css';

function MobileActionButton({ emoji, label, onClick, active = false }) {
  return (
    <button
      type="button"
      className={`vd-mobile-action${active ? ' is-active' : ''}`}
      onClick={onClick}
    >
      <span className="vd-mobile-action__emoji" aria-hidden>{emoji}</span>
      <span className="vd-mobile-action__label">{label}</span>
    </button>
  );
}

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

  return (
    <section className="vd-hero vd-hero--stage vd-hero--mobile-first" aria-label="Fahrzeugangebot">
      {/* Mobile: eine Aufgabe pro Viewport – Bild → Name → CQ → Preis → CTA → 3 Aktionen */}
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
            <RecommendReasonsPanel reasons={recommendReasons} title="Warum?" />
          </div>
        </div>
        <div className="vd-hero__mobile-dock">
          <div className="vd-hero__price-block vd-hero__price-block--dock">
            <p className="vd-hero__price">{pricingLabel}</p>
            <p className="vd-hero__price-type">{pricingSubtitle}</p>
          </div>
          <button type="button" className="vd-btn vd-btn--primary vd-btn--block vd-hero__cta" onClick={onStartInquiry}>
            {CUSTOMER_LABELS.startInquiry}
          </button>
          <div className="vd-hero__mobile-actions" role="group" aria-label="Angebot anpassen">
            <MobileActionButton emoji="💰" label="Preis ändern" onClick={onOpenPricing} />
            <MobileActionButton emoji="✨" label="Wünsche" onClick={onOpenWishes} active={wishesActive} />
            <MobileActionButton emoji="📍" label="Vergleichen" onClick={onOpenCompare} active={compareActive} />
          </div>
        </div>
      </div>

      {/* Desktop: bestehendes Zwei-Spalten-Layout */}
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
          <div className="vd-hero__actions vd-hero__actions--desktop">
            <button type="button" className="vd-btn vd-btn--primary" onClick={onStartInquiry}>
              {CUSTOMER_LABELS.startInquiry}
            </button>
            <button type="button" className="vd-btn vd-btn--outline" onClick={onOpenPricing}>
              {price?.type === 'cash' ? 'Zahlungsart ändern' : 'Rate anpassen'}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
