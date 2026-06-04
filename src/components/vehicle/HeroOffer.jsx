import VehicleImage from '../shared/VehicleImage.jsx';
import CleverQuoteBadge from '../cleverQuote/CleverQuoteBadge.jsx';
import { RecommendReasonsPanel } from '../cleverQuote/CleverQuoteWhyPanel.jsx';
import DeliveryTimePill from '../shared/DeliveryTimePill.jsx';
import { CUSTOMER_LABELS } from '../../data/customerFlow.js';
import '../vehicle-detail/vehicle-detail.css';

export default function HeroOffer({
  vehicle,
  price,
  onStartInquiry,
  onOpenPricing,
  displayTitle,
  colorId,
  cleverQuote,
  onCleverQuoteWhy,
  onUnderstandEquipment,
  recommendReasons = [],
  deliveryLabel = null,
}) {
  const title = displayTitle ?? vehicle?.title ?? '';
  const pricingLabel = price?.label ?? '';
  const pricingSubtitle = price?.subtitle ?? '';
  const openEquipment = onUnderstandEquipment ?? onCleverQuoteWhy;
  const paymentHint = price?.type === 'cash' ? 'Kaufpreis' : 'Leasing';

  return (
    <section className="vd-hero vd-hero--stage vd-hero--mobile-first vd-hero--s36 vd-hero--advisor" aria-label="Fahrzeugangebot">
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
          <DeliveryTimePill label={deliveryLabel} className="vd-hero__delivery" />
          <RecommendReasonsPanel reasons={recommendReasons} />
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
          <div className="vd-hero__price-block">
            <p className="vd-hero__price">{pricingLabel}</p>
            <p className="vd-hero__price-type">{pricingSubtitle}</p>
            <DeliveryTimePill label={deliveryLabel} className="vd-hero__delivery" />
            <button type="button" className="vd-hero__rate-link" onClick={onOpenPricing}>
              {price?.type === 'cash' ? 'Zahlungsart ändern' : 'Rate anpassen'}
            </button>
          </div>
          <RecommendReasonsPanel reasons={recommendReasons} />
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
