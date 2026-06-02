import { formatCurrency, getAvailabilityMeta } from '../../logic/marketplaceService.js';
import GoogleRatingBadge from './GoogleRatingBadge.jsx';
import './dealer-offer.css';

export default function DealerCompareCards({ offers = [], excludeSlug = null }) {
  const cards = offers.filter((o) => o.dealerSlug !== excludeSlug).slice(0, 3);
  if (!cards.length) return null;

  return (
    <section className="dealer-compare" aria-label="Weitere Händler für diese Konfiguration">
      <h2 className="dealer-compare__title">Weitere Händler für Ihre Konfiguration</h2>
      <p className="dealer-compare__sub">Vergleichen Sie das Gesamtpaket – nicht nur den Preis.</p>
      <div className="dealer-compare__grid">
        {cards.map((offer) => {
          const availability = getAvailabilityMeta(offer.availability);
          const badges = offer.profile?.trustBadges?.slice(0, 2) ?? [];

          return (
            <article key={offer.dealerSlug} className="dealer-compare-card">
              <div className="dealer-compare-card__top">
                <h3>{offer.dealerName}</h3>
                <span className="dealer-compare-card__score">{offer.score}</span>
              </div>
              <p className="dealer-compare-card__rate">{formatCurrency(offer.monthlyRate)}/Monat</p>
              {offer.profile?.rating != null && (
                <GoogleRatingBadge
                  rating={offer.profile.rating}
                  reviewCount={offer.profile.reviewCount}
                  ratingSource={offer.profile.ratingSource}
                  size="sm"
                  showLink={false}
                />
              )}
              <ul className="dealer-compare-card__list">
                <li>{offer.distanceKm} km entfernt</li>
                <li>{offer.deliveryTime}</li>
                <li>{availability.label.replace(/^.\s*/, '')}</li>
                {badges.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </article>
          );
        })}
      </div>
    </section>
  );
}
