import VehicleImage from '../shared/VehicleImage.jsx';
import CleverQuoteBadge from '../cleverQuote/CleverQuoteBadge.jsx';
import {
  getMatchDisplayTitle,
  formatMatchPrimaryPrice,
} from '../../logic/discoveryDisplay.js';
import './discovery-results.css';

/**
 * Carwow-Reduktion Ebene 1 – Treffer #2–5
 */
export default function DiscoveryCuratedCard({
  match,
  rank,
  paymentMode = 'leasing',
  onViewOffer,
  onCleverQuoteWhy,
}) {
  if (!match) return null;

  const v = match.vehicle;
  const title = getMatchDisplayTitle(match);
  const price = formatMatchPrimaryPrice(match, paymentMode);

  return (
    <article className="disc-curated-card">
      <div
        className="disc-curated-card__main"
        role="button"
        tabIndex={0}
        onClick={() => onViewOffer?.(v)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onViewOffer?.(v);
          }
        }}
      >
        <div className="disc-curated-card__media">
          {rank != null && (
            <span className="disc-curated-card__rank" aria-hidden>{rank}</span>
          )}
          <VehicleImage
            brand={v.brand}
            model={v.imageModel ?? v.model}
            bodyType={v.bodyType}
            className="disc-curated-card__image-wrap"
            imageClassName="disc-curated-card__image"
          />
        </div>
        <div className="disc-curated-card__body">
          <h3 className="disc-curated-card__title">{title}</h3>
          {match.cleverQuote && (
            <div
              className="disc-curated-card__cq"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
              role="presentation"
            >
              <CleverQuoteBadge
                cleverQuote={match.cleverQuote}
                size="sm"
                showTier={false}
                onWhyClick={() => onCleverQuoteWhy?.(match)}
              />
            </div>
          )}
          <p className="disc-curated-card__price">
            Ab {price.label}
            {price.suffix && <span>{price.suffix}</span>}
          </p>
        </div>
        <span className="disc-curated-card__arrow" aria-hidden>→</span>
      </div>
    </article>
  );
}
