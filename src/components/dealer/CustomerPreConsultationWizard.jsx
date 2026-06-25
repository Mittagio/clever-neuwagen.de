import { useMemo, useState } from 'react';
import EquipmentFeatureSearch from '../vehicle-detail/EquipmentFeatureSearch.jsx';
import {
  PRECONSULT_COPY,
  PRECONSULT_EQUIPMENT_OPTIONS,
  PRECONSULT_PRIORITY_OPTIONS,
  PRECONSULT_STEPS,
  PRECONSULT_USAGE_OPTIONS,
} from '../../data/dealer/customerPreConsultationSteps.js';
import {
  buildModelTypeLine,
  buildPreConsultationSummaryLines,
  buildPreConsultationWishPayload,
  inferPreConsultationDirection,
} from '../../services/dealer/customerPreConsultationService.js';
import './customer-pre-consultation.css';

function toggleId(list, id) {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

function ChoiceGrid({ options, selected, onToggle, large = false }) {
  return (
    <div className={`cpc-choices${large ? ' cpc-choices--large' : ''}`}>
      {options.map((option) => {
        const active = selected.includes(option.id);
        return (
          <button
            key={option.id}
            type="button"
            className={`cpc-choice${active ? ' cpc-choice--active' : ''}`}
            onClick={() => onToggle(option.id)}
            aria-pressed={active}
          >
            {active && <span className="cpc-choice__check" aria-hidden>✓</span>}
            <span className="cpc-choice__label">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function StepProgress({ step }) {
  const activeSteps = PRECONSULT_STEPS.filter((s) => s !== 'intro' && s !== 'result');
  const index = activeSteps.indexOf(step);
  if (index < 0) return null;

  return (
    <div className="cpc-progress" aria-label="Beratungsfortschritt">
      {activeSteps.map((s, i) => (
        <span
          key={s}
          className={`cpc-progress__dot${i <= index ? ' cpc-progress__dot--active' : ''}`}
          title={PRECONSULT_COPY.stepLabels[s]}
        />
      ))}
      <span className="cpc-progress__label">
        Schritt
        {' '}
        {index + 1}
        {' '}
        von
        {' '}
        {activeSteps.length}
      </span>
    </div>
  );
}

/**
 * Kurze Vorberatung nach Modellinteresse – keine Variantenkarten, kein Katalog.
 */
export default function CustomerPreConsultationWizard({
  modelKey,
  modelLabel,
  vehicle = { brand: 'Kia', model: '' },
  prefilledPriorityIds = [],
  dealerId = null,
  dealerName = null,
  onContactRequest,
  onWishPayloadChange,
  onSpecialQuestionSubmit,
  onStepChange,
}) {
  const [step, setStep] = useState('intro');
  const [priorityIds, setPriorityIds] = useState(prefilledPriorityIds);
  const [usageIds, setUsageIds] = useState([]);
  const [equipmentIds, setEquipmentIds] = useState([]);
  const [searchedFeatures, setSearchedFeatures] = useState([]);

  const modelTypeLine = useMemo(() => buildModelTypeLine(modelKey), [modelKey]);
  const shortModel = modelLabel?.replace(/^Kia\s+/i, '') ?? modelKey?.toUpperCase();

  function goTo(nextStep) {
    setStep(nextStep);
    onStepChange?.(nextStep);
  }

  const direction = useMemo(() => {
    if (step !== 'result') return null;
    return inferPreConsultationDirection({
      brand: vehicle.brand,
      model: vehicle.model,
      modelKey,
      chipIds: buildPreConsultationWishPayload({
        modelKey,
        modelLabel,
        priorityIds,
        usageIds,
        equipmentIds,
        brand: vehicle.brand,
        model: vehicle.model,
      }).selectedChipIds,
      searchedFeatures,
      modelLabel,
    });
  }, [step, vehicle, modelKey, modelLabel, priorityIds, usageIds, equipmentIds, searchedFeatures]);

  const summaryLines = useMemo(
    () => buildPreConsultationSummaryLines({
      modelLabel,
      priorityIds,
      usageIds,
      equipmentIds,
      searchedFeatures,
      openCheckpoints: direction?.openCheckpoints ?? [],
    }),
    [modelLabel, priorityIds, usageIds, equipmentIds, searchedFeatures, direction],
  );

  function buildPayload() {
    return buildPreConsultationWishPayload({
      modelKey,
      modelLabel,
      priorityIds,
      usageIds,
      equipmentIds,
      searchedFeatures,
      brand: vehicle.brand,
      model: vehicle.model,
    });
  }

  function handleShowResult() {
    const payload = buildPayload();
    onWishPayloadChange?.(payload);
    goTo('result');
  }

  function handleContact() {
    const payload = buildPayload();
    onWishPayloadChange?.(payload);
    onContactRequest?.(payload);
  }

  function handleEdit() {
    goTo('priorities');
  }

  if (step === 'intro') {
    return (
      <section className="cpc-wizard" aria-label="Vorberatung">
        <div className="cpc-intro">
          <p className="cpc-intro__model">{modelLabel}</p>
          {modelTypeLine && (
            <p className="cpc-intro__type">{modelTypeLine}</p>
          )}
          <h2 className="cpc-intro__title">{PRECONSULT_COPY.introHeadline}</h2>
          <p className="cpc-intro__sub">{PRECONSULT_COPY.introSubline}</p>
          <button
            type="button"
            className="vd-btn vd-btn--primary vd-btn--block cpc-intro__cta"
            onClick={() => goTo('priorities')}
          >
            {PRECONSULT_COPY.introCta}
          </button>
        </div>
      </section>
    );
  }

  if (step === 'result') {
    return (
      <section className="cpc-wizard cpc-wizard--result" aria-label="Beratungszusammenfassung">
        <h2 className="cpc-result__title">{PRECONSULT_COPY.resultHeadline}</h2>

        <div className="cpc-result__wish">
          <p className="cpc-result__wish-label">{PRECONSULT_COPY.resultWishLabel}</p>
          <ul className="cpc-result__wish-list">
            {summaryLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>

        {direction?.directionText && (
          <div className="cpc-result__direction">
            <p className="cpc-result__direction-title">{PRECONSULT_COPY.resultDirectionTitle}</p>
            <p className="cpc-result__direction-value">{direction.directionText}</p>
          </div>
        )}

        <p className="cpc-result__lead">{PRECONSULT_COPY.resultLead}</p>
        <p className="cpc-result__hint">{PRECONSULT_COPY.resultHint}</p>

        <div className="cpc-result__actions">
          <button
            type="button"
            className="vd-btn vd-btn--primary vd-btn--block"
            onClick={handleContact}
          >
            {PRECONSULT_COPY.contactCta}
          </button>
          <button
            type="button"
            className="vd-btn vd-btn--secondary vd-btn--block"
            onClick={handleEdit}
          >
            {PRECONSULT_COPY.editCta}
          </button>
        </div>
      </section>
    );
  }

  const canContinuePriorities = priorityIds.length > 0;
  const canShowResult = priorityIds.length > 0 || usageIds.length > 0 || equipmentIds.length > 0;

  return (
    <section className="cpc-wizard" aria-label="Vorberatung">
      <StepProgress step={step} />

      <p className="cpc-wizard__model-line">
        {shortModel}
        {modelTypeLine && (
          <span className="cpc-wizard__model-type">
            {' '}
            ·
            {' '}
            {modelTypeLine}
          </span>
        )}
      </p>

      {step === 'priorities' && (
        <div className="cpc-step">
          <h2 className="cpc-step__question">{PRECONSULT_COPY.prioritiesQuestion}</h2>
          <ChoiceGrid
            options={PRECONSULT_PRIORITY_OPTIONS}
            selected={priorityIds}
            onToggle={(id) => setPriorityIds((prev) => toggleId(prev, id))}
            large
          />
          <button
            type="button"
            className="vd-btn vd-btn--primary vd-btn--block cpc-step__cta"
            disabled={!canContinuePriorities}
            onClick={() => goTo('usage')}
          >
            {PRECONSULT_COPY.nextCta}
          </button>
        </div>
      )}

      {step === 'usage' && (
        <div className="cpc-step">
          <h2 className="cpc-step__question">{PRECONSULT_COPY.usageQuestion}</h2>
          <ChoiceGrid
            options={PRECONSULT_USAGE_OPTIONS}
            selected={usageIds}
            onToggle={(id) => setUsageIds((prev) => toggleId(prev, id))}
            large
          />
          <button
            type="button"
            className="vd-btn vd-btn--primary vd-btn--block cpc-step__cta"
            onClick={() => goTo('equipment')}
          >
            {PRECONSULT_COPY.nextCta}
          </button>
        </div>
      )}

      {step === 'equipment' && (
        <div className="cpc-step">
          <h2 className="cpc-step__question">{PRECONSULT_COPY.equipmentQuestion}</h2>
          <p className="cpc-step__optional">{PRECONSULT_COPY.equipmentOptional}</p>
          <ChoiceGrid
            options={PRECONSULT_EQUIPMENT_OPTIONS}
            selected={equipmentIds}
            onToggle={(id) => setEquipmentIds((prev) => toggleId(prev, id))}
          />
          <EquipmentFeatureSearch
            brand={vehicle.brand}
            model={vehicle.model}
            modelKey={modelKey}
            dealerId={dealerId}
            dealerName={dealerName}
            selectedFeatureIds={equipmentIds}
            searchedFeatures={searchedFeatures}
            onAddSearchedFeature={(item) => setSearchedFeatures((prev) => [...prev, item])}
            onRemoveSearchedFeature={(id) => setSearchedFeatures((prev) => prev.filter((f) => f.id !== id))}
            onSpecialQuestionSubmit={({ contact, specialCustomerQuestion }) => {
              const payload = buildPayload();
              onSpecialQuestionSubmit?.({
                contact,
                specialCustomerQuestion,
                customerWish: payload,
              });
            }}
          />
          <button
            type="button"
            className="vd-btn vd-btn--primary vd-btn--block cpc-step__cta"
            disabled={!canShowResult}
            onClick={handleShowResult}
          >
            {PRECONSULT_COPY.showSummaryCta}
          </button>
        </div>
      )}
    </section>
  );
}
