import { useState } from 'react';
import CleverQuoteBadge from '../cleverQuote/CleverQuoteBadge.jsx';
import DiscoveryHeroCard from './DiscoveryHeroCard.jsx';
import {
  getMatchDisplayTitle,
  getMatchVariantLabel,
  formatMatchPrimaryPrice,
  formatMatchPriceFallback,
  formatMatchDeliveryLabel,
} from '../../logic/discoveryDisplay.js';
import { buildWishMatchBullets } from '../../services/cleverQuote/cleverQuoteRecommendation.js';
import WishFeatureChecklist from '../dealer/WishFeatureChecklist.jsx';
import DealerAdvisorHeroCard from '../dealer/DealerAdvisorHeroCard.jsx';
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
            {price.missing
              ? formatMatchPriceFallback(paymentMode)
              : `ab ${price.label}${price.suffix}`}
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
  dealerAdvisor = false,
  allGroups = [],
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
  if (dealerAdvisor && rank > 1) return null;

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

  const heroBadgeLabel = rank === 1
    ? (heroBadge ?? 'Empfohlen für Ihre Suche')
    : `${medal ? `${medal} ` : ''}Weitere Empfehlung`;

  if (dealerAdvisor) {
    return (
      <article className="disc-model-line disc-model-line--advisor">
        <DealerAdvisorHeroCard
          group={group}
          allGroups={allGroups.length ? allGroups : [group]}
          onViewOffer={onViewOffer}
          exploreTrimsLabel={modelFirst && hasMultipleVariants ? `${displayLabel} ansehen` : null}
          onExploreTrims={
            modelFirst && hasMultipleVariants ? () => setVariantsOpen(true) : undefined
          }
        />

        {modelFirst && hasMultipleVariants && (
          <div className="disc-model-line__variants">
            {variantsOpen && (
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
      </article>
    );
  }

  return (
    <article className={`disc-model-line disc-model-line--hero${modelFirst ? ' disc-model-line--model-first' : ''}${rank > 1 ? ' disc-model-line--secondary' : ''}`}>
      <DiscoveryHeroCard
        match={heroMatch}
        paymentMode={paymentMode}
        paymentNeutral={paymentNeutral}
        onChangePaymentMode={onChangePaymentMode}
        onViewOffer={onViewOffer}
        onCleverQuoteWhy={onCleverQuoteWhy}
        recommendReasons={modelFirst ? [] : bullets}
        whyTitle={whyTitle ?? (rank > 1 ? `Warum ${displayLabel}?` : undefined)}
        heroBadge={heroBadgeLabel}
        variantLabel={modelFirst ? null : getMatchVariantLabel(primaryMatch)}
        modelFirst={modelFirst}
        exploreTrimsLabel={modelFirst && hasMultipleVariants ? `${displayLabel} ansehen` : null}
        onExploreTrims={
          modelFirst && hasMultipleVariants ? () => setVariantsOpen(true) : undefined
        }
        className={rank > 1 ? 'disc-hero--secondary' : ''}
      />

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
          {rank > 1 && (
            <button
              type="button"
              className="btn btn-secondary disc-model-line__view-btn"
              aria-expanded={variantsOpen}
              onClick={() => setVariantsOpen((o) => !o)}
            >
              {variantsOpen ? 'Ausstattungen ausblenden' : `${displayLabel} ansehen`}
            </button>
          )}
          {rank === 1 && variantsOpen && (
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
