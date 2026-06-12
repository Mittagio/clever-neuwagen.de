import { useState } from 'react';
import VehicleImage from '../shared/VehicleImage.jsx';
import CleverQuoteBadge from '../cleverQuote/CleverQuoteBadge.jsx';
import { RecommendReasonsPanel } from '../cleverQuote/CleverQuoteWhyPanel.jsx';
import DiscoveryPriceSheet from './DiscoveryPriceSheet.jsx';
import DeliveryTimePill from '../shared/DeliveryTimePill.jsx';
import {
  getMatchDisplayTitle,
  formatMatchPrimaryPrice,
  formatMatchPriceFallback,
  formatMatchDeliveryLabel,
} from '../../logic/discoveryDisplay.js';
import DiscoveryTechnicalSpecs from './DiscoveryTechnicalSpecs.jsx';
import { resolveVehicleImageModel } from '../../services/vehicle/vehicleImageService.js';
import './discovery-results.css';

export default function DiscoveryHeroCard({
  match,
  paymentMode = 'cash',
  paymentNeutral = false,
  onChangePaymentMode,
  onViewOffer,
  onUnderstandEquipment,
  onCleverQuoteWhy,
  recommendReasons = [],
  whyTitle,
  heroBadge = 'Empfohlen für Ihre Suche',
  variantLabel = null,
  modelFirst = false,
  onExploreTrims = null,
  exploreTrimsLabel = null,
  className = '',
}) {
  const [priceSheetOpen, setPriceSheetOpen] = useState(false);

  if (!match) return null;

  const v = match.vehicle;
  const title = getMatchDisplayTitle(match);
  const price = formatMatchPrimaryPrice(match, paymentMode);
  const paymentHint = paymentNeutral || paymentMode === 'cash' ? 'Kaufpreis' : (paymentMode === 'finance' ? 'Finanzierung' : 'Leasing');
  const deliveryLabel = formatMatchDeliveryLabel(match);

  return (
    <article className={`disc-hero disc-hero--premium disc-hero--mobile-first disc-hero--s36${className ? ` ${className}` : ''}`.trim()}>
      <div className="disc-hero__s36">
        <div className="disc-hero__visual disc-hero__visual--s36">
          <VehicleImage
            brand={v.brand ?? 'Kia'}
            model={resolveVehicleImageModel(v)}
            bodyType={v.bodyType}
            className="disc-hero__image-wrap vehicle-image--oem-hero"
            imageClassName="disc-hero__image"
            variant="hero"
            placeholderVariant="hero"
            glow
          />
        </div>
        <div className="disc-hero__s36-body">
          <span className="disc-hero__badge disc-hero__badge--s36">{heroBadge}</span>
          <h2 className="disc-hero__title">{title}</h2>
          {variantLabel && (
            <p className="disc-hero__variant-label">Ausstattung: {variantLabel}</p>
          )}
          <DiscoveryTechnicalSpecs vehicle={v} className="disc-hero__tech" />
          {match.cleverQuote && (
            <div className="disc-hero__clever-quote">
              <CleverQuoteBadge
                cleverQuote={match.cleverQuote}
                size="md"
                showTier={false}
                onWhyClick={onCleverQuoteWhy ?? onUnderstandEquipment}
              />
            </div>
          )}
          {price.missing ? (
            <p className="disc-hero__price-fallback">
              {formatMatchPriceFallback(paymentMode)}
            </p>
          ) : (
            <button
              type="button"
              className="disc-hero__price-hero disc-hero__price-hero--sheet"
              onClick={() => setPriceSheetOpen(true)}
              aria-label={`Preis anzeigen: ${paymentHint}`}
            >
              <p className="disc-hero__rate disc-hero__rate--hero">
                Ab {price.label}
                {price.suffix && <span>{price.suffix}</span>}
              </p>
              <p className="disc-hero__rate-mode">
                {paymentNeutral ? 'Kaufpreis' : `${paymentHint} · ändern`}
              </p>
              {paymentNeutral && (
                <p className="disc-hero__alt-payments">Auch als Leasing oder Finanzierung verfügbar</p>
              )}
              {v.discountPercent > 0 && (
                <p className="disc-hero__discount">{v.discountPercent} % Ersparnis</p>
              )}
            </button>
          )}
          <DeliveryTimePill label={deliveryLabel} className="disc-hero__delivery" />
          {!modelFirst && <RecommendReasonsPanel reasons={recommendReasons} title={whyTitle} />}
          {modelFirst && onExploreTrims ? (
            <button
              type="button"
              className="disc-hero__cta disc-hero__cta--hero"
              onClick={onExploreTrims}
            >
              {exploreTrimsLabel ?? 'Ausstattungen ansehen'}
            </button>
          ) : (
            <button
              type="button"
              className="disc-hero__cta disc-hero__cta--hero"
              onClick={() => onViewOffer?.(v)}
            >
              Angebot ansehen
            </button>
          )}
          {!modelFirst && (onUnderstandEquipment || onCleverQuoteWhy) && match.cleverQuote && (
            <button
              type="button"
              className="disc-hero__understand"
              onClick={onUnderstandEquipment ?? onCleverQuoteWhy}
            >
              Ausstattung verstehen
            </button>
          )}
        </div>
      </div>

      <DiscoveryPriceSheet
        open={priceSheetOpen}
        onClose={() => setPriceSheetOpen(false)}
        match={match}
        paymentMode={paymentMode}
        onSelectMode={onChangePaymentMode}
      />
    </article>
  );
}
