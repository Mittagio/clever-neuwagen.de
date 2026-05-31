import { Link } from 'react-router-dom';
import { useMemo } from 'react';
import { usePublishedDealerConditions } from '../../context/DealerConditionsContext.jsx';
import { getAdvisorRecommendations, formatAdvisorRate } from '../../services/advisorEngine.js';
import { LANDING_TRENDING, buildAdvisorUrl } from '../../services/landingAdvisorBridge.js';
import { AUTOHAUS_TRINKLE_ID } from '../../data/dealers/autohausTrinkle.js';
import VehicleImage from '../shared/VehicleImage.jsx';
import LegalDisclaimer from '../legal/LegalDisclaimer.jsx';

export default function LandingTrending() {
  const { publishedConditions: conditions } = usePublishedDealerConditions();
  const dealerId = conditions?.dealerId ?? AUTOHAUS_TRINKLE_ID;

  const cards = useMemo(() => {
    return LANDING_TRENDING.map((trend) => {
      const recs = getAdvisorRecommendations(
        {
          ...trend.profile,
          mileage: trend.profile.mileage ?? '10k-15k',
          fuelPreference: trend.profile.fuelPreference ?? 'egal',
          bodyType: trend.profile.bodyType ?? 'suv',
          wishes: trend.profile.wishes ?? [],
        },
        conditions,
      );
      const top = recs[0];
      const rate = top ? formatAdvisorRate(top.monthlyRate) : trend.mockRate;

      return {
        ...trend,
        href: buildAdvisorUrl(trend.profile),
        rate: rate ?? trend.mockRate,
        delivery: top?.deliveryTime ?? trend.delivery ?? '4–6 Wochen',
        mileage: trend.mileage ?? '10.000 km/J',
      };
    });
  }, [conditions]);

  return (
    <section className="lp-section lp-trending" aria-labelledby="lp-trending-title">
      <div className="lp-trending__head">
        <div>
          <h2 id="lp-trending-title" className="lp-section__title">
            <span aria-hidden>🔥 </span>
            Aktuell besonders gefragt
          </h2>
          <p className="lp-section__sub">
            Diese Empfehlungen werden gerade besonders häufig gesucht.
          </p>
        </div>
        <Link to="/berater?start=1" className="lp-trending__all-link">
          Alle Angebote ansehen →
        </Link>
      </div>

      <div className="lp-trending__scroll">
        {cards.map((card) => (
          <Link key={card.id} to={card.href} className="lp-offer-card">
            <div className="lp-offer-card__top">
              <span className={`lp-offer-card__badge lp-offer-card__badge--${card.badgeTone ?? 'default'}`}>
                {card.badge}
              </span>
              <button
                type="button"
                className="lp-offer-card__fav"
                aria-label="Merken"
                onClick={(e) => e.preventDefault()}
              >
                ♡
              </button>
            </div>

            <VehicleImage
              brand={card.brand}
              model={card.model}
              trim={card.trim}
              dealerId={dealerId}
              bodyType={card.profile.bodyType ?? 'suv'}
              variant="card"
              className="lp-offer-card__visual"
              placeholderVariant={card.visual}
              alt={card.title}
            />

            <h3 className="lp-offer-card__name">{card.title}</h3>
            <p className="lp-offer-card__desc">{card.description}</p>

            <div className="lp-offer-card__price-row">
              <div>
                <p className="lp-offer-card__price">ab {card.rate}</p>
                <p className="lp-offer-card__price-sub">mtl. Leasingrate</p>
              </div>
              {card.saving && (
                <span className="lp-offer-card__save">Sie sparen {card.saving}</span>
              )}
            </div>

            <div className="lp-offer-card__meta-chips">
              <span className="lp-offer-card__meta-chip">⏱ {card.delivery}</span>
              <span className="lp-offer-card__meta-chip">📍 {card.mileage}</span>
            </div>
          </Link>
        ))}
      </div>

      <LegalDisclaimer compact className="lp-trending__disclaimer" />
    </section>
  );
}
