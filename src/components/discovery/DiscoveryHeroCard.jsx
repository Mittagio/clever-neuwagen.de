import VehicleImage from '../shared/VehicleImage.jsx';
import { formatCurrency, getAvailabilityMeta } from '../../logic/marketplaceService.js';
import { formatDealerDistanceLine } from '../../logic/localOfferPresentation.js';
import CleverQuoteBadge from '../cleverQuote/CleverQuoteBadge.jsx';
import { RecommendReasonsPanel } from '../cleverQuote/CleverQuoteWhyPanel.jsx';
import './discovery-results.css';

function formatDeliveryShort(vehicle, match) {
  const t = match?.bestOffer?.deliveryTime ?? vehicle?.deliveryTime ?? '';
  return t.replace(/^Lieferzeit\s*/i, '').trim() || t;
}

function MobileActionButton({ emoji, label, onClick, active = false, disabled = false }) {
  return (
    <button
      type="button"
      className={`disc-mobile-action${active ? ' is-active' : ''}`}
      onClick={onClick}
      disabled={disabled}
    >
      <span className="disc-mobile-action__emoji" aria-hidden>{emoji}</span>
      <span className="disc-mobile-action__label">{label}</span>
    </button>
  );
}

export default function DiscoveryHeroCard({
  match,
  onViewOffer,
  onCustomize,
  onCompare,
  onEditSearch,
  onCleverQuoteWhy,
  recommendReasons = [],
  showCompare = false,
  heroBadge = 'Empfohlen für Ihre Suche',
}) {
  if (!match) return null;

  const v = match.vehicle;
  const title = match.model ?? `${v.brand} ${v.model}`;
  const rate = match.bestOffer.monthlyRate ?? v.monthlyRate;
  const availability = getAvailabilityMeta(v.availability);
  const delivery = formatDeliveryShort(v, match);
  const dealerLine = formatDealerDistanceLine({
    ...v,
    dealerName: match.bestOffer.dealer,
    distanceKm: match.bestOffer.distanceKm,
  });

  return (
    <article className="disc-hero disc-hero--premium disc-hero--mobile-first">
      <div className="disc-hero__mobile">
        <div className="disc-hero__mobile-scroll">
          <div className="disc-hero__visual">
            <span className="disc-hero__badge disc-hero__badge--mobile">{heroBadge}</span>
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
          <div className="disc-hero__mobile-content">
            <h2 className="disc-hero__title">{title}</h2>
            {match.cleverQuote && (
              <div className="disc-hero__clever-quote">
                <CleverQuoteBadge
                  cleverQuote={match.cleverQuote}
                  size="md"
                  showTier={false}
                  onWhyClick={onCleverQuoteWhy}
                />
              </div>
            )}
            <RecommendReasonsPanel reasons={recommendReasons} title="Warum?" />
          </div>
        </div>
        <div className="disc-hero__mobile-dock">
          <div className="disc-hero__price-block disc-hero__price-block--dock">
            <p className="disc-hero__rate">{formatCurrency(rate)}<span>/Monat</span></p>
            {v.discountPercent > 0 && (
              <p className="disc-hero__discount">{v.discountPercent} % Rabatt</p>
            )}
          </div>
          <button type="button" className="disc-hero__cta disc-hero__cta--dock" onClick={() => onViewOffer?.(v)}>
            Angebot ansehen
          </button>
          <div className="disc-hero__mobile-actions" role="group" aria-label="Suche anpassen">
            {onEditSearch && (
              <MobileActionButton emoji="🔍" label="Suche" onClick={onEditSearch} />
            )}
            {onCustomize && (
              <MobileActionButton emoji="✨" label="Anpassen" onClick={onCustomize} />
            )}
            <MobileActionButton
              emoji="📍"
              label="Vergleichen"
              onClick={onCompare}
              disabled={!showCompare || !onCompare}
            />
          </div>
        </div>
      </div>

      <div className="disc-hero__desktop">
        <div className="disc-hero__visual">
          <span className="disc-hero__badge">{heroBadge}</span>
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
        <div className="disc-hero__body">
          <h2 className="disc-hero__title">{title}</h2>
          {match.cleverQuote && (
            <div className="disc-hero__clever-quote">
              <CleverQuoteBadge cleverQuote={match.cleverQuote} size="md" onWhyClick={onCleverQuoteWhy} />
            </div>
          )}
          <p className="disc-hero__rate">{formatCurrency(rate)}<span>/Monat</span></p>
          {v.discountPercent > 0 && (
            <p className="disc-hero__discount">{v.discountPercent} % Rabatt gegenüber Listenpreis</p>
          )}
          <ul className="disc-hero__facts">
            <li className="disc-hero__fact--dealer">{dealerLine}</li>
            <li>{availability.label}</li>
            {delivery && <li>🚚 {delivery}</li>}
          </ul>
          <RecommendReasonsPanel reasons={recommendReasons} />
          <div className="disc-hero__actions">
            <button type="button" className="disc-hero__cta" onClick={() => onViewOffer?.(v)}>
              Angebot ansehen
            </button>
            {onCustomize && (
              <button type="button" className="disc-hero__cta-secondary" onClick={onCustomize}>
                Fahrzeug anpassen
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
