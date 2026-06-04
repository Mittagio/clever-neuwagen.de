import VehicleImage from '../shared/VehicleImage.jsx';
import CleverQuoteBadge from '../cleverQuote/CleverQuoteBadge.jsx';
import CleverQuoteWhyPanel, { RecommendReasonsPanel } from '../cleverQuote/CleverQuoteWhyPanel.jsx';
import {
  getMatchDisplayTitle,
  formatMatchPrimaryPrice,
} from '../../logic/discoveryDisplay.js';
import { buildWishMatchBullets } from '../../services/cleverQuote/cleverQuoteRecommendation.js';
import './discovery-results.css';

/**
 * Carwow-Reduktion – Treffer #2–3 (max. 2 kuratierte Karten neben Hero)
 */
export default function DiscoveryCuratedCard({
  match,
  rank,
  paymentMode = 'leasing',
  wishes = null,
  onViewOffer,
  onCleverQuoteWhy,
}) {
  if (!match) return null;

  const v = match.vehicle;
  const title = getMatchDisplayTitle(match);
  const price = formatMatchPrimaryPrice(match, paymentMode);
  const recommendReasons = buildWishMatchBullets(match, { wishes, maxReasons: 3 });

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
          {match.cleverQuote ? (
            <CleverQuoteWhyPanel cleverQuote={match.cleverQuote} compact />
          ) : (
            <RecommendReasonsPanel reasons={recommendReasons} title="Warum passt es?" />
          )}
          <p className="disc-curated-card__price">
            {paymentMode === 'cash' ? '' : 'Ab '}{price.label}
            {price.suffix && <span>{price.suffix}</span>}
          </p>
        </div>
        <span className="disc-curated-card__arrow" aria-hidden>→</span>
      </div>
    </article>
  );
}
