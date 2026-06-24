import { useEffect, useMemo, useState } from 'react';
import {
  buildLeasingWizardCombos,
  clampLeasingFactorInput,
  comboKey,
  formatWizardKmLabel,
  formatWizardTermLabel,
  getComboStatus,
  getLeasingFactorValue,
  getLeasingWizardProgress,
  getNextPendingCombo,
  LEASING_WIZARD_MILEAGES,
  LEASING_WIZARD_TERMS,
} from '../../services/dealer/dealerLeasingWizard.js';
import { resolveModelSettings } from '../../services/dealer/dealerVehicleManagement.js';
import {
  buildTrimConditionsPatch,
  buildTrimConditionsPatchForAll,
  formatTrimScopeLabel,
  getModelTrimLines,
  getTrimsWithLeasingData,
  resolveTrimSettings,
} from '../../services/dealer/dealerTrimConditions.js';
import './DealerVehicleManagement.css';

const STEPS = {
  TERM: 'term',
  KM: 'km',
  FACTOR: 'factor',
  SUMMARY: 'summary',
};

export default function DealerModelLeasingWizard({
  model,
  conditions,
  trimScope,
  onBack,
  onUpdateLeasingFactor,
  onUpdateModelSettings,
  onPublish,
}) {
  const [showCopyPicker, setShowCopyPicker] = useState(false);

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

  const skippedMap = trimSettings.leasingFactorSkipped ?? {};

  const progress = useMemo(
    () => getLeasingWizardProgress(conditions, model.id, skippedMap, activeTrimId),
    [conditions, model.id, skippedMap, activeTrimId],
  );

  const otherTrimsWithData = useMemo(() => (
    getTrimsWithLeasingData(conditions, model.id, settings, trims)
      .filter((trim) => trim.id !== activeTrimId)
  ), [conditions, model.id, settings, trims, activeTrimId]);

  const scopeLabel = formatTrimScopeLabel(trimScope, trims);

  const [step, setStep] = useState(STEPS.TERM);
  const [term, setTerm] = useState(null);
  const [km, setKm] = useState(null);
  const [factorInput, setFactorInput] = useState('');

  const combos = useMemo(() => buildLeasingWizardCombos(), []);

  useEffect(() => {
    if (progress.isComplete && step !== STEPS.SUMMARY) {
      setStep(STEPS.SUMMARY);
    }
  }, [progress.isComplete, step]);

  function patchSkipped(nextMap) {
    if (trimScope?.mode === 'all') {
      onUpdateModelSettings?.(
        model.id,
        buildTrimConditionsPatchForAll(settings, trims.map((t) => t.id), {
          leasingFactorSkipped: nextMap,
        }),
      );
      return;
    }
    if (trimScope?.trimId) {
      onUpdateModelSettings?.(
        model.id,
        buildTrimConditionsPatch(settings, trimScope.trimId, {
          leasingFactorSkipped: nextMap,
        }),
      );
      return;
    }
    onUpdateModelSettings?.(model.id, { leasingFactorSkipped: nextMap });
  }

  function applyLeasingFactor(nextTerm, nextKm, factor) {
    if (trimScope?.mode === 'all') {
      for (const trim of trims) {
        onUpdateLeasingFactor?.(model.id, nextTerm, nextKm, factor, trim.id);
      }
      return;
    }
    onUpdateLeasingFactor?.(
      model.id,
      nextTerm,
      nextKm,
      factor,
      trimScope?.trimId ?? null,
    );
  }

  function loadFactorForSelection(nextTerm, nextKm) {
    const existing = getLeasingFactorValue(
      conditions,
      model.id,
      nextTerm,
      nextKm,
      activeTrimId,
    );
    setFactorInput(existing != null ? String(existing) : '');
  }

  function startCombo(combo) {
    if (!combo) {
      setStep(STEPS.SUMMARY);
      return;
    }
    setTerm(combo.term);
    setKm(combo.km);
    loadFactorForSelection(combo.term, combo.km);
    setStep(STEPS.FACTOR);
  }

  function handleTermSelect(nextTerm) {
    setTerm(nextTerm);
    setKm(null);
    setStep(STEPS.KM);
  }

  function handleKmSelect(nextKm) {
    setKm(nextKm);
    loadFactorForSelection(term, nextKm);
    setStep(STEPS.FACTOR);
  }

  function advanceAfterAction(currentCombo) {
    const next = getNextPendingCombo(
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

  function handleSave() {
    const factor = clampLeasingFactorInput(factorInput);
    if (factor == null) return;

    applyLeasingFactor(term, km, factor);

    const key = comboKey(term, km);
    if (skippedMap[key]) {
      const nextSkipped = { ...skippedMap };
      delete nextSkipped[key];
      patchSkipped(nextSkipped);
    }

    setTimeout(() => {
      advanceAfterAction({ term, km });
    }, 120);
  }

  function handleSkip() {
    const key = comboKey(term, km);
    patchSkipped({ ...skippedMap, [key]: true });
    applyLeasingFactor(term, km, null);

    setTimeout(() => {
      advanceAfterAction({ term, km });
    }, 120);
  }

  function handleContinueEditing() {
    const next = getNextPendingCombo(conditions, model.id, skippedMap, null, activeTrimId);
    if (!next) return;
    setTerm(null);
    setKm(null);
    setFactorInput('');
    setStep(STEPS.TERM);
  }

  function handleCopyFrom(sourceTrimId) {
    if (!trimScope?.trimId || trimScope.mode === 'all') return;

    const sourceSettings = resolveTrimSettings(settings, sourceTrimId);
    onUpdateModelSettings?.(
      model.id,
      buildTrimConditionsPatch(settings, trimScope.trimId, {
        leasingFactorSkipped: { ...sourceSettings.leasingFactorSkipped },
      }),
    );

    for (const { term: t, km: m } of combos) {
      const value = getLeasingFactorValue(conditions, model.id, t, m, sourceTrimId);
      onUpdateLeasingFactor?.(model.id, t, m, value, trimScope.trimId);
    }

    setShowCopyPicker(false);
  }

  const progressPct = progress.total
    ? Math.round((progress.filled / progress.total) * 100)
    : 0;

  return (
    <div className="dvm-conditions dvm-leasing-wizard">
      <button type="button" className="dvm-back" onClick={onBack}>
        ← Konditionen
      </button>

      <header className="dvm-conditions__head">
        <h2 className="dvm-conditions__title">Leasing</h2>
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
          Leasingfaktoren werden für alle Ausstattungslinien gleichzeitig gesetzt.
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
          {progress.filled} von {progress.total} Faktoren gepflegt
        </p>
      </div>

      {step === STEPS.TERM && (
        <section className="dvm-wizard-step">
          <p className="dvm-wizard-step__kicker">Schritt 1 von 3</p>
          <h3 className="dvm-wizard-step__title">Laufzeit wählen</h3>
          <div className="dvm-wizard-options">
            {LEASING_WIZARD_TERMS.map((t) => (
              <button
                key={t}
                type="button"
                className="dvm-wizard-option"
                onClick={() => handleTermSelect(t)}
              >
                {formatWizardTermLabel(t)}
              </button>
            ))}
          </div>
        </section>
      )}

      {step === STEPS.KM && term != null && (
        <section className="dvm-wizard-step">
          <p className="dvm-wizard-step__kicker">Schritt 2 von 3</p>
          <h3 className="dvm-wizard-step__title">Kilometer wählen</h3>
          <p className="dvm-wizard-step__context">{formatWizardTermLabel(term)}</p>
          <div className="dvm-wizard-options dvm-wizard-options--grid">
            {LEASING_WIZARD_MILEAGES.map((m) => {
              const status = getComboStatus(
                conditions,
                model.id,
                term,
                m,
                skippedMap,
                activeTrimId,
              );
              return (
                <button
                  key={m}
                  type="button"
                  className={`dvm-wizard-option${status === 'filled' ? ' is-done' : ''}${status === 'skipped' ? ' is-skipped' : ''}`}
                  onClick={() => handleKmSelect(m)}
                >
                  {formatWizardKmLabel(m)}
                  {status === 'filled' && <span className="dvm-wizard-option__badge">✓</span>}
                  {status === 'skipped' && <span className="dvm-wizard-option__badge">⚪</span>}
                </button>
              );
            })}
          </div>
          <button type="button" className="dvm-wizard-link" onClick={() => setStep(STEPS.TERM)}>
            Laufzeit ändern
          </button>
        </section>
      )}

      {step === STEPS.FACTOR && term != null && km != null && (
        <section className="dvm-wizard-step">
          <p className="dvm-wizard-step__kicker">Schritt 3 von 3</p>
          <h3 className="dvm-wizard-step__title">Leasingfaktor eingeben</h3>
          <p className="dvm-wizard-step__context">
            {formatWizardTermLabel(term)} · {formatWizardKmLabel(km)}
          </p>

          <div className="dvm-lf-factor">
            <input
              type="text"
              inputMode="decimal"
              className="dvm-lf-factor__input"
              value={factorInput}
              onChange={(e) => setFactorInput(e.target.value)}
              placeholder="z. B. 0,64"
              autoFocus
            />
            <span className="dvm-lf-factor__hint">Dezimalwert, z. B. 0,64</span>
          </div>

          <div className="dvm-wizard-actions">
            <button
              type="button"
              className="dvm-wizard-actions__primary"
              onClick={handleSave}
              disabled={clampLeasingFactorInput(factorInput) == null}
            >
              Speichern
            </button>
            <button type="button" className="dvm-wizard-actions__ghost" onClick={handleSkip}>
              Überspringen
            </button>
          </div>

          <button type="button" className="dvm-wizard-link" onClick={() => setStep(STEPS.KM)}>
            Kilometer ändern
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
            {combos.map(({ term: t, km: m }) => {
              const status = getComboStatus(
                conditions,
                model.id,
                t,
                m,
                skippedMap,
                activeTrimId,
              );
              const value = getLeasingFactorValue(
                conditions,
                model.id,
                t,
                m,
                activeTrimId,
              );
              return (
                <li
                  key={comboKey(t, m)}
                  className={`dvm-lf-summary-item dvm-lf-summary-item--${status}`}
                >
                  <span>{formatWizardTermLabel(t)} · {formatWizardKmLabel(m)}</span>
                  <span>
                    {status === 'filled' && value != null
                      ? value.toLocaleString('de-DE')
                      : status === 'skipped'
                        ? 'übersprungen'
                        : 'noch nicht gepflegt'}
                  </span>
                </li>
              );
            })}
          </ul>

          <div className="dvm-wizard-actions">
            {onPublish && (
              <button type="button" className="dvm-wizard-actions__primary" onClick={onPublish}>
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
