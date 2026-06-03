import VehicleImage from '../shared/VehicleImage.jsx';
import { formatCurrency, getAvailabilityMeta } from '../../logic/marketplaceService.js';
import { formatDealerDistanceLine } from '../../logic/localOfferPresentation.js';
import './discovery-results.css';

function formatDeliveryShort(vehicle, match) {
  const t = match?.bestOffer?.deliveryTime ?? vehicle?.deliveryTime ?? '';
  return t.replace(/^Lieferzeit\s*/i, '').trim() || t;
}

export default function DiscoveryHeroCard({
  match,
  onViewOffer,
  onCustomize,
  heroBadge = 'Empfohlen für Ihre Suche',
}) {
  if (!match) return null;

  const v = match.vehicle;
  const title = `${match.model}${match.bestTrim ? ` ${match.bestTrim}` : ''}`;
  const rate = match.bestOffer.monthlyRate ?? v.monthlyRate;
  const availability = getAvailabilityMeta(v.availability);
  const delivery = formatDeliveryShort(v, match);
  const dealerLine = formatDealerDistanceLine({
    ...v,
    dealerName: match.bestOffer.dealer,
    distanceKm: match.bestOffer.distanceKm,
  });

  return (
    <article className="disc-hero disc-hero--premium">
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
        <ul className="disc-hero__facts">
          <li className="disc-hero__fact--dealer">{dealerLine}</li>
          <li>{availability.label}</li>
          {delivery && <li>🚚 {delivery}</li>}
        </ul>
        <p className="disc-hero__rate">{formatCurrency(rate)}<span>/Monat</span></p>
        {v.discountPercent > 0 && (
          <p className="disc-hero__discount">{v.discountPercent} % Rabatt gegenüber Listenpreis</p>
        )}
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
    </article>
  );
}
