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

function VariantRow({ match, paymentMode, onViewOffer, rank = 0, searchProfile = null }) {
  const v = match.vehicle;
  const variantLabel = getMatchVariantLabel(match);
  const price = formatMatchPrimaryPrice(match, paymentMode);
  const delivery = formatMatchDeliveryLabel(match);
  const medal = rank > 0 && rank <= 3 ? MEDALS[rank - 1] : null;

  return (
    <div className="disc-variant-row-wrap" role="listitem">
      <button
        type="button"
        className="disc-variant-row"
        onClick={() => onViewOffer?.(v)}
      >
        <div className="disc-variant-row__main">
          <span className="disc-variant-row__trim">
            {medal && <span className="disc-variant-row__medal" aria-hidden>{medal} </span>}
            {variantLabel}
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
        compact
      />
    </div>
  );
}

/**
 * Ebene 1: Modell (EV4) · Ebene 2: Ausstattungen (Air, Earth, GT-Line …)
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
    trimVariants = [],
    variantCount,
    label,
    hasMultipleVariants,
    modelQuote,
    modelChecks,
    recommendedTrimLabel,
  } = group;

  const modelFirst = Boolean(searchProfile && modelQuote && modelChecks?.length);
  const [variantsOpen, setVariantsOpen] = useState(
    defaultVariantsOpen ?? false,
  );

  if (!primaryMatch) return null;

  const isHero = rank === 1;
  const medal = rank <= 3 ? MEDALS[rank - 1] : null;
  const displayLabel = label ?? getMatchDisplayTitle(primaryMatch);
  const headlineQuote = modelQuote ?? primaryMatch.cleverQuote;
  const displayTrimVariants = trimVariants.length > 1
    ? trimVariants
    : [];

  const bullets = recommendReasons.length
    ? recommendReasons
    : buildWishMatchBullets(primaryMatch, {
      wishes,
      maxReasons: 4,
      allMatches,
      chipIds,
    });

  const heroMatch = modelFirst
    ? { ...primaryMatch, cleverQuote: headlineQuote }
    : primaryMatch;

  return (
    <article className={`disc-model-line${isHero ? ' disc-model-line--hero' : ''}${modelFirst ? ' disc-model-line--model-first' : ''}`}>
      {!isHero && (
        <header className="disc-model-line__head">
          {medal && <span className="disc-model-line__rank" aria-hidden>{medal}</span>}
          <div className="disc-model-line__head-text">
            <h3 className="disc-model-line__title">{displayLabel}</h3>
            {!modelFirst && recommendedTrimLabel && (
              <p className="disc-model-line__trim-hint">Empfohlen: {recommendedTrimLabel}</p>
            )}
          </div>
          {headlineQuote && (
            <CleverQuoteBadge
              cleverQuote={headlineQuote}
              size="sm"
              showTier={false}
              onWhyClick={() => onCleverQuoteWhy?.(primaryMatch)}
            />
          )}
        </header>
      )}

      {isHero ? (
        <DiscoveryHeroCard
          match={heroMatch}
          paymentMode={paymentMode}
          paymentNeutral={paymentNeutral}
          onChangePaymentMode={onChangePaymentMode}
          onViewOffer={onViewOffer}
          onCleverQuoteWhy={onCleverQuoteWhy}
          recommendReasons={modelFirst ? [] : bullets}
          whyTitle={whyTitle}
          heroBadge={heroBadge}
          variantLabel={modelFirst ? null : getMatchVariantLabel(primaryMatch)}
          modelFirst={modelFirst}
          exploreTrimsLabel={modelFirst && hasMultipleVariants ? `${displayLabel} ansehen` : null}
          onExploreTrims={
            modelFirst && hasMultipleVariants ? () => setVariantsOpen(true) : undefined
          }
        />
      ) : (
        <div className="disc-model-line__primary">
          <button
            type="button"
            className="disc-model-line__primary-btn"
            onClick={() => (modelFirst ? setVariantsOpen(true) : onViewOffer?.(primaryMatch.vehicle))}
          >
            <VehicleImage
              brand={primaryMatch.vehicle.brand}
              model={primaryMatch.vehicle.imageModel ?? primaryMatch.vehicle.model}
              bodyType={primaryMatch.vehicle.bodyType}
              className="disc-model-line__thumb-wrap"
              imageClassName="disc-model-line__thumb"
            />
            <div className="disc-model-line__primary-body">
              <p className="disc-model-line__variant-label">{displayLabel}</p>
              <p className="disc-model-line__price">
                ab {formatMatchPrimaryPrice(primaryMatch, paymentMode).label}
                <span>/Monat</span>
              </p>
              {!modelFirst && (
                <RecommendReasonsPanel
                  reasons={bullets.slice(0, 2)}
                  title={whyTitle ?? `Warum ${displayLabel}?`}
                />
              )}
            </div>
          </button>
        </div>
      )}

      {modelFirst ? (
        <WishFeatureChecklist
          checks={modelChecks}
          percent={modelQuote?.percent}
          modelLabel={displayLabel}
          title={`Warum ${displayLabel}?`}
          compact
        />
      ) : !searchProfile ? (
        <WishFeatureChecklist profile={searchProfile} match={primaryMatch} />
      ) : null}

      {modelFirst && hasMultipleVariants && (
        <div className="disc-model-line__variants">
          {!isHero && (
            <button
              type="button"
              className="btn btn-secondary disc-model-line__view-btn"
              aria-expanded={variantsOpen}
              onClick={() => setVariantsOpen((o) => !o)}
            >
              {variantsOpen ? 'Ausstattungen ausblenden' : `${displayLabel} ansehen`}
            </button>
          )}
          {isHero && variantsOpen && (
            <button
              type="button"
              className="disc-model-line__variants-collapse"
              onClick={() => setVariantsOpen(false)}
            >
              Ausstattungen ausblenden
            </button>
          )}
          {variantsOpen && (
            <>
              <p className="disc-model-line__variants-lead">Welche Ausstattung passt am besten?</p>
              <div className="disc-model-line__variants-list" role="list">
                {displayTrimVariants.map((entry, index) => (
                  <VariantRow
                    key={entry.trimKey}
                    match={entry.match}
                    paymentMode={paymentMode}
                    onViewOffer={onViewOffer}
                    rank={index + 1}
                    searchProfile={searchProfile}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {!searchProfile && !modelFirst && hasMultipleVariants && (
        <div className="disc-model-line__variants">
          <button
            type="button"
            className="disc-model-line__variants-toggle"
            aria-expanded={variantsOpen}
            onClick={() => setVariantsOpen((o) => !o)}
          >
            {variantsOpen
              ? 'Ausstattungen ausblenden'
              : `${variantCount} Ausstattungen`}
          </button>
          {variantsOpen && (
            <div className="disc-model-line__variants-list" role="list">
              {displayTrimVariants.map((entry, index) => (
                <VariantRow
                  key={entry.trimKey}
                  match={entry.match}
                  paymentMode={paymentMode}
                  onViewOffer={onViewOffer}
                  rank={index + 1}
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
