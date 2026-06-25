import { useEffect, useMemo, useState } from 'react';
import { isChipSelected } from '../../data/features/equipmentWishChips.js';
import { formatCurrency } from '../../logic/marketplaceService.js';
import { getEquipmentStepCta, getNeutralPriceTierLabel, resolveTrimPriceDisplay } from '../../services/dealer/equipmentStepPresentation.js';
import {
  analyzeEquipmentWishSelection,
  getEquipmentWishChipGroups,
  resolveActiveEquipmentRecommendation,
} from '../../services/configuration/equipmentWishAdvisor.js';
import EquipmentFeatureSearch from './EquipmentFeatureSearch.jsx';
import { useTrimCardShuffle } from './useTrimCardShuffle.js';
import '../vehicle-detail/vehicle-detail.css';

function MatchBar({ percent }) {
  if (!percent) return null;
  return (
    <div className="vd-eq-match" aria-hidden>
      <div className="vd-eq-match__track">
        <div className="vd-eq-match__fill" style={{ width: `${Math.min(100, percent)}%` }} />
      </div>
      <span className="vd-eq-match__label">{percent} %</span>
    </div>
  );
}

function TrimLineCard({
  line,
  knownPurchaseType,
  selected,
  hasWishes,
  onSelect,
  index,
  total,
  isLeading,
  isJourney = false,
  ctaLabel = '',
  onContinue,
}) {
  const price = resolveTrimPriceDisplay({
    knownPurchaseType,
    rate: line.rate,
    rateDelta: line.rateDelta,
    cashPrice: line.cashPrice,
    cashDelta: line.cashDelta,
    trimName: line.trimName,
    index,
    total,
    formatCurrency,
  });

  const displayDesc = isJourney && !knownPurchaseType
    ? getNeutralPriceTierLabel(index, total)
    : line.description;

  return (
    <article
      data-trim-id={line.trimId}
      className={`vd-eq-trim${selected ? ' vd-eq-trim--selected' : ''}${line.recommended ? ' vd-eq-trim--recommended' : ''}${isLeading ? ' vd-eq-trim--leading' : ''}`}
    >
      <button type="button" className="vd-eq-trim__head" onClick={() => onSelect?.(line.trimId)}>
        <div className="vd-eq-trim__title-row">
          <h4 className="vd-eq-trim__name">{line.trimName}</h4>
          {line.badge && <span className="vd-eq-trim__badge">{line.badge}</span>}
        </div>
        <p className="vd-eq-trim__desc">{displayDesc}</p>
        {hasWishes && line.matchPercent > 0 && <MatchBar percent={line.matchPercent} />}
        <div className="vd-eq-trim__price-row">
          {price.primary && (
            <p className={`vd-eq-trim__rate${price.neutral ? ' vd-eq-trim__rate--neutral' : ''}`}>
              {price.primary}
            </p>
          )}
          {price.secondary && (
            <p className="vd-eq-trim__delta">{price.secondary}</p>
          )}
        </div>
      </button>
      {hasWishes && (line.fulfilled?.length > 0 || line.missing?.length > 0 || line.uncertain?.length > 0) && (
        <div className="vd-eq-trim__details">
          {line.fulfilled?.length > 0 && (
            <ul className="vd-eq-trim__list vd-eq-trim__list--ok">
              {line.fulfilled.map((item) => (
                <li key={item}><span aria-hidden>✓</span> {item}</li>
              ))}
            </ul>
          )}
          {line.missing?.length > 0 && (
            <ul className="vd-eq-trim__list vd-eq-trim__list--miss">
              {line.missing.map((item) => (
                <li key={item}><span aria-hidden>○</span> {item}</li>
              ))}
            </ul>
          )}
          {line.uncertain?.length > 0 && (
            <ul className="vd-eq-trim__list vd-eq-trim__list--uncertain">
              {line.uncertain.map((item) => (
                <li key={item}>
                  <span aria-hidden>?</span> {item} – wird geprüft
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {selected && isJourney && ctaLabel && onContinue && (
        <button
          type="button"
          className="vd-eq-trim__cta vd-btn vd-btn--primary vd-btn--block"
          onClick={() => onContinue(line.trimId)}
        >
          {ctaLabel}
        </button>
      )}
      {!selected && isJourney && isLeading && ctaLabel && onContinue && (
        <button
          type="button"
          className="vd-eq-trim__cta vd-btn vd-btn--primary vd-btn--block"
          onClick={() => onContinue(line.trimId)}
        >
          {ctaLabel}
        </button>
      )}
    </article>
  );
}

export default function EquipmentWishAdvisor({
  vehicle,
  modelKey,
  selectedFeatures = [],
  searchedFeatures: searchedFeaturesProp,
  trimId,
  knownPurchaseType = null,
  paymentMode = 'leasing',
  variant = 'default',
  onToggleChip,
  onApplyRecommendation,
  onRecommendationChange,
  onSearchedFeaturesChange,
  onInquiry,
  onJourneyContinue,
}) {
  const [previewTrimId, setPreviewTrimId] = useState(null);
  const [internalSearched, setInternalSearched] = useState([]);
  const isJourney = variant === 'journey';
  const searchedFeatures = searchedFeaturesProp ?? internalSearched;

  function setSearchedFeatures(next) {
    const value = typeof next === 'function' ? next(searchedFeatures) : next;
    if (searchedFeaturesProp == null) setInternalSearched(value);
    onSearchedFeaturesChange?.(value);
  }

  function handleAddSearchedFeature(item) {
    setSearchedFeatures((prev) => [...prev, item]);
  }

  function handleRemoveSearchedFeature(id) {
    setSearchedFeatures((prev) => prev.filter((item) => item.id !== id));
  }

  const selectedChipIds = useMemo(
    () => selectedFeatures,
    [selectedFeatures],
  );

  const effectivePaymentMode = knownPurchaseType ?? paymentMode;

  const analysis = useMemo(
    () => analyzeEquipmentWishSelection(
      vehicle.brand,
      vehicle.model,
      selectedChipIds,
      {
        paymentType: effectivePaymentMode,
        selectedTrimId: previewTrimId ?? trimId,
        modelKey,
        searchedFeatures,
      },
    ),
    [vehicle.brand, vehicle.model, selectedChipIds, effectivePaymentMode, previewTrimId, trimId, modelKey, searchedFeatures],
  );

  const chipGroups = useMemo(
    () => getEquipmentWishChipGroups(vehicle.brand, vehicle.model, modelKey),
    [vehicle.brand, vehicle.model, modelKey],
  );

  const hasSelection = analysis.hasWishes ?? (selectedChipIds.length > 0 || searchedFeatures.length > 0);
  const equipmentCta = getEquipmentStepCta(knownPurchaseType, hasSelection);
  const activeTrimId = previewTrimId ?? analysis.recommendation?.trimId ?? trimId;
  const activeRecommendation = useMemo(
    () => resolveActiveEquipmentRecommendation(analysis, activeTrimId),
    [analysis, activeTrimId],
  );
  const trimOrderKey = analysis.trimLines?.map((line) => line.trimId) ?? [];
  const trimListRef = useTrimCardShuffle(trimOrderKey);
  const topMatchPercent = hasSelection
    ? Math.max(0, ...(analysis.trimLines?.map((line) => line.matchPercent) ?? []))
    : 0;

  useEffect(() => {
    if (!isJourney || previewTrimId || !analysis.recommendation?.trimId) return;
    setPreviewTrimId(analysis.recommendation.trimId);
  }, [isJourney, previewTrimId, analysis.recommendation?.trimId]);

  useEffect(() => {
    if (!activeRecommendation) return;
    onRecommendationChange?.(activeRecommendation);
  }, [activeRecommendation, onRecommendationChange]);

  function handleTrimContinue(trimIdForContinue) {
    const rec = resolveActiveEquipmentRecommendation(analysis, trimIdForContinue);
    if (!rec) return;
    if (isJourney) {
      onJourneyContinue?.(rec);
      return;
    }
    onApplyRecommendation?.(rec);
  }

  return (
    <section
      className={`vd-wish vd-wish--embedded vd-wish--equipment${isJourney ? ' vd-wish--portal' : ''}`}
      id="vd-wish-builder"
      aria-label="Ausstattungsberatung"
    >
      <div className="vd-wish__intro">
        <h2 className="vd-wish__title">
          {isJourney ? 'Welche Variante passt besser?' : 'Welche Ausstattung passt zu Ihnen?'}
        </h2>
        {!isJourney && (
          <p className="vd-wish__question vd-wish__subline">
            Wählen Sie aus, was Ihnen wichtig ist – Clever empfiehlt die passende Variante.
          </p>
        )}
      </div>

      {chipGroups.map((group) => (
        <div key={group.id} className="vd-wish__group">
          <p className="vd-wish__group-label">{group.label}</p>
          <div className="vd-wish__chips vd-wish__chips--equipment">
            {group.chips.map((chip) => {
              const active = isChipSelected(chip.id, selectedFeatures);
              return (
                <button
                  key={chip.id}
                  type="button"
                  className={`vd-wish-chip vd-wish-chip--equipment${active ? ' vd-wish-chip--wish' : ''}`}
                  onClick={() => onToggleChip?.(chip.id)}
                  aria-pressed={active}
                >
                  {active && <span className="vd-wish-chip__check" aria-hidden>✓</span>}
                  <span className="vd-wish-chip__text">{chip.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <EquipmentFeatureSearch
        brand={vehicle.brand}
        model={vehicle.model}
        modelKey={modelKey}
        selectedFeatureIds={selectedFeatures}
        searchedFeatures={searchedFeatures}
        onAddSearchedFeature={handleAddSearchedFeature}
        onRemoveSearchedFeature={handleRemoveSearchedFeature}
      />

      {!chipGroups.length && (
        <p className="vd-eq-empty">
          Für dieses Modell sind noch keine Ausstattungsdetails hinterlegt.
          Bitte wenden Sie sich an das Autohaus.
        </p>
      )}

      {analysis.trimLines?.length > 0 && (
        <div className="vd-eq-section">
          {!isJourney && <h3 className="vd-eq-section__title">Ihre passende Variante</h3>}
          {!hasSelection && !isJourney && (
            <p className="vd-eq-section__lead">
              Wählen Sie Wünsche aus oder lassen Sie Clever eine sinnvolle Variante empfehlen.
            </p>
          )}
          <div className="vd-eq-trim-list" ref={trimListRef}>
            {analysis.trimLines.map((line, index) => (
              <TrimLineCard
                key={line.trimId}
                line={line}
                knownPurchaseType={knownPurchaseType}
                hasWishes={hasSelection}
                selected={line.trimId === activeTrimId}
                onSelect={setPreviewTrimId}
                index={index}
                total={analysis.trimLines.length}
                isLeading={hasSelection && index === 0 && line.matchPercent === topMatchPercent && topMatchPercent > 0}
                isJourney={isJourney}
                ctaLabel={equipmentCta.actionLabel}
                onContinue={handleTrimContinue}
              />
            ))}
          </div>
        </div>
      )}

      {hasSelection && analysis.hasPackages && analysis.packages?.length > 0 && (
        <div className="vd-eq-section">
          <h3 className="vd-eq-section__title">Empfohlene Pakete</h3>
          <div className="vd-eq-pkg-list">
            {analysis.packages.map((pkg) => (
              <article key={pkg.id} className="vd-eq-pkg">
                <p className="vd-eq-pkg__name">{pkg.name}</p>
                {pkg.description && (
                  <p className="vd-eq-pkg__desc">{pkg.description}</p>
                )}
              </article>
            ))}
          </div>
        </div>
      )}

      {activeRecommendation && (
        <aside
          className={`vd-eq-rec vd-eq-rec--highlight${isJourney ? ' vd-eq-rec--journey' : ''}`}
          aria-label="Unsere Empfehlung"
        >
          <h3 className="vd-eq-rec__title">Unsere Empfehlung</h3>
          <p className="vd-eq-rec__label">{activeRecommendation.label}</p>
          {activeRecommendation.reasons?.length > 0 && (
            <ul className="vd-eq-rec__reasons">
              {activeRecommendation.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          )}
          {activeRecommendation.uncertainNote && (
            <p className="vd-eq-rec__uncertain">{activeRecommendation.uncertainNote}</p>
          )}
          <div className="vd-eq-rec__actions">
            <button
              type="button"
              className="vd-btn vd-btn--primary vd-btn--block vd-eq-rec__cta"
              onClick={() => handleTrimContinue(activeTrimId)}
            >
              {equipmentCta.actionLabel}
            </button>
            {equipmentCta.actionHint && (
              <p className="vd-eq-rec__hint">{equipmentCta.actionHint}</p>
            )}
            {!isJourney && hasSelection && knownPurchaseType !== 'cash' && (
              <button
                type="button"
                className="vd-btn vd-btn--secondary vd-btn--block"
                onClick={() => onInquiry?.(activeRecommendation)}
              >
                Angebot mit dieser Ausstattung anfragen
              </button>
            )}
          </div>
        </aside>
      )}
    </section>
  );
}
