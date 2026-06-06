import { useState } from 'react';
import VehicleImage from '../shared/VehicleImage.jsx';
import CleverQuoteBadge from '../cleverQuote/CleverQuoteBadge.jsx';
import { RecommendReasonsPanel } from '../cleverQuote/CleverQuoteWhyPanel.jsx';
import DiscoveryPriceSheet from './DiscoveryPriceSheet.jsx';
import DeliveryTimePill from '../shared/DeliveryTimePill.jsx';
import {
  getMatchDisplayTitle,
  formatMatchPrimaryPrice,
  formatMatchDeliveryLabel,
} from '../../logic/discoveryDisplay.js';
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
}) {
  const [priceSheetOpen, setPriceSheetOpen] = useState(false);

  if (!match) return null;

  const v = match.vehicle;
  const title = getMatchDisplayTitle(match);
  const price = formatMatchPrimaryPrice(match, paymentMode);
  const paymentHint = paymentNeutral || paymentMode === 'cash' ? 'Kaufpreis' : (paymentMode === 'finance' ? 'Finanzierung' : 'Leasing');
  const deliveryLabel = formatMatchDeliveryLabel(match);

  return (
    <article className="disc-hero disc-hero--premium disc-hero--mobile-first disc-hero--s36">
      <div className="disc-hero__s36">
        <div className="disc-hero__visual disc-hero__visual--s36">
          <VehicleImage
            brand={v.brand}
            model={v.imageModel ?? v.model}
            bodyType={v.bodyType}
            className="disc-hero__image-wrap"
            imageClassName="disc-hero__image"
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
          <DeliveryTimePill label={deliveryLabel} className="disc-hero__delivery" />
          <RecommendReasonsPanel reasons={recommendReasons} title={whyTitle} />
          <button
            type="button"
            className="disc-hero__cta disc-hero__cta--hero"
            onClick={() => onViewOffer?.(v)}
          >
            Angebot ansehen
          </button>
          {(onUnderstandEquipment || onCleverQuoteWhy) && match.cleverQuote && (
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
