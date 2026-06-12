import { useEffect, useMemo, useState } from 'react';
import VehicleImage from '../shared/VehicleImage.jsx';
import { buildVehicleBrief, buildVehicleContextLine } from '../../services/dealer/vehicleSalesJourney.js';
import { recommendTrimForWishes } from '../../services/dealer/trimWishRecommendation.js';
import { resolveWishFeaturesFromChips } from '../../data/dealer/dealerWishCatalog.js';
import { resolveWishChipConflictHints } from '../../services/dealer/wishChipConflictHint.js';
import DealerVehicleWishChips from './DealerVehicleWishChips.jsx';
import DealerCleverRecommendationHeader from './DealerCleverRecommendationHeader.jsx';
import DealerTrimSwipeCarousel from './DealerTrimSwipeCarousel.jsx';
import './dealer-landing.css';

/**
 * Fahrzeug verstehen – Clever-Empfehlung, Varianten-Swipe, Wunsch-Chips live.
 */
export default function DealerVehicleUnderstandCard({
  modelKey,
  dealerId,
  wishChipIds = [],
  searchProfile = null,
  searchFilters = null,
  searchChipIds = [],
  deliveryLabel = null,
  prefilledWishCount = 0,
  onToggleWish,
  onContinue,
}) {
  const brief = buildVehicleBrief(modelKey);
  const hasWishes = wishChipIds.length > 0;
  const [selectedTrimId, setSelectedTrimId] = useState(null);

  const contextLine = useMemo(
    () => buildVehicleContextLine(modelKey, { searchProfile, searchFilters, searchChipIds }),
    [modelKey, searchProfile, searchFilters, searchChipIds],
  );

  const wishFeatures = useMemo(
    () => resolveWishFeaturesFromChips(wishChipIds),
    [wishChipIds],
  );

  const chipHints = useMemo(
    () => resolveWishChipConflictHints(modelKey, wishChipIds),
    [modelKey, wishChipIds],
  );

  const liveRecommendation = useMemo(
    () => recommendTrimForWishes(
      modelKey,
      wishFeatures,
      searchProfile,
      searchFilters,
      wishChipIds,
    ),
    [modelKey, wishFeatures, searchProfile, searchFilters, wishChipIds],
  );

  useEffect(() => {
    setSelectedTrimId(liveRecommendation?.primary?.trimId ?? null);
  }, [liveRecommendation?.primary?.trimId, modelKey]);

  const selectedTrim = liveRecommendation?.allTrims?.find(
    (trim) => trim.trimId === (selectedTrimId ?? liveRecommendation?.primary?.trimId),
  ) ?? liveRecommendation?.primary;

  function handleContinue() {
    onContinue?.(selectedTrimId ?? liveRecommendation?.primary?.trimId ?? null);
  }

  return (
    <section className="dl-sales-understand" aria-labelledby="dl-sales-understand-title">
      <div className="dl-sales-understand__hero">
        <VehicleImage
          brand="Kia"
          model={modelKey}
          dealerId={dealerId}
          bodyType={brief.bodyType}
          className="dl-sales-understand__image-wrap"
          imageClassName="dl-sales-understand__image"
          variant="hero"
          glow
        />
        <div className="dl-sales-understand__intro">
          <h2 id="dl-sales-understand-title" className="dl-sales-understand__title">
            {brief.title}
          </h2>
          <p className="dl-sales-understand__tagline">{brief.tagline}</p>
          {contextLine && (
            <p className="dl-sales-understand__context">{contextLine}</p>
          )}
          {deliveryLabel && (
            <p className="dl-sales-understand__delivery">
              <span className="dl-sales-understand__delivery-icon" aria-hidden>🚚</span>
              Lieferzeit ca. {deliveryLabel}
            </p>
          )}
        </div>
      </div>

      {liveRecommendation?.primary && (
        <DealerCleverRecommendationHeader recommendation={liveRecommendation} />
      )}

      {liveRecommendation?.allTrims?.length > 1 && (
        <DealerTrimSwipeCarousel
          recommendation={liveRecommendation}
          wishChipIds={wishChipIds}
          selectedTrimId={selectedTrimId}
          onSelectTrim={setSelectedTrimId}
        />
      )}

      <div className="dl-sales-understand__wishes">
        <h3 className="dl-sales-understand__wishes-title">
          Was ist Ihnen wichtig?
        </h3>
        <p className="dl-sales-understand__wishes-sub">
          Wählen Sie Ihre Wünsche – Clever zeigt sofort, welche Ausstattung am besten passt.
        </p>
        {prefilledWishCount > 0 && (
          <p className="dl-sales-understand__prefill-hint">
            Aus Ihrer Suche haben wir {prefilledWishCount} Wünsche übernommen – jederzeit änderbar.
          </p>
        )}
        <DealerVehicleWishChips
          modelKey={modelKey}
          selectedChipIds={wishChipIds}
          searchProfile={searchProfile}
          searchFilters={searchFilters}
          searchChipIds={searchChipIds}
          chipHints={chipHints}
          onToggle={onToggleWish}
        />
      </div>

      <button
        type="button"
        className="btn btn-primary dl-sales-understand__cta"
        onClick={handleContinue}
      >
        {hasWishes
          ? `Mit ${selectedTrim?.trimLabel ?? 'passender Ausstattung'} weiter`
          : 'Weiter zur Kondition'}
      </button>
    </section>
  );
}
