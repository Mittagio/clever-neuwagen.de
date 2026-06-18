import { useMemo, useState } from 'react';

import VehicleImage from '../shared/VehicleImage.jsx';
import DealerPowertrainPicker from './DealerPowertrainPicker.jsx';
import EquipmentWishAdvisor from '../vehicle-detail/EquipmentWishAdvisor.jsx';
import { buildVehicleBrief, buildVehicleContextLine } from '../../services/dealer/vehicleSalesJourney.js';
import './dealer-landing.css';
import '../vehicle-detail/vehicle-detail.css';

export default function DealerVehicleUnderstandCard({
  modelKey,
  dealerId,
  wishChipIds = [],
  searchProfile = null,
  searchFilters = null,
  searchChipIds = [],
  deliveryLabel = null,
  prefilledWishCount = 0,
  powertrainOptions = [],
  onPowertrainChange,
  onToggleWish,
  onTrimChange,
  onSearchWishesChange,
  onJourneyContinue,
  knownPurchaseType = null,
}) {
  const [searchedFeatures, setSearchedFeatures] = useState([]);
  const brief = buildVehicleBrief(modelKey);
  const brand = 'Kia';
  const model = brief.title?.replace(/^Kia\s+/i, '') ?? modelKey?.toUpperCase();

  const selectedFeatures = wishChipIds;

  const contextLine = useMemo(
    () => buildVehicleContextLine(modelKey, { searchProfile, searchFilters, searchChipIds }),
    [modelKey, searchProfile, searchFilters, searchChipIds],
  );

  function handleRecommendationChange(rec) {
    if (!rec?.trimId) return;
    onTrimChange?.({
      trimId: rec.trimId,
      trimLabel: rec.trimName,
      packageIds: rec.packageIds ?? [],
      recommendationLabel: rec.label,
      cleverQuotePercent: rec.matchPercent ?? null,
      hasEquipmentWishes: wishChipIds.length > 0 || searchedFeatures.length > 0,
    });
  }

  function handleSearchedFeaturesChange(items) {
    setSearchedFeatures(items);
    onSearchWishesChange?.(items);
  }

  function handleJourneyContinue(rec) {
    onJourneyContinue?.({
      trimId: rec.trimId,
      packageIds: rec.packageIds ?? [],
    });
  }

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

      <DealerPowertrainPicker
        options={powertrainOptions}
        value={modelKey}
        onChange={onPowertrainChange}
      />

      <div className="dl-sales-understand__wishes dl-sales-understand__wishes-panel dl-sales-understand__equipment">
        {prefilledWishCount > 0 && (
          <p className="dl-sales-understand__prefill-hint">
            Aus Ihrer Suche haben wir {prefilledWishCount} Wünsche übernommen – jederzeit änderbar.
          </p>
        )}
        <EquipmentWishAdvisor
          variant="journey"
          vehicle={{ brand, model }}
          modelKey={modelKey}
          knownPurchaseType={knownPurchaseType}
          selectedFeatures={selectedFeatures}
          searchedFeatures={searchedFeatures}
          onToggleChip={onToggleWish}
          onRecommendationChange={handleRecommendationChange}
          onSearchedFeaturesChange={handleSearchedFeaturesChange}
          onJourneyContinue={handleJourneyContinue}
        />
      </div>
    </section>
  );
}