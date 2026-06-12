import { useMemo } from 'react';
import VehicleImage from '../shared/VehicleImage.jsx';
import { buildVehicleBrief, buildVehicleContextLine } from '../../services/dealer/vehicleSalesJourney.js';
import { recommendTrimForWishes } from '../../services/dealer/trimWishRecommendation.js';
import { resolveWishFeaturesFromChips } from '../../data/dealer/dealerWishCatalog.js';
import { resolveWishChipConflictHints } from '../../services/dealer/wishChipConflictHint.js';
import DealerVehicleWishChips from './DealerVehicleWishChips.jsx';
import DealerWishTrimPreview from './DealerWishTrimPreview.jsx';
import './dealer-landing.css';

/**
 * Schritt 2 – Fahrzeug verstehen + strukturierte Wünsche.
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

  const liveRecommendation = useMemo(() => {
    if (!hasWishes) return null;
    return recommendTrimForWishes(modelKey, wishFeatures, searchProfile, searchFilters);
  }, [modelKey, wishFeatures, searchProfile, searchFilters, hasWishes]);

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

      {brief.specRows.length > 0 && (
        <ul className="dl-sales-understand__specs">
          {brief.specRows.map((row) => (
            <li key={row.label}>
              <span className="dl-sales-understand__spec-icon" aria-hidden>{row.icon}</span>
              <span className="dl-sales-understand__spec-label">{row.label}</span>
              <strong className="dl-sales-understand__spec-value">{row.value}</strong>
            </li>
          ))}
        </ul>
      )}

      <div className="dl-sales-understand__wishes">
        <h3 className="dl-sales-understand__wishes-title">
          Welche Ausstattung ist Ihnen wichtig?
        </h3>
        <p className="dl-sales-understand__wishes-sub">
          Wählen Sie einfach die Punkte aus, die Ihnen wichtig sind.
          Clever empfiehlt anschließend automatisch die passende Ausstattung.
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

      {liveRecommendation && (
        <DealerWishTrimPreview recommendation={liveRecommendation} />
      )}

      <button
        type="button"
        className="btn btn-primary dl-sales-understand__cta"
        onClick={onContinue}
      >
        {hasWishes
          ? `Mit ${liveRecommendation?.primary?.trimLabel ?? 'passender Ausstattung'} weiter`
          : 'Weiter ohne Extra-Wünsche'}
      </button>
    </section>
  );
}
