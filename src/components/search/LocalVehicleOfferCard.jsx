import VehicleImage from '../shared/VehicleImage.jsx';
import { formatCurrency } from '../../logic/marketplaceService.js';
import {
  formatDealerDistanceLine,
  formatDeliveryLine,
  formatDiscountFootnote,
  getAvailabilityLabel,
  getTopRecommendationBadge,
} from '../../logic/localOfferPresentation.js';
import './localVehicleOfferCard.css';

/**
 * Einheitliche Ergebniskarte: Fahrzeug → Händler → Entfernung → Verfügbarkeit → Lieferzeit → Rate
 */
export default function LocalVehicleOfferCard({
  vehicle,
  title,
  monthlyRate,
  onViewOffer,
  isTopPick = false,
  showImage = true,
  imageModel,
  className = '',
  children,
}) {
  if (!vehicle) return null;

  const displayTitle = title ?? vehicle.title;
  const rate = monthlyRate ?? vehicle.displayRate ?? vehicle.monthlyRate;
  const badge = getTopRecommendationBadge(vehicle, { isTopPick });
  const discountNote = formatDiscountFootnote(vehicle);
  const delivery = formatDeliveryLine(vehicle);

  return (
    <article className={`local-offer-card${isTopPick ? ' local-offer-card--top' : ''} ${className}`.trim()}>
      {badge && <p className="local-offer-card__badge">{badge}</p>}
      {showImage && (
        <VehicleImage
          brand={vehicle.brand}
          model={imageModel ?? vehicle.imageModel ?? vehicle.model}
          className="local-offer-card__image"
        />
      )}
      <div className="local-offer-card__body">
        <h3 className="local-offer-card__title">{displayTitle}</h3>
        <p className="local-offer-card__dealer">{formatDealerDistanceLine(vehicle)}</p>
        <p className="local-offer-card__availability">{getAvailabilityLabel(vehicle)}</p>
        {delivery && <p className="local-offer-card__delivery">{delivery}</p>}
        <p className="local-offer-card__rate">{formatCurrency(rate)}/Monat</p>
        {discountNote && <p className="local-offer-card__discount">{discountNote}</p>}
        {children}
        {onViewOffer && (
          <button type="button" className="local-offer-card__cta" onClick={() => onViewOffer(vehicle)}>
            Angebot ansehen
          </button>
        )}
      </div>
    </article>
  );
}
