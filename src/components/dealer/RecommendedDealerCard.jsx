import { Link } from 'react-router-dom';
import { formatCurrency, getAvailabilityMeta } from '../../logic/marketplaceService.js';
import GoogleRatingBadge, { GoogleReviewSnippet } from './GoogleRatingBadge.jsx';
import './dealer-offer.css';

export default function RecommendedDealerCard({
  offer,
  onInquiry,
  onTestDrive,
}) {
  if (!offer) return null;

  const profile = offer.profile ?? {};
  const availability = getAvailabilityMeta(offer.availability);
  const badges = profile.trustBadges ?? [];

  return (
    <section className="recommended-dealer card" aria-label="Empfohlener Händler">
      <p className="recommended-dealer__eyebrow">⭐ Empfohlener Händler</p>
      <div className="recommended-dealer__head">
        <div>
          <h2>{offer.dealerName}</h2>
          <p className="recommended-dealer__meta">
            {offer.distanceKm} km entfernt · {offer.city}
          </p>
        </div>
        <div className="recommended-dealer__score" aria-label={`Händler-Score ${offer.score}`}>
          <span className="recommended-dealer__score-value">{offer.score}</span>
          <span className="recommended-dealer__score-label">Score</span>
        </div>
      </div>

      <div className="recommended-dealer__facts">
        {offer.discountPercent != null && (
          <span className="recommended-dealer__fact">{offer.discountPercent} % Rabatt</span>
        )}
        <span className="recommended-dealer__fact">{offer.deliveryTime}</span>
        <span className="recommended-dealer__fact">{availability.label.replace(/^.\s*/, '')}</span>
        <span className="recommended-dealer__fact recommended-dealer__fact--rate">
          {formatCurrency(offer.monthlyRate)}/Monat
        </span>
      </div>

      {offer.reasons?.length > 0 && (
        <ul className="recommended-dealer__reasons">
          {offer.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}

      {badges.length > 0 && (
        <ul className="recommended-dealer__trust">
          {badges.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      )}

      {profile.contactName && (
        <p className="recommended-dealer__contact">
          {profile.contactName}
          {profile.contactRole ? ` · ${profile.contactRole}` : ''}
          {profile.contactPhone && (
            <> · <a href={`tel:${profile.contactPhone}`}>{profile.contactPhone}</a></>
          )}
        </p>
      )}

      <GoogleRatingBadge
        rating={profile.rating}
        reviewCount={profile.reviewCount}
        googleMapsUri={profile.googleMapsUri ?? offer.googleReviews?.googleMapsUri}
        ratingSource={profile.ratingSource}
        size="lg"
      />

      <GoogleReviewSnippet reviews={profile.googleReviews ?? offer.googleReviews?.reviews} />

      <div className="recommended-dealer__actions">
        <button type="button" className="recommended-dealer__cta" onClick={onInquiry}>
          Angebot anfragen
        </button>
        <button type="button" className="recommended-dealer__secondary" onClick={onTestDrive}>
          Probefahrt vereinbaren
        </button>
        <Link to={`/haendler/${offer.dealerSlug}`} className="recommended-dealer__link">
          Händlerprofil ansehen
        </Link>
      </div>
    </section>
  );
}
