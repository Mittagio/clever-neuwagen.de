import { useEffect, useMemo, useState } from 'react';
import {
  buildFinancingWizardCombos,
  clampEuroInput,
  clampPercentInput,
  clampRateInput,
  financeComboKey,
  formatFinanceDownPaymentLabel,
  formatFinanceSummaryValue,
  formatFinanceTermLabel,
  FINANCING_WIZARD_DOWN_PAYMENTS,
  FINANCING_WIZARD_TERMS,
  getFinanceComboStatus,
  getFinanceConditionValue,
  getFinancingWizardProgress,
  getNextPendingFinanceCombo,
  normalizeFinanceCondition,
} from '../../services/dealer/dealerFinancingWizard.js';
import {
  clampDiscount,
  PAYMENT_DISCOUNT_QUICK_VALUES,
  resolveModelSettings,
} from '../../services/dealer/dealerVehicleManagement.js';
import {
  buildTrimConditionsPatch,
  buildTrimConditionsPatchForAll,
  formatTrimScopeLabel,
  getModelTrimLines,
  getTrimsWithFinanceData,
  resolveTrimSettings,
} from '../../services/dealer/dealerTrimConditions.js';
import './DealerVehicleManagement.css';

const STEPS = {
  TERM: 'term',
  DOWN: 'down',
  RATES: 'rates',
  FINAL: 'final',
  BONUS: 'bonus',
  SUMMARY: 'summary',
};

export default function DealerModelFinancingWizard({
  model,
  conditions,
  trimScope,
  onBack,
  onUpdateFinanceCondition,
  onUpdateModelSettings,
  onPreview,
  onPublish,
}) {
  const [showCopyPicker, setShowCopyPicker] = useState(false);
  const [customDownMode, setCustomDownMode] = useState(false);
  const [customDownInput, setCustomDownInput] = useState('');

  const trims = useMemo(() => getModelTrimLines(model), [model]);
  const settings = useMemo(
    () => resolveModelSettings(conditions, model.id),
    [conditions, model.id],
  );

  const activeTrimId = trimScope?.mode === 'all'
    ? trims[0]?.id
    : trimScope?.trimId;

  const trimSettings = useMemo(
    () => resolveTrimSettings(settings, activeTrimId),
    [settings, activeTrimId],
  );

  const skippedMap = trimSettings.financeWizardSkipped ?? {};

  const progress = useMemo(
    () => getFinancingWizardProgress(conditions, model.id, skippedMap, activeTrimId),
    [conditions, model.id, skippedMap, activeTrimId],
  );

  const otherTrimsWithData = useMemo(() => (
    getTrimsWithFinanceData(conditions, model.id, settings, trims)
      .filter((trim) => trim.id !== activeTrimId)
  ), [conditions, model.id, settings, trims, activeTrimId]);

  const scopeLabel = formatTrimScopeLabel(trimScope, trims);
  const listPrice = settings.listPrice ?? 40000;

  const [step, setStep] = useState(STEPS.TERM);
  const [term, setTerm] = useState(null);
  const [downPayment, setDownPayment] = useState(null);
  const [effectiveInput, setEffectiveInput] = useState('');
  const [nominalInput, setNominalInput] = useState('');
  const [finalEuroInput, setFinalEuroInput] = useState('');
  const [finalPercentInput, setFinalPercentInput] = useState('');
  const [finalMode, setFinalMode] = useState('percent');
  const [discountValue, setDiscountValue] = useState(trimSettings.paymentDiscounts?.financing ?? 0);
  const [bonusValue, setBonusValue] = useState(trimSettings.bonusAmount ?? '');

  const combos = useMemo(() => buildFinancingWizardCombos(), []);

  useEffect(() => {
    if (progress.isComplete && step !== STEPS.SUMMARY) {
      setStep(STEPS.SUMMARY);
    }
  }, [progress.isComplete, step]);

  useEffect(() => {
    setDiscountValue(trimSettings.paymentDiscounts?.financing ?? 0);
    setBonusValue(trimSettings.bonusAmount ?? '');
  }, [trimSettings]);

  function patchSkipped(nextMap) {
    if (trimScope?.mode === 'all') {
      onUpdateModelSettings?.(
        model.id,
        buildTrimConditionsPatchForAll(settings, trims.map((t) => t.id), {
          financeWizardSkipped: nextMap,
        }),
      );
      return;
    }
    if (trimScope?.trimId) {
      onUpdateModelSettings?.(
        model.id,
        buildTrimConditionsPatch(settings, trimScope.trimId, {
          financeWizardSkipped: nextMap,
        }),
      );
      return;
    }
    onUpdateModelSettings?.(model.id, { financeWizardSkipped: nextMap });
  }

  function patchTrimBonus(partial) {
    if (trimScope?.mode === 'all') {
      onUpdateModelSettings?.(
        model.id,
        buildTrimConditionsPatchForAll(settings, trims.map((t) => t.id), partial),
      );
      return;
    }
    if (trimScope?.trimId) {
      onUpdateModelSettings?.(
        model.id,
        buildTrimConditionsPatch(settings, trimScope.trimId, partial),
      );
    }
  }

  function applyFinanceCondition(targetTrimId, nextTerm, nextDown, condition) {
    onUpdateFinanceCondition?.(model.id, targetTrimId, nextTerm, nextDown, condition);
  }

  function loadConditionForSelection(nextTerm, nextDown) {
    const existing = getFinanceConditionValue(
      conditions,
      model.id,
      nextTerm,
      nextDown,
      activeTrimId,
    );
    setEffectiveInput(existing?.effectiveRate != null ? String(existing.effectiveRate) : '');
    setNominalInput(existing?.nominalRate != null ? String(existing.nominalRate) : '');
    setFinalEuroInput(existing?.finalPaymentEuro != null ? String(existing.finalPaymentEuro) : '');
    setFinalPercentInput(existing?.finalPaymentPercent != null ? String(existing.finalPaymentPercent) : '');
    setFinalMode(existing?.finalPaymentEuro != null ? 'euro' : 'percent');
  }

  function startCombo(combo) {
    if (!combo) {
      setStep(STEPS.SUMMARY);
      return;
    }
    setTerm(combo.term);
    setDownPayment(combo.downPayment);
    setCustomDownMode(false);
    loadConditionForSelection(combo.term, combo.downPayment);
    setStep(STEPS.RATES);
  }

  function handleTermSelect(nextTerm) {
    setTerm(nextTerm);
    setDownPayment(null);
    setStep(STEPS.DOWN);
  }

  function handleDownSelect(nextDown) {
    setDownPayment(nextDown);
    setCustomDownMode(false);
    loadConditionForSelection(term, nextDown);
    setStep(STEPS.RATES);
  }

  function handleCustomDownContinue() {
    const custom = clampEuroInput(customDownInput);
    if (custom == null) return;
    setDownPayment(custom);
    loadConditionForSelection(term, custom);
    setStep(STEPS.RATES);
  }

  function advanceAfterAction(currentCombo) {
    const next = getNextPendingFinanceCombo(
      conditions,
      model.id,
      skippedMap,
      currentCombo,
      activeTrimId,
    );
    if (next) {
      startCombo(next);
    } else {
      setStep(STEPS.SUMMARY);
    }
  }

  function buildConditionFromInputs() {
    const effectiveRate = clampRateInput(effectiveInput);
    const nominalRate = clampRateInput(nominalInput);
    const finalPaymentEuro = finalMode === 'euro' ? clampEuroInput(finalEuroInput) : null;
    const finalPaymentPercent = finalMode === 'percent'
      ? clampPercentInput(finalPercentInput)
      : null;

    if (effectiveRate == null) return null;
    if (finalPaymentEuro == null && finalPaymentPercent == null) return null;

    return normalizeFinanceCondition({
      effectiveRate,
      nominalRate,
      finalPaymentEuro,
      finalPaymentPercent,
    });
  }

  function handleSave() {
    const condition = buildConditionFromInputs();
    if (!condition) return;

    if (trimScope?.mode === 'all') {
      for (const trim of trims) {
        applyFinanceCondition(trim.id, term, downPayment, condition);
      }
    } else {
      applyFinanceCondition(trimScope?.trimId ?? activeTrimId, term, downPayment, condition);
    }

    patchTrimBonus({
      paymentDiscounts: { financing: clampDiscount(discountValue) },
      bonusAmount: bonusValue === '' ? null : Number(bonusValue),
    });

    const key = financeComboKey(term, downPayment);
    if (skippedMap[key]) {
      const nextSkipped = { ...skippedMap };
      delete nextSkipped[key];
      patchSkipped(nextSkipped);
    }

    setTimeout(() => {
      advanceAfterAction({ term, downPayment });
    }, 120);
  }

  function handleSkip() {
    const key = financeComboKey(term, downPayment);
    patchSkipped({ ...skippedMap, [key]: true });
    applyFinanceCondition(
      trimScope?.trimId ?? activeTrimId,
      term,
      downPayment,
      null,
    );

    setTimeout(() => {
      advanceAfterAction({ term, downPayment });
    }, 120);
  }

  function handleContinueEditing() {
    const next = getNextPendingFinanceCombo(conditions, model.id, skippedMap, null, activeTrimId);
    if (!next) return;
    setTerm(null);
    setDownPayment(null);
    setStep(STEPS.TERM);
  }

  function handleCopyFrom(sourceTrimId) {
    if (!trimScope?.trimId || trimScope.mode === 'all') return;

    const sourceSettings = resolveTrimSettings(settings, sourceTrimId);
    onUpdateModelSettings?.(
      model.id,
      buildTrimConditionsPatch(settings, trimScope.trimId, {
        financeWizardSkipped: { ...sourceSettings.financeWizardSkipped },
        paymentDiscounts: { financing: sourceSettings.paymentDiscounts?.financing },
        bonusAmount: sourceSettings.bonusAmount,
      }),
    );

    for (const { term: t, downPayment: d } of combos) {
      const value = getFinanceConditionValue(conditions, model.id, t, d, sourceTrimId);
      if (value) {
        onUpdateFinanceCondition?.(model.id, trimScope.trimId, t, d, value);
      }
    }

    setShowCopyPicker(false);
  }

  const progressPct = progress.total
    ? Math.round((progress.filled / progress.total) * 100)
    : 0;

  const canSave = buildConditionFromInputs() != null;

  return (
    <div className="dvm-conditions dvm-finance-wizard">
        <button type="button" className="dvm-back" onClick={onBack}>
        ← Finanzierung
      </button>

      <header className="dvm-conditions__head">
        <h2 className="dvm-conditions__title">Finanzierung</h2>
        <p className="dvm-conditions__sub">
          {model.name}
          {trimScope && (
            <>
              {' · '}
              <span className="dvm-trim-scope">{scopeLabel}</span>
            </>
          )}
        </p>
      </header>

      {trimScope?.mode === 'all' && (
        <p className="dvm-trim-scope-hint">
          Finanzierungskonditionen werden für alle Ausstattungslinien gleichzeitig gesetzt.
        </p>
      )}

      {trimScope?.mode === 'single' && otherTrimsWithData.length > 0 && (
        <div className="dvm-trim-copy dvm-trim-copy--inline">
          <button
            type="button"
            className="dvm-trim-copy__btn"
            onClick={() => setShowCopyPicker((v) => !v)}
          >
            Von anderer Ausstattung übernehmen
          </button>
          {showCopyPicker && (
            <div className="dvm-trim-copy__picker">
              {otherTrimsWithData.map((trim) => (
                <button
                  key={trim.id}
                  type="button"
                  className="dvm-trim-copy__option"
                  onClick={() => handleCopyFrom(trim.id)}
                >
                  {trim.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="dvm-lf-progress" aria-live="polite">
        <div className="dvm-lf-progress__bar">
          <span className="dvm-lf-progress__fill" style={{ width: `${progressPct}%` }} />
        </div>
        <p className="dvm-lf-progress__text">
          {progress.filled} von {progress.total} Finanzierungskonditionen gepflegt
        </p>
      </div>

      {step === STEPS.TERM && (
        <section className="dvm-wizard-step">
          <p className="dvm-wizard-step__kicker">Schritt 1 von 5</p>
          <h3 className="dvm-wizard-step__title">Laufzeit wählen</h3>
          <div className="dvm-wizard-options">
            {FINANCING_WIZARD_TERMS.map((t) => (
              <button
                key={t}
                type="button"
                className="dvm-wizard-option"
                onClick={() => handleTermSelect(t)}
              >
                {formatFinanceTermLabel(t)}
              </button>
            ))}
          </div>
        </section>
      )}

      {step === STEPS.DOWN && term != null && (
        <section className="dvm-wizard-step">
          <p className="dvm-wizard-step__kicker">Schritt 2 von 5</p>
          <h3 className="dvm-wizard-step__title">Anzahlung wählen</h3>
          <p className="dvm-wizard-step__context">{formatFinanceTermLabel(term)}</p>
          <div className="dvm-wizard-options dvm-wizard-options--grid">
            {FINANCING_WIZARD_DOWN_PAYMENTS.map((d) => {
              const status = getFinanceComboStatus(
                conditions, model.id, term, d, skippedMap, activeTrimId,
              );
              return (
                <button
                  key={d}
                  type="button"
                  className={`dvm-wizard-option${status === 'filled' ? ' is-done' : ''}${status === 'skipped' ? ' is-skipped' : ''}`}
                  onClick={() => handleDownSelect(d)}
                >
                  {formatFinanceDownPaymentLabel(d)}
                  {status === 'filled' && <span className="dvm-wizard-option__badge">✓</span>}
                  {status === 'skipped' && <span className="dvm-wizard-option__badge">⚪</span>}
                </button>
              );
            })}
          </div>
          {!customDownMode ? (
            <button
              type="button"
              className="dvm-wizard-link"
              onClick={() => setCustomDownMode(true)}
            >
              Eigener Betrag
            </button>
          ) : (
            <div className="dvm-finance-custom-down">
              <input
                type="number"
                className="dvm-field__input dvm-field__input--large"
                min={0}
                value={customDownInput}
                onChange={(e) => setCustomDownInput(e.target.value)}
                placeholder="z. B. 2500"
              />
              <button
                type="button"
                className="dvm-wizard-actions__primary"
                onClick={handleCustomDownContinue}
              >
                Weiter
              </button>
            </div>
          )}
          <button type="button" className="dvm-wizard-link" onClick={() => setStep(STEPS.TERM)}>
            Laufzeit ändern
          </button>
        </section>
      )}

      {step === STEPS.RATES && term != null && downPayment != null && (
        <section className="dvm-wizard-step">
          <p className="dvm-wizard-step__kicker">Schritt 3 von 5</p>
          <h3 className="dvm-wizard-step__title">Zinssatz eingeben</h3>
          <p className="dvm-wizard-step__context">
            {formatFinanceTermLabel(term)} · {formatFinanceDownPaymentLabel(downPayment)}
          </p>
          <div className="dvm-finance-rate-grid">
            <label className="dvm-field">
              <span className="dvm-field__label">Effektiver Jahreszins (%)</span>
              <input
                type="text"
                inputMode="decimal"
                className="dvm-field__input dvm-field__input--large"
                value={effectiveInput}
                onChange={(e) => setEffectiveInput(e.target.value)}
                placeholder="z. B. 4,99"
                autoFocus
              />
            </label>
            <label className="dvm-field">
              <span className="dvm-field__label">Sollzins optional (%)</span>
              <input
                type="text"
                inputMode="decimal"
                className="dvm-field__input dvm-field__input--large"
                value={nominalInput}
                onChange={(e) => setNominalInput(e.target.value)}
                placeholder="optional"
              />
            </label>
          </div>
          <button type="button" className="dvm-wizard-actions__primary" onClick={() => setStep(STEPS.FINAL)}>
            Weiter zur Schlussrate
          </button>
          <button type="button" className="dvm-wizard-link" onClick={() => setStep(STEPS.DOWN)}>
            Anzahlung ändern
          </button>
        </section>
      )}

      {step === STEPS.FINAL && term != null && downPayment != null && (
        <section className="dvm-wizard-step">
          <p className="dvm-wizard-step__kicker">Schritt 4 von 5</p>
          <h3 className="dvm-wizard-step__title">Schlussrate eingeben</h3>
          <p className="dvm-wizard-step__context">
            {formatFinanceTermLabel(term)} · {formatFinanceDownPaymentLabel(downPayment)}
          </p>
          <div className="dvm-chips dvm-chips--wrap">
            <button
              type="button"
              className={`dvm-chip${finalMode === 'percent' ? ' is-active' : ''}`}
              onClick={() => setFinalMode('percent')}
            >
              In %
            </button>
            <button
              type="button"
              className={`dvm-chip${finalMode === 'euro' ? ' is-active' : ''}`}
              onClick={() => setFinalMode('euro')}
            >
              In €
            </button>
          </div>
          {finalMode === 'percent' ? (
            <label className="dvm-field">
              <span className="dvm-field__label">Schlussrate (% vom Hauspreis)</span>
              <input
                type="text"
                inputMode="decimal"
                className="dvm-field__input dvm-field__input--large"
                value={finalPercentInput}
                onChange={(e) => setFinalPercentInput(e.target.value)}
                placeholder="z. B. 35"
              />
            </label>
          ) : (
            <label className="dvm-field">
              <span className="dvm-field__label">Schlussrate (€)</span>
              <input
                type="text"
                inputMode="decimal"
                className="dvm-field__input dvm-field__input--large"
                value={finalEuroInput}
                onChange={(e) => setFinalEuroInput(e.target.value)}
                placeholder="z. B. 12000"
              />
            </label>
          )}
          <button type="button" className="dvm-wizard-actions__primary" onClick={() => setStep(STEPS.BONUS)}>
            Weiter zu Bonus / Rabatt
          </button>
        </section>
      )}

      {step === STEPS.BONUS && term != null && downPayment != null && (
        <section className="dvm-wizard-step">
          <p className="dvm-wizard-step__kicker">Schritt 5 von 5</p>
          <h3 className="dvm-wizard-step__title">Bonus & Rabatt</h3>
          <p className="dvm-wizard-step__context">
            Gilt für diese Ausstattung ({scopeLabel})
          </p>

          <div className="dvm-wizard-panel">
            <label className="dvm-field">
              <span className="dvm-field__label">Rabatt in %</span>
              <input
                type="number"
                className="dvm-field__input dvm-field__input--large"
                min={0}
                max={50}
                value={discountValue}
                onChange={(e) => setDiscountValue(Number(e.target.value) || 0)}
              />
            </label>
            <div className="dvm-quick-btns">
              {PAYMENT_DISCOUNT_QUICK_VALUES.map((pct) => (
                <button
                  key={pct}
                  type="button"
                  className={`dvm-quick-btn dvm-quick-btn--large${Number(discountValue) === pct ? ' is-active' : ''}`}
                  onClick={() => setDiscountValue(pct)}
                >
                  {pct} %
                </button>
              ))}
            </div>
            <label className="dvm-field">
              <span className="dvm-field__label">Bonusbetrag in €</span>
              <input
                type="number"
                className="dvm-field__input dvm-field__input--large"
                min={0}
                value={bonusValue}
                onChange={(e) => setBonusValue(e.target.value)}
                placeholder="optional"
              />
            </label>
          </div>

          <div className="dvm-wizard-actions">
            <button
              type="button"
              className="dvm-wizard-actions__primary"
              onClick={handleSave}
              disabled={!canSave}
            >
              Speichern
            </button>
            <button type="button" className="dvm-wizard-actions__ghost" onClick={handleSkip}>
              Überspringen
            </button>
          </div>

          <button type="button" className="dvm-wizard-link" onClick={() => setStep(STEPS.FINAL)}>
            Schlussrate ändern
          </button>
        </section>
      )}

      {step === STEPS.SUMMARY && (
        <section className="dvm-wizard-step dvm-wizard-step--summary">
          <h3 className="dvm-wizard-step__title">Passt das so?</h3>

          <ul className="dvm-lf-summary-stats">
            <li>✓ {progress.filled} Werte gepflegt</li>
            <li>⚪ {progress.skipped} Werte übersprungen</li>
            {progress.pending > 0 && (
              <li className="dvm-lf-summary-stats__pending">
                {progress.pending} noch nicht gepflegt
              </li>
            )}
          </ul>

          <ul className="dvm-lf-summary-list">
            {combos.map(({ term: t, downPayment: d }) => {
              const status = getFinanceComboStatus(
                conditions, model.id, t, d, skippedMap, activeTrimId,
              );
              const value = getFinanceConditionValue(
                conditions, model.id, t, d, activeTrimId,
              );
              return (
                <li
                  key={financeComboKey(t, d)}
                  className={`dvm-lf-summary-item dvm-lf-summary-item--${status}`}
                >
                  <span>
                    {formatFinanceTermLabel(t)} · {formatFinanceDownPaymentLabel(d)}
                  </span>
                  <span>
                    {status === 'filled'
                      ? formatFinanceSummaryValue(value, listPrice)
                      : status === 'skipped'
                        ? 'übersprungen'
                        : 'noch nicht gepflegt'}
                  </span>
                </li>
              );
            })}
          </ul>

          <div className="dvm-wizard-actions">
            {onPreview && (
              <button type="button" className="dvm-wizard-actions__primary" onClick={onPreview}>
                Vorschau prüfen
              </button>
            )}
            {onPublish && (
              <button type="button" className="dvm-wizard-actions__ghost" onClick={onPublish}>
                Veröffentlichen
              </button>
            )}
            <button type="button" className="dvm-wizard-actions__ghost" onClick={handleContinueEditing}>
              Weiter bearbeiten
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
