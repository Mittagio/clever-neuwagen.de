import { useMemo, useState } from 'react';
import {
  CLEVER_BERATUNG_STEPS,
  VEHICLE_TYPE_IMAGE_KEYS,
  getAssistantModelImage,
} from '../../data/dealerAiStartFlows.js';
import {
  getBudgetChipsForPaymentType,
  getCleverBudgetSectionLabel,
  getCleverBudgetStepHint,
  getCleverBudgetStepTitle,
  paymentTypeFromChipId,
  paymentTypeFromChipIds,
} from '../../services/dealerAiBudget.js';
import './DealerAiStart.css';

function pickStepChipIds(stepIndex, selections) {
  const step = CLEVER_BERATUNG_STEPS[stepIndex];
  if (!step) return [];
  const picked = selections[step.id];
  if (!picked) return [];
  if (step.multi) return Array.isArray(picked) ? picked : [];
  return picked.skip ? [] : [picked.id];
}

function StepChipGrid({ chips, activeId, activeIds, multi, onSelect }) {
  return (
    <div className="dai-chip-grid">
      {chips.map((chip) => {
        const active = multi
          ? activeIds?.includes(chip.id)
          : activeId === chip.id;
        return (
          <button
            key={chip.id}
            type="button"
            className={`dai-chip${active ? ' is-active' : ''}`}
            onClick={() => onSelect(chip)}
            aria-pressed={active}
          >
            <span className="dai-chip__emoji" aria-hidden>{chip.emoji}</span>
            <span className="dai-chip__label">{chip.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default function DealerAiCleverBeratung({ onBack, onEvaluate, isAnalyzing = false }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [selections, setSelections] = useState({});

  const step = CLEVER_BERATUNG_STEPS[stepIndex];
  const isLast = stepIndex === CLEVER_BERATUNG_STEPS.length - 1;
  const picked = selections[step?.id];

  const budgetPaymentType = useMemo(() => {
    const paymentPick = selections.paymentType;
    if (paymentPick && !paymentPick.skip) {
      const fromSelection = paymentTypeFromChipId(paymentPick.id);
      if (fromSelection && fromSelection !== 'unknown') return fromSelection;
    }
    const chipIds = CLEVER_BERATUNG_STEPS.flatMap((_, idx) => pickStepChipIds(idx, selections));
    return paymentTypeFromChipIds(chipIds);
  }, [selections]);

  const stepChips = useMemo(() => {
    if (step?.id === 'budget') {
      return getBudgetChipsForPaymentType(budgetPaymentType);
    }
    return step?.chips ?? [];
  }, [step, budgetPaymentType]);

  const stepTitle = step?.id === 'budget'
    ? getCleverBudgetStepTitle(budgetPaymentType)
    : step?.title;

  const stepHint = step?.id === 'budget'
    ? getCleverBudgetStepHint(budgetPaymentType)
    : step?.hint;

  const stepSectionLabel = step?.id === 'budget'
    ? getCleverBudgetSectionLabel(budgetPaymentType)
    : step?.sectionLabel;

  const allChipIds = useMemo(() => {
    const ids = [];
    CLEVER_BERATUNG_STEPS.forEach((_, idx) => {
      ids.push(...pickStepChipIds(idx, selections));
    });
    return [...new Set(ids)];
  }, [selections]);

  function selectChip(chip) {
    if (!step) return;
    if (chip.skip) {
      setSelections((prev) => ({ ...prev, [step.id]: chip }));
      return;
    }
    if (step.multi) {
      setSelections((prev) => {
        const current = prev[step.id] ?? [];
        const next = current.includes(chip.id)
          ? current.filter((id) => id !== chip.id)
          : [...current, chip.id];
        return { ...prev, [step.id]: next };
      });
      return;
    }
    if (step.id === 'paymentType') {
      setSelections((prev) => {
        const next = { ...prev, [step.id]: chip };
        delete next.budget;
        return next;
      });
      return;
    }
    setSelections((prev) => ({ ...prev, [step.id]: chip }));
  }

  function isChipActive(chip) {
    if (!picked) return false;
    if (step.multi) return Array.isArray(picked) && picked.includes(chip.id);
    return picked.id === chip.id;
  }

  function goNext() {
    if (isLast) {
      onEvaluate?.(allChipIds);
      return;
    }
    setStepIndex((i) => Math.min(i + 1, CLEVER_BERATUNG_STEPS.length - 1));
  }

  function goBack() {
    if (stepIndex === 0) {
      onBack?.();
      return;
    }
    setStepIndex((i) => Math.max(0, i - 1));
  }

  function skipStep() {
    setSelections((prev) => ({ ...prev, [step.id]: null }));
    goNext();
  }

  return (
    <section className="dai-advice" aria-label="Clever-Beratung">
      <header className="dai-advice-hero">
        <button type="button" className="dai-flow__back" onClick={goBack}>
          ‹ Zurück
        </button>
        <div className="dai-advice-hero__row">
          <div>
            <h1 className="dai-advice-hero__title">Clever-Beratung</h1>
            <p className="dai-advice-hero__sub">Schritt für Schritt zum passenden Fahrzeug.</p>
          </div>
          <div className="dai-advice-hero__art" aria-hidden>🚗</div>
        </div>
      </header>

      <div className="dai-advice-card">
        <div className="dai-advice-step">
          <div className="dai-advice-step__head">
            <span className="dai-advice-step__num">{stepIndex + 1}</span>
            <div className="dai-advice-step__labels">
              <span className="dai-advice-step__section">
                {stepSectionLabel}
                {step.sectionOptional ? ' (optional)' : ''}
              </span>
              <span className="dai-advice-step__progress">
                {stepIndex + 1} von {CLEVER_BERATUNG_STEPS.length}
              </span>
            </div>
          </div>

          <h2 className="dai-advice-step__title">{stepTitle}</h2>
          {stepHint && <p className="dai-advice-step__hint">{stepHint}</p>}

          {step.layout === 'vehicle-cards' && (
            <div className="dai-vehicle-grid">
              {step.chips.map((chip) => {
                const active = isChipActive(chip);
                const imageKey = VEHICLE_TYPE_IMAGE_KEYS[chip.id];
                const imageUrl = imageKey ? getAssistantModelImage(imageKey) : null;
                return (
                  <button
                    key={chip.id}
                    type="button"
                    className={`dai-vehicle-card${active ? ' is-active' : ''}`}
                    onClick={() => selectChip(chip)}
                    aria-pressed={active}
                  >
                    {active && <span className="dai-vehicle-card__check" aria-hidden>✓</span>}
                    {imageUrl ? (
                      <img src={imageUrl} alt="" className="dai-vehicle-card__img" loading="lazy" />
                    ) : (
                      <span className="dai-vehicle-card__emoji" aria-hidden>{chip.emoji}</span>
                    )}
                    <span className="dai-vehicle-card__label">{chip.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {step.layout === 'powertrain-row' && (
            <div className="dai-powertrain-row">
              {step.chips.filter((c) => !c.skip).map((chip) => {
                const active = isChipActive(chip);
                return (
                  <button
                    key={chip.id}
                    type="button"
                    className={`dai-powertrain${active ? ' is-active' : ''}`}
                    onClick={() => selectChip(chip)}
                    aria-pressed={active}
                  >
                    <span className="dai-powertrain__icon" aria-hidden>{chip.emoji}</span>
                    <span className="dai-powertrain__label">{chip.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {step.layout === 'chips' && (
            <StepChipGrid
              chips={stepChips}
              activeId={!step.multi && picked && !picked.skip ? picked.id : null}
              activeIds={step.multi && Array.isArray(picked) ? picked : []}
              multi={step.multi}
              onSelect={selectChip}
            />
          )}
        </div>

        <div className="dai-advice-actions">
          <button
            type="button"
            className="dai-cta dai-cta--primary"
            onClick={goNext}
            disabled={isAnalyzing}
          >
            {isLast
              ? (isAnalyzing ? 'Wird ausgewertet …' : 'Kundenwunsch auswerten')
              : 'Weiter'}
            {!isLast && <span className="dai-cta__arrow" aria-hidden>→</span>}
          </button>
          <button
            type="button"
            className="dai-advice-skip"
            onClick={skipStep}
            disabled={isAnalyzing}
          >
            Überspringen
          </button>
        </div>
      </div>
    </section>
  );
}
