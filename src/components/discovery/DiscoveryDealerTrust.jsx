import { Link } from 'react-router-dom';
import { getDealerProfile } from '../../logic/discoveryResultsPresentation.js';
import './discovery-results.css';

export default function DiscoveryDealerTrust({ match, onMoreFromDealer }) {
  if (!match) return null;

  const slug = match.vehicle.dealerSlug;
  const profile = getDealerProfile(slug);
  const name = match.bestOffer.dealer ?? match.vehicle.dealerName;
  const km = match.bestOffer.distanceKm ?? match.vehicle.distanceKm;
  const rating = profile?.rating;
  const years = profile?.partnerSinceYears ?? 15;
  const brand = profile?.partnerBrand ?? 'Kia';

  return (
    <section className="disc-section disc-section--dealer disc-section--trust" aria-label="Händler">
      <div className="disc-section__head">
        <h2 className="disc-section__title">Warum {name}?</h2>
        <p className="disc-section__sub">Persönlicher Ansprechpartner vor Ort.</p>
      </div>
      <div className="disc-dealer-trust">
        <div className="disc-dealer-trust__tiles">
          <div className="disc-dealer-trust__tile">
            <span className="disc-dealer-trust__tile-icon" aria-hidden>📍</span>
            <strong>{km} km</strong>
            <span>entfernt</span>
          </div>
          {rating != null && (
            <div className="disc-dealer-trust__tile">
              <span className="disc-dealer-trust__tile-icon" aria-hidden>⭐</span>
              <strong>{rating.toFixed(1)}</strong>
              <span>Bewertung</span>
            </div>
          )}
          <div className="disc-dealer-trust__tile">
            <span className="disc-dealer-trust__tile-icon" aria-hidden>🤝</span>
            <strong>{brand} Partner</strong>
            <span>seit {years} Jahren</span>
          </div>
        </div>
        <div className="disc-dealer-trust__actions">
          <Link to={`/haendler/${slug}`} className="disc-dealer-trust__cta">
            Händlerprofil ansehen
          </Link>
          {onMoreFromDealer && (
            <button type="button" className="disc-dealer-trust__secondary" onClick={onMoreFromDealer}>
              Weitere Fahrzeuge dieses Händlers
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
