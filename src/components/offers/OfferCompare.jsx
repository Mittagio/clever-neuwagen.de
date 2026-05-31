import { formatOfferRate } from '../../logic/offerService.js';
import OfferStatusChip from './OfferStatusChip.jsx';
import './OfferComponents.css';

export default function OfferCompare({ offers, activeCode, onSelect }) {
  if (!offers?.length) return null;

  return (
    <section className="offer-compare">
      <h2 className="offer-compare-title">Angebotsvergleich</h2>
      <p className="offer-compare-sub">{offers.length} Angebote für diesen Kunden</p>
      <div className="offer-compare-scroll">
        {offers.map((offer) => {
          const isActive = offer.code === activeCode;
          return (
            <button
              key={offer.code}
              type="button"
              className={`offer-compare-card ${isActive ? 'is-active' : ''}`}
              onClick={() => onSelect?.(offer.code)}
            >
              <OfferStatusChip status={offer.status} compact />
              <p className="offer-compare-vehicle">{offer.vehicle.trim || offer.vehicle.label}</p>
              <p className="offer-compare-rate">{formatOfferRate(offer.pricing)}</p>
              <p className="offer-compare-code">{offer.code}</p>
            </button>
          );
        })}
      </div>
    </section>
  );
}
