import VehicleImage from '../shared/VehicleImage.jsx';
import { formatCurrency } from '../../logic/marketplaceService.js';
import WishMatchScore from './WishMatchScore.jsx';
import { WishFulfillmentList, WishMissingHint } from './WishFulfillmentList.jsx';
import './wish.css';

export function WishTopMatchCard({ match, onViewOffer, onAdjustWishes, onCompare }) {
  if (!match) return null;
  const v = match.vehicle;

  return (
    <article className="wish-top-card">
      <p className="wish-top-card__badge">⭐ Beste Empfehlung</p>
      <div className="wish-top-card__image-wrap">
        <VehicleImage brand={v.brand} model={v.imageModel} className="wish-top-card__image" />
      </div>
      <div className="wish-top-card__body">
        <h2>{match.model} {match.bestTrim !== v.title ? match.bestTrim : ''}</h2>
        <WishMatchScore matched={match.wishesMatched} total={match.wishesTotal} score={match.score} />
        <p className="wish-top-card__rate">{formatCurrency(match.bestOffer.monthlyRate)}/Monat</p>
        <p className="wish-top-card__dealer">
          {match.bestOffer.dealer} · {match.bestOffer.distanceKm} km · {match.bestOffer.deliveryTime}
        </p>
        <WishFulfillmentList
          matched={match.matchedFeatures}
          missing={match.missingFeatures}
          viaPackage={match.availableWithPackage}
        />
        <div className="wish-top-card__actions">
          <button type="button" className="wish-top-card__cta" onClick={() => onViewOffer?.(v)}>
            Angebot ansehen
          </button>
          <button type="button" className="wish-top-card__secondary" onClick={onAdjustWishes}>
            Wünsche anpassen
          </button>
          <button type="button" className="wish-top-card__secondary" onClick={onCompare}>
            Vergleichen
          </button>
        </div>
      </div>
    </article>
  );
}

export function WishVehicleGridCard({ match, onViewOffer }) {
  const v = match.vehicle;
  return (
    <article className="wish-grid-card">
      <VehicleImage brand={v.brand} model={v.imageModel} className="wish-grid-card__image" />
      <div className="wish-grid-card__body">
        <h3>{v.title}</h3>
        <WishMatchScore matched={match.wishesMatched} total={match.wishesTotal} size="sm" />
        <p className="wish-grid-card__rate">{formatCurrency(match.bestOffer.monthlyRate)}/Monat</p>
        <p className="wish-grid-card__meta">{match.bestOffer.distanceKm} km entfernt</p>
        <WishMissingHint missing={match.missingFeatures.slice(0, 2)} />
        <button type="button" className="wish-grid-card__cta" onClick={() => onViewOffer?.(v)}>
          Angebot ansehen
        </button>
      </div>
    </article>
  );
}
