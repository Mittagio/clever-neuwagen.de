import { useState } from 'react';
import VehicleImage from '../shared/VehicleImage.jsx';
import CleverQuoteBadge from '../cleverQuote/CleverQuoteBadge.jsx';
import { RecommendReasonsPanel } from '../cleverQuote/CleverQuoteWhyPanel.jsx';
import DiscoveryHeroCard from './DiscoveryHeroCard.jsx';
import {
  getMatchDisplayTitle,
  getMatchVariantLabel,
  formatMatchPrimaryPrice,
  formatMatchDeliveryLabel,
} from '../../logic/discoveryDisplay.js';
import { buildWishMatchBullets } from '../../services/cleverQuote/cleverQuoteRecommendation.js';
import WishFeatureChecklist from '../dealer/WishFeatureChecklist.jsx';
import './discovery-results.css';

const MEDALS = ['🥇', '🥈', '🥉'];

function VariantRow({ match, paymentMode, onViewOffer, isRecommended = false, searchProfile = null }) {
  const v = match.vehicle;
  const variantLabel = getMatchVariantLabel(match);
  const price = formatMatchPrimaryPrice(match, paymentMode);
  const delivery = formatMatchDeliveryLabel(match);

  return (
    <div className="disc-variant-row-wrap" role="listitem">
      <button
        type="button"
        className={`disc-variant-row${isRecommended ? ' disc-variant-row--recommended' : ''}`}
        onClick={() => onViewOffer?.(v)}
      >
        <div className="disc-variant-row__main">
          <span className="disc-variant-row__trim">
            {variantLabel}
            {isRecommended && <span className="disc-variant-row__badge">Empfohlen</span>}
          </span>
          {delivery && <span className="disc-variant-row__delivery">{delivery}</span>}
        </div>
        <div className="disc-variant-row__meta">
          <span className="disc-variant-row__price">
            ab {price.label}{price.suffix}
          </span>
          {match.cleverQuote && (
            <CleverQuoteBadge cleverQuote={match.cleverQuote} size="sm" showTier={false} />
          )}
          <span className="disc-variant-row__arrow" aria-hidden>→</span>
        </div>
      </button>
      <WishFeatureChecklist
        profile={searchProfile}
        match={match}
        title="Wünsche in dieser Ausstattung"
      />
    </div>
  );
}

/**
 * Eine Modelllinie mit bestem Treffer + Ausstattungsvarianten darunter.
 */
export default function DiscoveryModelLineCard({
  group,
  rank = 1,
  paymentMode = 'cash',
  paymentNeutral = false,
  wishes = null,
  chipIds = [],
  allMatches = [],
  onViewOffer,
  onCleverQuoteWhy,
  onChangePaymentMode,
  searchProfile = null,
  heroBadge,
  recommendReasons = [],
  whyTitle,
  defaultVariantsOpen = null,
}) {
  const {
    primaryMatch,
    variants = [],
    trimVariants = [],
    variantCount,
    label,
    hasMultipleVariants,
  } = group;
  const [variantsOpen, setVariantsOpen] = useState(
    defaultVariantsOpen ?? (rank <= 2 && hasMultipleVariants),
  );

  if (!primaryMatch) return null;

  const isHero = rank === 1;
  const medal = rank <= 3 ? MEDALS[rank - 1] : null;
  const primaryTrimLabel = getMatchVariantLabel(primaryMatch);
  const alternateLabels = variants.map((m) => getMatchVariantLabel(m)).join(', ');
  const displayTrimVariants = trimVariants.length > 1
    ? trimVariants
    : variants.map((m) => ({
      trimKey: m.slug,
      trimLabel: getMatchVariantLabel(m),
      match: m,
      isPrimary: false,
    }));
  const bullets = recommendReasons.length
    ? recommendReasons
    : buildWishMatchBullets(primaryMatch, {
      wishes,
      maxReasons: 4,
      allMatches,
      chipIds,
    });

  return (
    <article className={`disc-model-line${isHero ? ' disc-model-line--hero' : ''}`}>
      {!isHero && (
        <header className="disc-model-line__head">
          {medal && <span className="disc-model-line__rank" aria-hidden>{medal}</span>}
          <div className="disc-model-line__head-text">
            <h3 className="disc-model-line__title">{label ?? getMatchDisplayTitle(primaryMatch)}</h3>
            <p className="disc-model-line__trim-hint">Empfohlen: {primaryTrimLabel}</p>
          </div>
          {primaryMatch.cleverQuote && (
            <CleverQuoteBadge
              cleverQuote={primaryMatch.cleverQuote}
              size="sm"
              showTier={false}
              onWhyClick={() => onCleverQuoteWhy?.(primaryMatch)}
            />
          )}
        </header>
      )}

      {isHero ? (
        <DiscoveryHeroCard
          match={primaryMatch}
          paymentMode={paymentMode}
          paymentNeutral={paymentNeutral}
          onChangePaymentMode={onChangePaymentMode}
          onViewOffer={onViewOffer}
          onCleverQuoteWhy={onCleverQuoteWhy}
          recommendReasons={bullets}
          whyTitle={whyTitle}
          heroBadge={heroBadge}
          variantLabel={primaryTrimLabel}
        />
      ) : (
        <div className="disc-model-line__primary">
          <button
            type="button"
            className="disc-model-line__primary-btn"
            onClick={() => onViewOffer?.(primaryMatch.vehicle)}
          >
            <VehicleImage
              brand={primaryMatch.vehicle.brand}
              model={primaryMatch.vehicle.imageModel ?? primaryMatch.vehicle.model}
              bodyType={primaryMatch.vehicle.bodyType}
              className="disc-model-line__thumb-wrap"
              imageClassName="disc-model-line__thumb"
            />
            <div className="disc-model-line__primary-body">
              <p className="disc-model-line__variant-label">{primaryTrimLabel}</p>
              <p className="disc-model-line__price">
                ab {formatMatchPrimaryPrice(primaryMatch, paymentMode).label}
                <span>/Monat</span>
              </p>
              <RecommendReasonsPanel
                reasons={bullets.slice(0, 2)}
                title={whyTitle ?? `Warum ${label}?`}
              />
            </div>
          </button>
        </div>
      )}

      <WishFeatureChecklist profile={searchProfile} match={primaryMatch} />

      {hasMultipleVariants && (
        <div className="disc-model-line__variants">
          <button
            type="button"
            className="disc-model-line__variants-toggle"
            aria-expanded={variantsOpen}
            onClick={() => setVariantsOpen((o) => !o)}
          >
            {variantsOpen
              ? 'Ausstattungen ausblenden'
              : `${variantCount} Ausstattungen${alternateLabels ? `: ${alternateLabels}` : ''}`}
          </button>
          {variantsOpen && (
            <div className="disc-model-line__variants-list" role="list">
              {displayTrimVariants.map((entry) => (
                <VariantRow
                  key={entry.trimKey}
                  match={entry.match}
                  paymentMode={paymentMode}
                  onViewOffer={onViewOffer}
                  isRecommended={entry.isPrimary}
                  searchProfile={searchProfile}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </article>
  );
}
