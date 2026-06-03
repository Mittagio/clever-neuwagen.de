import { Link } from 'react-router-dom';
import GoogleRatingBadge from '../dealer/GoogleRatingBadge.jsx';
import DealerInventoryCarousel from '../dealer/DealerInventoryCarousel.jsx';
import './vehicle-detail.css';

export default function VehicleDetailDealerBlock({
  offer,
  inventory = [],
  onInquiry,
  onTestDrive,
  configuredOffer = false,
}) {
  if (!offer) return null;

  const profile = offer.profile ?? {};
  const showGoogle = profile.ratingSource === 'google' && profile.rating != null;

  return (
    <section className="vd-dealer-block" id="vd-dealer-block" aria-label="Händler">
      <div className="vd-dealer-block__card">
        <h2 className="vd-section-title">Ihr Händler vor Ort</h2>
        <p className="vd-dealer-block__name">{offer.dealerName}</p>
        {configuredOffer && (
          <p className="vd-dealer-block__config-hint">Konfiguriertes Angebot anfragen</p>
        )}
        <ul className="vd-dealer-block__facts">
          <li>{offer.distanceKm} km entfernt</li>
          {offer.brand && <li>{offer.brand} Vertragspartner</li>}
          <li>Persönlicher Ansprechpartner vor Ort</li>
        </ul>
        <div className="vd-dealer-block__actions">
          <Link to={`/haendler/${offer.dealerSlug}`} className="vd-btn vd-btn--secondary">
            Händlerprofil
          </Link>
          <button type="button" className="vd-btn vd-btn--primary" onClick={onInquiry}>
            Angebot anfragen
          </button>
          <button type="button" className="vd-btn vd-btn--outline" onClick={onTestDrive}>
            Probefahrt
          </button>
        </div>
        {showGoogle && (
          <GoogleRatingBadge
            rating={profile.rating}
            reviewCount={profile.reviewCount}
            googleMapsUri={profile.googleMapsUri}
            ratingSource={profile.ratingSource}
            size="md"
          />
        )}
      </div>

      {inventory.length > 0 && (
        <DealerInventoryCarousel
          dealerName={offer.dealerName}
          vehicles={inventory}
          title={`Auch bei ${offer.dealerName} verfügbar`}
        />
      )}
    </section>
  );
}
