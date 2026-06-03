import VehicleImage from '../shared/VehicleImage.jsx';
import LocalVehicleOfferCard from '../search/LocalVehicleOfferCard.jsx';
import WishMatchScore from './WishMatchScore.jsx';
import { WishFulfillmentList, WishMissingHint } from './WishFulfillmentList.jsx';
import './wish.css';
import '../search/localVehicleOfferCard.css';

function toOfferVehicle(match) {
  const v = match.vehicle;
  return {
    ...v,
    dealerName: match.bestOffer.dealer,
    distanceKm: match.bestOffer.distanceKm,
    deliveryTime: match.bestOffer.deliveryTime,
    monthlyRate: match.bestOffer.monthlyRate,
    discountPercent: v.discountPercent,
    availability: v.availability,
  };
}

export function WishTopMatchCard({ match, onViewOffer, onAdjustWishes, onCompare }) {
  if (!match) return null;
  const v = match.vehicle;
  const offerVehicle = toOfferVehicle(match);
  const title = `${match.model}${match.bestTrim && match.bestTrim !== v.title ? ` ${match.bestTrim}` : ''}`;

  return (
    <div className="wish-top-card-wrap">
      <LocalVehicleOfferCard
        vehicle={offerVehicle}
        title={title}
        monthlyRate={match.bestOffer.monthlyRate}
        isTopPick
        showImage
        onViewOffer={() => onViewOffer?.(v)}
        className="wish-top-card"
      >
        <WishMatchScore matched={match.wishesMatched} total={match.wishesTotal} score={match.score} />
        <WishFulfillmentList
          matched={match.matchedFeatures}
          missing={match.missingFeatures}
          viaPackage={match.availableWithPackage}
        />
      </LocalVehicleOfferCard>
      <div className="wish-top-card__secondary-actions">
        <button type="button" className="wish-top-card__secondary" onClick={onAdjustWishes}>
          Wünsche anpassen
        </button>
        <button type="button" className="wish-top-card__secondary" onClick={onCompare}>
          Vergleichen
        </button>
      </div>
    </div>
  );
}

export function WishVehicleGridCard({ match, onViewOffer }) {
  const offerVehicle = toOfferVehicle(match);

  return (
    <LocalVehicleOfferCard
      vehicle={offerVehicle}
      showImage
      onViewOffer={() => onViewOffer?.(match.vehicle)}
      className="wish-grid-card"
    >
      <WishMatchScore matched={match.wishesMatched} total={match.wishesTotal} size="sm" />
      <WishMissingHint missing={match.missingFeatures.slice(0, 2)} />
    </LocalVehicleOfferCard>
  );
}
