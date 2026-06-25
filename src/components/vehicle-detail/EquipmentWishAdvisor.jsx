import { useEffect, useMemo, useState } from 'react';
import { isChipSelected } from '../../data/features/equipmentWishChips.js';
import { formatCurrency } from '../../logic/marketplaceService.js';
import {
  getCustomerAdvisorStepCta,
  getEquipmentStepCta,
  getNeutralPriceTierLabel,
  resolveTrimPriceDisplay,
} from '../../services/dealer/equipmentStepPresentation.js';
import {
  analyzeEquipmentWishSelection,
  getEquipmentWishChipGroups,
  resolveActiveEquipmentRecommendation,
} from '../../services/configuration/equipmentWishAdvisor.js';
import {
  buildCustomerAssessmentSummary,
  buildCustomerWishPayload,
  CUSTOMER_ADVISOR_COPY,
  presentCustomerTrimLine,
} from '../../services/dealer/customerAdvisorPresentation.js';
import CustomerAdvisorCompletionCard from './CustomerAdvisorCompletionCard.jsx';
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
  isCustomerJourney = false,
  ctaLabel = '',
  onContinue,
}) {
  const price = isCustomerJourney
    ? { primary: line.roleLabel ?? line.description, secondary: null, neutral: true }
    : resolveTrimPriceDisplay({
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

  const displayDesc = isCustomerJourney
    ? line.roleLabel ?? line.description
    : (isJourney && !knownPurchaseType
      ? getNeutralPriceTierLabel(index, total)
      : line.description);

  return (
    <article
      data-trim-id={line.trimId}
      className={`vd-eq-trim${selected ? ' vd-eq-trim--selected' : ''}${line.recommended ? ' vd-eq-trim--recommended' : ''}${isLeading ? ' vd-eq-trim--leading' : ''}${isCustomerJourney ? ' vd-eq-trim--customer' : ''}`}
    >
      <button type="button" className="vd-eq-trim__head" onClick={() => onSelect?.(line.trimId)}>
        <div className="vd-eq-trim__title-row">
          <h4 className="vd-eq-trim__name">{line.trimName}</h4>
          {line.badge && !isCustomerJourney && (
            <span className="vd-eq-trim__badge">{line.badge}</span>
          )}
        </div>
        <p className="vd-eq-trim__desc">{displayDesc}</p>
        {hasWishes && line.matchPercent > 0 && !isCustomerJourney && (
          <MatchBar percent={line.matchPercent} />
        )}
        {!isCustomerJourney && (
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
        )}
      </button>
      {hasWishes && (line.fulfilledItems?.length > 0 || line.fulfilled?.length > 0 || line.missing?.length > 0 || line.uncertain?.length > 0 || line.openPoints?.length > 0) && (
        <div className="vd-eq-trim__details">
          {(line.fulfilledItems ?? line.fulfilled)?.length > 0 && (
            <>
              {isCustomerJourney && (
                <p className="vd-eq-trim__detail-heading">{line.fulfilledHeading ?? CUSTOMER_ADVISOR_COPY.fulfilledHeading}</p>
              )}
              <ul className="vd-eq-trim__list vd-eq-trim__list--ok">
                {(line.fulfilledItems ?? line.fulfilled).map((item) => (
                  <li key={item}><span aria-hidden>✓</span> {item}</li>
                ))}
              </ul>
            </>
          )}
          {isCustomerJourney && line.openPoints?.length > 0 && (
            <>
              <p className="vd-eq-trim__detail-heading">{line.checkHeading ?? CUSTOMER_ADVISOR_COPY.checkHeading}</p>
              <ul className="vd-eq-trim__list vd-eq-trim__list--uncertain">
                {line.openPoints.map((item) => (
                  <li key={item}><span aria-hidden>•</span> {item}</li>
                ))}
              </ul>
            </>
          )}
          {!isCustomerJourney && line.missing?.length > 0 && (
            <ul className="vd-eq-trim__list vd-eq-trim__list--miss">
              {line.missing.map((item) => (
                <li key={item}><span aria-hidden>○</span> {item}</li>
              ))}
            </ul>
          )}
          {!isCustomerJourney && line.uncertain?.length > 0 && (
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
      {isCustomerJourney && ctaLabel && onContinue && (
        <button
          type="button"
          className="vd-eq-trim__cta vd-btn vd-btn--primary vd-btn--block"
          onClick={() => onContinue(line.trimId)}
        >
          {ctaLabel}
        </button>
      )}
      {!isCustomerJourney && selected && isJourney && ctaLabel && onContinue && (
        <button
          type="button"
          className="vd-eq-trim__cta vd-btn vd-btn--primary vd-btn--block"
          onClick={() => onContinue(line.trimId)}
        >
          {ctaLabel}
        </button>
      )}
      {!isCustomerJourney && !selected && isJourney && isLeading && ctaLabel && onContinue && (
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
  modelLabel = '',
  selectedFeatures = [],
  searchedFeatures: searchedFeaturesProp,
  trimId,
  knownPurchaseType = null,
  paymentMode = 'leasing',
  variant = 'default',
  advisorPhase: advisorPhaseProp,
  onAdvisorPhaseChange,
  onToggleChip,
  onApplyRecommendation,
  onRecommendationChange,
  onSearchedFeaturesChange,
  onInquiry,
  onJourneyContinue,
  onCustomerWishReserve,
  onContactRequest,
}) {
  const [previewTrimId, setPreviewTrimId] = useState(null);
  const [internalSearched, setInternalSearched] = useState([]);
  const [internalPhase, setInternalPhase] = useState('wishes');
  const isJourney = variant === 'journey';
  const isCustomerJourney = isJourney;
  const searchedFeatures = searchedFeaturesProp ?? internalSearched;

  const phase = advisorPhaseProp ?? internalPhase;

  function setPhase(next) {
    if (advisorPhaseProp == null) setInternalPhase(next);
    onAdvisorPhaseChange?.(next);
  }

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
  const showAssessment = !isCustomerJourney || phase === 'assessment' || phase === 'completion';
  const hasSelection = selectedChipIds.length > 0 || searchedFeatures.length > 0;

  const analysis = useMemo(
    () => {
      if (isCustomerJourney && !showAssessment) {
        return {
          empty: false,
          hasWishes: hasSelection,
          hasPackages: false,
          trimLines: [],
          packages: [],
          recommendation: null,
        };
      }
      return analyzeEquipmentWishSelection(
        vehicle.brand,
        vehicle.model,
        selectedChipIds,
        {
          paymentType: effectivePaymentMode,
          selectedTrimId: previewTrimId ?? trimId,
          modelKey,
          searchedFeatures,
        },
      );
    },
    [
      vehicle.brand,
      vehicle.model,
      selectedChipIds,
      effectivePaymentMode,
      previewTrimId,
      trimId,
      modelKey,
      searchedFeatures,
      isCustomerJourney,
      showAssessment,
      hasSelection,
    ],
  );

  const chipGroups = useMemo(
    () => getEquipmentWishChipGroups(vehicle.brand, vehicle.model, modelKey, {
      customerJourney: isCustomerJourney,
    }),
    [vehicle.brand, vehicle.model, modelKey, isCustomerJourney],
  );

  const equipmentCta = isCustomerJourney
    ? getCustomerAdvisorStepCta(hasSelection)
    : getEquipmentStepCta(knownPurchaseType, analysis.hasWishes ?? hasSelection);

  const displayModelLabel = modelLabel || vehicle.model || 'Fahrzeug';

  const assessmentSummary = useMemo(
    () => (isCustomerJourney && showAssessment
      ? buildCustomerAssessmentSummary(analysis, displayModelLabel)
      : null),
    [isCustomerJourney, showAssessment, analysis, displayModelLabel],
  );

  const customerTrimLines = useMemo(
    () => (isCustomerJourney && showAssessment
      ? (analysis.trimLines ?? []).map((line, index, arr) => presentCustomerTrimLine(line, index, arr.length))
      : analysis.trimLines ?? []),
    [isCustomerJourney, showAssessment, analysis.trimLines],
  );

  const activeTrimId = previewTrimId ?? analysis.recommendation?.trimId ?? trimId;
  const activeRecommendation = useMemo(
    () => (showAssessment ? resolveActiveEquipmentRecommendation(analysis, activeTrimId) : null),
    [analysis, activeTrimId, showAssessment],
  );
  const trimOrderKey = customerTrimLines?.map((line) => line.trimId) ?? [];
  const trimListRef = useTrimCardShuffle(trimOrderKey);
  const topMatchPercent = hasSelection
    ? Math.max(0, ...(customerTrimLines?.map((line) => line.matchPercent) ?? []))
    : 0;

  useEffect(() => {
    if (!isJourney || !showAssessment || previewTrimId || !analysis.recommendation?.trimId) return;
    setPreviewTrimId(analysis.recommendation.trimId);
  }, [isJourney, showAssessment, previewTrimId, analysis.recommendation?.trimId]);

  useEffect(() => {
    if (!activeRecommendation || !showAssessment || phase === 'completion') return;
    onRecommendationChange?.(activeRecommendation);
  }, [activeRecommendation, onRecommendationChange, showAssessment, phase]);

  function handleShowAssessment() {
    if (!hasSelection) return;
    setPhase('assessment');
  }

  function handleReserveTrim(trimIdForReserve) {
    const line = customerTrimLines.find((l) => l.trimId === trimIdForReserve)
      ?? analysis.trimLines?.find((l) => l.trimId === trimIdForReserve);
    const payload = buildCustomerWishPayload({
      modelKey,
      modelLabel: displayModelLabel,
      selectedChipIds,
      searchedFeatures,
      analysis,
      reservedTrimId: trimIdForReserve,
      reservedTrimName: line?.trimName ?? null,
      possibleTrimIds: assessmentSummary?.trimIds ?? [],
      openCheckpoints: line?.openPoints ?? [],
    });

    setPreviewTrimId(trimIdForReserve);
    setPhase('completion');
    onCustomerWishReserve?.(payload);

    if (!isCustomerJourney) {
      handleTrimContinue(trimIdForReserve);
    }
  }

  function handleTrimContinue(trimIdForContinue) {
    const rec = resolveActiveEquipmentRecommendation(analysis, trimIdForContinue);
    if (!rec) return;
    if (isJourney) {
      onJourneyContinue?.(rec);
      return;
    }
    onApplyRecommendation?.(rec);
  }

  function handleEditWishes() {
    setPhase('wishes');
    setPreviewTrimId(null);
  }

  const completionDirection = assessmentSummary?.directionLabel ?? '';

  return (
    <section
      className={`vd-wish vd-wish--embedded vd-wish--equipment${isJourney ? ' vd-wish--portal' : ''}${isCustomerJourney ? ' vd-wish--customer-advisor' : ''}`}
      id="vd-wish-builder"
      aria-label="Ausstattungsberatung"
    >
      {(phase === 'wishes') && (
        <div className="vd-wish__intro">
          <h2 className="vd-wish__title">
            {isCustomerJourney
              ? CUSTOMER_ADVISOR_COPY.wishesHeadline(displayModelLabel)
              : (isJourney ? 'Welche Variante passt besser?' : 'Welche Ausstattung passt zu Ihnen?')}
          </h2>
          {isCustomerJourney ? (
            <p className="vd-wish__question vd-wish__subline">
              {CUSTOMER_ADVISOR_COPY.wishesSubline}
            </p>
          ) : !isJourney && (
            <p className="vd-wish__question vd-wish__subline">
              Wählen Sie aus, was Ihnen wichtig ist – Clever grenzt die passende Richtung ein.
            </p>
          )}
        </div>
      )}

      {phase === 'wishes' && chipGroups.map((group) => (
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

      {phase === 'wishes' && (
        <EquipmentFeatureSearch
          brand={vehicle.brand}
          model={vehicle.model}
          modelKey={modelKey}
          selectedFeatureIds={selectedFeatures}
          searchedFeatures={searchedFeatures}
          onAddSearchedFeature={handleAddSearchedFeature}
          onRemoveSearchedFeature={handleRemoveSearchedFeature}
        />
      )}

      {!chipGroups.length && phase === 'wishes' && (
        <p className="vd-eq-empty">
          Für dieses Modell sind noch keine Ausstattungsdetails hinterlegt.
          Bitte wenden Sie sich an das Autohaus.
        </p>
      )}

      {isCustomerJourney && phase === 'wishes' && (
        <div className="vd-customer-advisor-actions">
          <button
            type="button"
            className="vd-btn vd-btn--primary vd-btn--block"
            disabled={!hasSelection}
            onClick={handleShowAssessment}
          >
            {equipmentCta.actionLabel}
          </button>
          {equipmentCta.actionHint && (
            <p className="vd-eq-rec__hint">{equipmentCta.actionHint}</p>
          )}
        </div>
      )}

      {isCustomerJourney && phase === 'assessment' && assessmentSummary && (
        <aside className="vd-eq-rec vd-eq-rec--customer" aria-label="Clever Einschätzung">
          <h3 className="vd-eq-rec__title">{assessmentSummary.headline}</h3>
          <p className="vd-eq-rec__label">{assessmentSummary.directionLabel}</p>
          {assessmentSummary.reasons?.length > 0 && (
            <>
              <p className="vd-eq-rec__why">Warum?</p>
              <ul className="vd-eq-rec__reasons">
                {assessmentSummary.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </>
          )}
          <p className="vd-eq-rec__disclaimer">{CUSTOMER_ADVISOR_COPY.disclaimer}</p>
          <button
            type="button"
            className="vd-btn vd-btn--ghost vd-btn--block vd-customer-advisor-edit"
            onClick={handleEditWishes}
          >
            {CUSTOMER_ADVISOR_COPY.editCta}
          </button>
        </aside>
      )}

      {showAssessment && customerTrimLines?.length > 0 && phase !== 'completion' && (
        <div className="vd-eq-section">
          {!isJourney && !isCustomerJourney && (
            <h3 className="vd-eq-section__title">Ihre passende Variante</h3>
          )}
          {isCustomerJourney && (
            <h3 className="vd-eq-section__title">Mögliche Richtungen</h3>
          )}
          {!hasSelection && !isJourney && !isCustomerJourney && (
            <p className="vd-eq-section__lead">
              Wählen Sie Wünsche aus – Clever grenzt die passende Richtung ein.
            </p>
          )}
          <div className="vd-eq-trim-list" ref={trimListRef}>
            {customerTrimLines.map((line, index) => (
              <TrimLineCard
                key={line.trimId}
                line={line}
                knownPurchaseType={knownPurchaseType}
                hasWishes={hasSelection}
                selected={line.trimId === activeTrimId}
                onSelect={setPreviewTrimId}
                index={index}
                total={customerTrimLines.length}
                isLeading={hasSelection && index === 0 && line.matchPercent === topMatchPercent && topMatchPercent > 0}
                isJourney={isJourney}
                isCustomerJourney={isCustomerJourney}
                ctaLabel={isCustomerJourney ? equipmentCta.reserveLabel : equipmentCta.actionLabel}
                onContinue={isCustomerJourney ? handleReserveTrim : handleTrimContinue}
              />
            ))}
          </div>
        </div>
      )}

      {!isCustomerJourney && hasSelection && analysis.hasPackages && analysis.packages?.length > 0 && (
        <div className="vd-eq-section">
          <h3 className="vd-eq-section__title">Passende Pakete</h3>
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

      {!isCustomerJourney && activeRecommendation && (
        <aside
          className={`vd-eq-rec vd-eq-rec--highlight${isJourney ? ' vd-eq-rec--journey' : ''}`}
          aria-label="Clever Einschätzung"
        >
          <h3 className="vd-eq-rec__title">Clever Einschätzung</h3>
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
                Zur Anfrage hinzufügen
              </button>
            )}
          </div>
        </aside>
      )}

      {isCustomerJourney && phase === 'completion' && (
        <CustomerAdvisorCompletionCard
          directionLabel={completionDirection}
          onContactRequest={() => onContactRequest?.()}
          onEdit={handleEditWishes}
        />
      )}
    </section>
  );
}
