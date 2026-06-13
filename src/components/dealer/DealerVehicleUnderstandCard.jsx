import { useEffect, useMemo, useState } from 'react';
import VehicleImage from '../shared/VehicleImage.jsx';
import { buildVehicleBrief, buildVehicleContextLine } from '../../services/dealer/vehicleSalesJourney.js';
import { recommendTrimForWishes } from '../../services/dealer/trimWishRecommendation.js';
import { resolveWishFeaturesFromChips } from '../../data/dealer/dealerWishCatalog.js';
import { resolveWishChipConflictHints } from '../../services/dealer/wishChipConflictHint.js';
import { getModelTrims, normalizeModelKey, TRIM_FEATURE_MAP } from '../../data/features/trimFeatureMapping.js';
import {
  buildSerialEquipmentSections,
  getPackagesForTrim,
  scoreTrimWithPackages,
} from '../../services/dealer/trimEquipmentPresentation.js';
import DealerVehicleWishChips from './DealerVehicleWishChips.jsx';
import DealerCleverTrimRecommendation from './DealerCleverTrimRecommendation.jsx';
import DealerTrimSwipeCarousel from './DealerTrimSwipeCarousel.jsx';
import DealerTrimSerialEquipment from './DealerTrimSerialEquipment.jsx';
import DealerTrimPackages from './DealerTrimPackages.jsx';
import './dealer-landing.css';

function resolveMappingKey(modelKey) {
  const key = String(modelKey ?? '').toLowerCase();
  if (TRIM_FEATURE_MAP[key]) return key;
  return normalizeModelKey('Kia', modelKey);
}

/**
 * Phase 2–5 Berater-Journey – erst Wünsche, dann Empfehlung, Serienausstattung, Pakete.
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
  onTrimChange,
  hideInlineCta = false,
}) {
  const brief = buildVehicleBrief(modelKey);
  const hasWishes = wishChipIds.length > 0;
  const [selectedTrimId, setSelectedTrimId] = useState(null);
  const [selectedPackageIds, setSelectedPackageIds] = useState([]);

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

  useEffect(() => {
    setSelectedPackageIds([]);
  }, [selectedTrimId, modelKey]);

  const selectedTrim = liveRecommendation?.allTrims?.find(
    (trim) => trim.trimId === (selectedTrimId ?? liveRecommendation?.primary?.trimId),
  ) ?? liveRecommendation?.primary;

  const liveQuote = useMemo(() => {
    if (!selectedTrim?.trimId) return null;
    return scoreTrimWithPackages({
      modelKey,
      trimId: selectedTrim.trimId,
      wishFeatureIds: liveRecommendation?.wishFeatureIds ?? wishFeatures,
      wishChipIds,
      packageIds: selectedPackageIds,
    });
  }, [
    modelKey,
    selectedTrim?.trimId,
    liveRecommendation?.wishFeatureIds,
    wishFeatures,
    wishChipIds,
    selectedPackageIds,
  ]);

  const enrichedSelectedTrim = useMemo(() => {
    if (!selectedTrim || !liveQuote) return selectedTrim;
    return {
      ...selectedTrim,
      cleverQuotePercent: liveQuote.cleverQuotePercent,
      wishChipLines: liveQuote.wishChipLines ?? selectedTrim.wishChipLines,
    };
  }, [selectedTrim, liveQuote]);

  const enrichedAllTrims = useMemo(() => {
    if (!liveRecommendation?.allTrims) return [];
    return liveRecommendation.allTrims.map((trim) => {
      if (trim.trimId !== selectedTrim?.trimId) return trim;
      return enrichedSelectedTrim ?? trim;
    });
  }, [liveRecommendation?.allTrims, selectedTrim?.trimId, enrichedSelectedTrim]);

  const enrichedRecommendation = useMemo(() => ({
    ...liveRecommendation,
    allTrims: enrichedAllTrims,
    primary: enrichedAllTrims.find((trim) => trim.recommended) ?? enrichedSelectedTrim,
  }), [liveRecommendation, enrichedAllTrims, enrichedSelectedTrim]);

  const rawTrim = useMemo(() => {
    const mappingKey = resolveMappingKey(modelKey);
    return getModelTrims(mappingKey).find((trim) => trim.id === selectedTrim?.trimId) ?? null;
  }, [modelKey, selectedTrim?.trimId]);

  const serialSections = useMemo(() => {
    if (!rawTrim) return [];
    const packageFeatures = selectedPackageIds.length
      ? getPackagesForTrim(modelKey, selectedTrim?.trimId)
          .filter((pkg) => selectedPackageIds.includes(pkg.id))
          .flatMap((pkg) => pkg.features)
      : [];
    return buildSerialEquipmentSections(rawTrim, packageFeatures);
  }, [rawTrim, modelKey, selectedTrim?.trimId, selectedPackageIds]);

  const availablePackages = useMemo(
    () => getPackagesForTrim(modelKey, selectedTrim?.trimId ?? ''),
    [modelKey, selectedTrim?.trimId],
  );

  useEffect(() => {
    if (enrichedSelectedTrim) {
      onTrimChange?.({ ...enrichedSelectedTrim, packageIds: selectedPackageIds });
    }
  }, [enrichedSelectedTrim, selectedPackageIds, onTrimChange]);

  function handleTogglePackage(packageId) {
    setSelectedPackageIds((prev) => (
      prev.includes(packageId)
        ? prev.filter((id) => id !== packageId)
        : [...prev, packageId]
    ));
  }

  function handleContinue() {
    onContinue?.(
      selectedTrimId ?? liveRecommendation?.primary?.trimId ?? null,
      selectedPackageIds,
    );
  }

  const showAdvisorPhases = hasWishes && Boolean(liveRecommendation?.primary);

  return (
    <section className="dl-sales-understand" aria-labelledby="dl-sales-understand-title">
      <p className="dl-sales-understand__kicker">Fahrzeug gewählt</p>
      <div className="dl-sales-understand__hero dl-sales-understand__hero--compact">
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

      <div className="dl-sales-understand__wishes dl-sales-understand__wishes-panel">
        <h3 className="dl-sales-understand__wishes-title">
          Welche Dinge sind Ihnen wichtig?
        </h3>
        <p className="dl-sales-understand__wishes-sub">
          Tippen Sie Ihre Wünsche an – Clever berechnet live, welche Ausstattung passt.
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

      {showAdvisorPhases && (
        <>
          <div className="dl-advisor-block">
            <p className="dl-advisor-phase-label">Live-Vergleich</p>
            <DealerTrimSwipeCarousel
              recommendation={enrichedRecommendation}
              wishChipIds={wishChipIds}
              selectedTrimId={selectedTrimId}
              onSelectTrim={setSelectedTrimId}
              tabsOnly
            />
          </div>

          <div className="dl-advisor-block dl-advisor-block--recommend">
            <DealerCleverTrimRecommendation
              vehicleTitle={liveRecommendation.vehicleTitle}
              trimLabel={enrichedSelectedTrim?.trimLabel}
              matchPercent={enrichedSelectedTrim?.cleverQuotePercent}
              wishChipLines={enrichedSelectedTrim?.wishChipLines}
            />

            <DealerTrimSwipeCarousel
              recommendation={enrichedRecommendation}
              wishChipIds={wishChipIds}
              selectedTrimId={selectedTrimId}
              onSelectTrim={setSelectedTrimId}
              slidesOnly
            />
          </div>

          <div className="dl-advisor-block dl-advisor-block--detail">
            <p className="dl-advisor-phase-label">Im Detail</p>
            <DealerTrimSerialEquipment sections={serialSections} />

            <DealerTrimPackages
              packages={availablePackages}
              selectedPackageIds={selectedPackageIds}
              onTogglePackage={handleTogglePackage}
            />
          </div>
        </>
      )}

      {!hideInlineCta && (
        <button
          type="button"
          className="btn btn-primary dl-sales-understand__cta"
          onClick={handleContinue}
          disabled={!showAdvisorPhases}
        >
          {hasWishes
            ? `Mit ${enrichedSelectedTrim?.trimLabel ?? 'passender Ausstattung'} weiter`
            : 'Bitte mindestens einen Wunsch wählen'}
        </button>
      )}
    </section>
  );
}
