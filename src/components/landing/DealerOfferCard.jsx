import { Link } from 'react-router-dom';
import { SYNC_LABELS } from '../../data/dealerListings.js';
import AvailabilityBadge from '../shared/AvailabilityBadge.jsx';
import DealerModelPromotionBadges from '../shared/DealerModelPromotionBadges.jsx';
import LegalDisclaimer from '../legal/LegalDisclaimer.jsx';
import './DealerOfferCard.css';

function formatRate(value) {
  if (value == null) return null;
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value);
}

export default function DealerOfferCard({ offer }) {
  const {
    name,
    city,
    vehicleLabel,
    monthlyRateFrom,
    distanceKm,
    syncStatus,
    hasDealerPage,
    dealerPagePath,
    showRate,
    showPriceOnRequest,
    availability,
    preparationFeeLine,
    priceFootnotes = [],
    customerBadges = [],
  } = offer;

  const primaryAvail = availability?.primary;

  return (
    <article className="offer-card">
      <div className="offer-card-top">
        <div className="offer-card-chips">
          <span className="offer-chip offer-chip-dealer">{name}</span>
          <span className={`offer-chip offer-chip-sync offer-chip-sync--${syncStatus}`}>
            {SYNC_LABELS[syncStatus]}
          </span>
        </div>

        {primaryAvail && (
          <AvailabilityBadge
            type={primaryAvail.type}
            label={primaryAvail.label}
            compact
          />
        )}

        <p className="offer-card-vehicle">{vehicleLabel}</p>

        <div className="offer-card-rate-block">
          {showRate ? (
            <>
              <p className="offer-card-rate">ab {formatRate(monthlyRateFrom)}</p>
              <p className="offer-card-rate-unit">/Monat</p>
            </>
          ) : (
            <p className="offer-card-rate offer-card-rate--request">Preis anfragen</p>
          )}
        </div>

        {preparationFeeLine && (
          <p className="offer-card-prep">{preparationFeeLine}</p>
        )}

        {customerBadges.length > 0 && (
          <DealerModelPromotionBadges badges={customerBadges} className="offer-card-badges" />
        )}

        {availability?.highlights?.length > 0 && (
          <ul className="offer-inventory-list">
            {availability.highlights.map((item) => (
              <li key={item.id} className="offer-inventory-item">
                <AvailabilityBadge type={item.type} label={item.label} compact />
                <span className="offer-inventory-detail">
                  {item.equipment} · {item.color}
                  {item.location ? ` · ${item.location}` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}

        <p className="offer-card-distance">{distanceKm} km entfernt · {city}</p>
        {priceFootnotes.slice(0, 1).map((line) => (
          <p key={line} className="offer-card-legal">{line}</p>
        ))}
        {showRate && <LegalDisclaimer compact className="offer-card-disclaimer" />}
      </div>

      <div className="offer-card-action">
        {hasDealerPage ? (
          <Link to={dealerPagePath} className="btn btn-primary offer-card-btn">
            Zur Händlerseite
          </Link>
        ) : showPriceOnRequest ? (
          <button type="button" className="btn btn-secondary offer-card-btn">
            Preis anfragen
          </button>
        ) : (
          <button type="button" className="btn btn-secondary offer-card-btn">
            Angebot ansehen
          </button>
        )}
      </div>
    </article>
  );
}
