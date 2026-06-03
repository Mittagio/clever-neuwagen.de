import { useState } from 'react';
import VehicleImage from '../shared/VehicleImage.jsx';
import LocalVehicleOfferCard from '../search/LocalVehicleOfferCard.jsx';
import CleverQuoteBadge, { CleverQuoteBreakdown } from '../cleverQuote/CleverQuoteBadge.jsx';
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
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  if (!match) return null;
  const v = match.vehicle;
  const offerVehicle = toOfferVehicle(match);
  const title = match.model ?? `${v.brand} ${v.model}`;

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
        {match.cleverQuote ? (
          <CleverQuoteBadge
            cleverQuote={match.cleverQuote}
            size="lg"
            onWhyClick={() => setBreakdownOpen(true)}
          />
        ) : (
          <WishFulfillmentList
            matched={match.matchedFeatures}
            missing={match.missingFeatures}
            viaPackage={match.availableWithPackage}
          />
        )}
      </LocalVehicleOfferCard>
      <CleverQuoteBreakdown
        cleverQuote={match.cleverQuote}
        open={breakdownOpen}
        onClose={() => setBreakdownOpen(false)}
      />
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
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const offerVehicle = toOfferVehicle(match);
  const title = match.model ?? offerVehicle.title;

  return (
    <>
      <LocalVehicleOfferCard
        vehicle={offerVehicle}
        title={title}
        showImage
        onViewOffer={() => onViewOffer?.(match.vehicle)}
        className="wish-grid-card"
      >
        {match.cleverQuote ? (
          <div className="local-offer-card__clever-quote">
            <CleverQuoteBadge
              cleverQuote={match.cleverQuote}
              size="sm"
              showTier={false}
              onWhyClick={() => setBreakdownOpen(true)}
            />
          </div>
        ) : (
          <WishMissingHint missing={match.missingFeatures.slice(0, 2)} />
        )}
      </LocalVehicleOfferCard>
      <CleverQuoteBreakdown
        cleverQuote={match.cleverQuote}
        open={breakdownOpen}
        onClose={() => setBreakdownOpen(false)}
      />
    </>
  );
}
