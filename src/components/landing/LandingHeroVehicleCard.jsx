import { useState } from 'react';
import { Link } from 'react-router-dom';
import AvailabilityBadge from '../shared/AvailabilityBadge.jsx';
import DealerModelPromotionBadges from '../shared/DealerModelPromotionBadges.jsx';
import { resolveManufacturerImageUrl } from '../../services/media/manufacturerMediaService.js';
import { getHeroVehicleLocalImage } from '../../data/landingHeroVehicles.js';

export default function LandingHeroVehicleCard({
  vehicle,
  rate,
  delivery,
  availability,
  promotionBadges = [],
  preparationFeeLine = null,
  priceFootnotes = [],
  href,
  className = '',
}) {
  const localSrc = getHeroVehicleLocalImage(vehicle.imageKey);
  const svgFallback = resolveManufacturerImageUrl(vehicle.brand, vehicle.model, { variant: 'hero' });
  const [imgSrc, setImgSrc] = useState(localSrc);
  const [fallbackStep, setFallbackStep] = useState(0);

  function handleImageError() {
    if (fallbackStep === 0 && vehicle.pressImageUrl) {
      setImgSrc(vehicle.pressImageUrl);
      setFallbackStep(1);
      return;
    }
    if (fallbackStep <= 1 && svgFallback) {
      setImgSrc(svgFallback);
      setFallbackStep(2);
    }
  }

  return (
    <Link
      to={href}
      className={`lp-hero-card ${vehicle.floatClass} ${className}`.trim()}
      aria-label={`${vehicle.title}: ab ${rate} monatlich, Lieferzeit ${delivery}`}
    >
      <div className="lp-hero-card__glow" aria-hidden />
      <div className="lp-hero-card__inner">
        <div className="lp-hero-card__head">
          <span className={`lp-hero-card__badge lp-hero-card__badge--${vehicle.badgeTone}`}>
            {vehicle.badge}
          </span>
          <AvailabilityBadge
            label={availability.label}
            type={availability.type}
            compact
          />
        </div>

        <div className="lp-hero-card__media">
          <img
            src={imgSrc}
            alt={vehicle.title}
            className="lp-hero-card__img"
            loading="eager"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={handleImageError}
          />
        </div>

        <h3 className="lp-hero-card__title">{vehicle.title}</h3>

        <div className="lp-hero-card__price-row">
          <div>
            <p className="lp-hero-card__price">ab {rate}</p>
            <p className="lp-hero-card__price-sub">mtl. Leasingrate</p>
          </div>
        </div>

        <div className="lp-hero-card__meta">
          <span className="lp-hero-card__meta-chip">⏱ {delivery}</span>
        </div>

        {promotionBadges.length > 0 && (
          <div className="lp-hero-card__promos">
            <DealerModelPromotionBadges badges={promotionBadges} />
          </div>
        )}

        {preparationFeeLine && (
          <p className="lp-hero-card__prep">{preparationFeeLine}</p>
        )}

        {priceFootnotes?.slice(0, 1).map((line) => (
          <p key={line} className="lp-hero-card__legal">{line}</p>
        ))}
      </div>
    </Link>
  );
}
