import { useEffect, useMemo, useState } from 'react';
import {
  clampResidualPercentInput,
  FINANCE_RESIDUAL_TERMS,
  formatFinanceResidualTermLabel,
  formatResidualSummaryLine,
  getFinanceResidualProgress,
  getFinanceResidualStatus,
  getFinanceResidualValue,
  getNextPendingResidualTerm,
  getTrimsWithResidualData,
  suggestResidualPercent,
} from '../../services/dealer/dealerFinanceResiduals.js';
import { resolveModelSettings } from '../../services/dealer/dealerVehicleManagement.js';
import {
  buildTrimConditionsPatch,
  buildTrimConditionsPatchForAll,
  formatTrimScopeLabel,
  getModelTrimLines,
  resolveTrimSettings,
} from '../../services/dealer/dealerTrimConditions.js';
import './DealerVehicleManagement.css';

const STEPS = {
  TRIM: 'trim',
  TERM: 'term',
  VALUE: 'value',
  SUMMARY: 'summary',
};

export default function DealerModelFinanceResidualsWizard({
  model,
  conditions,
  onBack,
  onUpdateFinanceResidual,
  onUpdateModelSettings,
  onPublish,
}) {
  const [showCopyPicker, setShowCopyPicker] = useState(false);
  const [showTransferPicker, setShowTransferPicker] = useState(false);

  const trims = useMemo(() => getModelTrimLines(model), [model]);
  const hasTrims = trims.length > 0;
  const settings = useMemo(
    () => resolveModelSettings(conditions, model.id),
    [conditions, model.id],
  );

  const [trimScope, setTrimScope] = useState(
    hasTrims ? null : { mode: 'single', trimId: null },
  );

  const activeTrimId = trimScope?.mode === 'all'
    ? trims[0]?.id
    : (trimScope?.trimId ?? null);

  const trimSettings = useMemo(
    () => resolveTrimSettings(settings, activeTrimId),
    [settings, activeTrimId],
  );

  const skippedMap = trimSettings.financeResidualsSkipped ?? {};

  const progress = useMemo(
    () => getFinanceResidualProgress(conditions, model.id, skippedMap, activeTrimId),
    [conditions, model.id, skippedMap, activeTrimId],
  );

  const otherTrimsWithData = useMemo(() => (
    getTrimsWithResidualData(conditions, model.id, settings, trims)
      .filter((trim) => trim.id !== activeTrimId)
  ), [conditions, model.id, settings, trims, activeTrimId]);

  const scopeLabel = formatTrimScopeLabel(trimScope, trims);

  const [step, setStep] = useState(hasTrims ? STEPS.TRIM : STEPS.TERM);
  const [term, setTerm] = useState(null);
  const [percentInput, setPercentInput] = useState('');

  useEffect(() => {
    if (progress.isComplete && step !== STEPS.SUMMARY && trimScope) {
      setStep(STEPS.SUMMARY);
    }
  }, [progress.isComplete, step, trimScope]);

  function patchSkipped(nextMap) {
    if (trimScope?.mode === 'all') {
      onUpdateModelSettings?.(
        model.id,
        buildTrimConditionsPatchForAll(settings, trims.map((t) => t.id), {
          financeResidualsSkipped: nextMap,
        }),
      );
      return;
    }
    if (trimScope?.trimId) {
      onUpdateModelSettings?.(
        model.id,
        buildTrimConditionsPatch(settings, trimScope.trimId, {
          financeResidualsSkipped: nextMap,
        }),
      );
      return;
    }
    onUpdateModelSettings?.(model.id, { financeResidualsSkipped: nextMap });
  }

  function applyResidual(targetTrimId, nextTerm, percent) {
    onUpdateFinanceResidual?.(model.id, targetTrimId, nextTerm, percent);
  }

  function applyResidualToScope(nextTerm, percent) {
    if (trimScope?.mode === 'all') {
      for (const trim of trims) {
        applyResidual(trim.id, nextTerm, percent);
      }
      return;
    }
    applyResidual(trimScope?.trimId ?? null, nextTerm, percent);
  }

  function loadPercentForTerm(nextTerm) {
    const existing = getFinanceResidualValue(
      conditions,
      model.id,
      nextTerm,
      activeTrimId,
    );
    setPercentInput(existing != null ? String(existing) : '');
  }

  function handleTrimSelect(scope) {
    setTrimScope(scope);
    const firstPending = getNextPendingResidualTerm(
      conditions,
      model.id,
      {},
      null,
      scope.mode === 'all' ? trims[0]?.id : scope.trimId,
    );
    if (firstPending) {
      setTerm(firstPending);
      loadPercentForTerm(firstPending);
      setStep(STEPS.VALUE);
    } else {
      setStep(STEPS.TERM);
    }
  }

  function handleTermSelect(nextTerm) {
    setTerm(nextTerm);
    loadPercentForTerm(nextTerm);
    setStep(STEPS.VALUE);
  }

  function advanceAfterAction(currentTerm) {
    const next = getNextPendingResidualTerm(
      conditions,
      model.id,
      skippedMap,
      currentTerm,
      activeTrimId,
    );
    if (next) {
      setTerm(next);
      loadPercentForTerm(next);
      setStep(STEPS.VALUE);
    } else {
      setStep(STEPS.SUMMARY);
    }
  }

  function handleSave() {
    const percent = clampResidualPercentInput(percentInput);
    if (percent == null) return;

    applyResidualToScope(term, percent);

    const termKey = String(term);
    if (skippedMap[termKey]) {
      const nextSkipped = { ...skippedMap };
      delete nextSkipped[termKey];
      patchSkipped(nextSkipped);
    }

    setTimeout(() => advanceAfterAction(term), 120);
  }

  function handleSkip() {
    const termKey = String(term);
    patchSkipped({ ...skippedMap, [termKey]: true });
    applyResidualToScope(term, null);

    setTimeout(() => advanceAfterAction(term), 120);
  }

  function handleTransferToRemaining() {
    const percent = clampResidualPercentInput(percentInput);
    if (percent == null) return;

    for (const t of FINANCE_RESIDUAL_TERMS) {
      if (t === term) continue;
      const status = getFinanceResidualStatus(
        conditions,
        model.id,
        t,
        skippedMap,
        activeTrimId,
      );
      if (status === 'pending') {
        applyResidualToScope(t, percent);
      }
    }
    setShowTransferPicker(false);
    setTimeout(() => advanceAfterAction(term), 120);
  }

  function handleCopyFrom(sourceTrimId) {
    if (!trimScope?.trimId || trimScope.mode === 'all') return;

    const sourceSettings = resolveTrimSettings(settings, sourceTrimId);
    onUpdateModelSettings?.(
      model.id,
      buildTrimConditionsPatch(settings, trimScope.trimId, {
        financeResidualsSkipped: { ...sourceSettings.financeResidualsSkipped },
      }),
    );

    for (const t of FINANCE_RESIDUAL_TERMS) {
      const value = getFinanceResidualValue(conditions, model.id, t, sourceTrimId);
      onUpdateFinanceResidual?.(model.id, trimScope.trimId, t, value);
    }

    setShowCopyPicker(false);
  }

  function handleContinueEditing() {
    const next = getNextPendingResidualTerm(
      conditions,
      model.id,
      skippedMap,
      null,
      activeTrimId,
    );
    if (!next) return;
    setTerm(null);
    setPercentInput('');
    setStep(STEPS.TERM);
  }

  function trimMeta(trimId) {
    const trimSkipped = resolveTrimSettings(settings, trimId).financeResidualsSkipped ?? {};
    const rp = getFinanceResidualProgress(conditions, model.id, trimSkipped, trimId);
    return rp.filled > 0
      ? `${rp.filled} von ${rp.total} gepflegt`
      : 'Noch nicht gepflegt';
  }

  const progressPct = progress.total
    ? Math.round((progress.filled / progress.total) * 100)
    : 0;

  const suggestion = term != null ? suggestResidualPercent(term) : null;

  return (
    <div className="dvm-conditions dvm-residuals-wizard">
      <button type="button" className="dvm-back" onClick={onBack}>
        ← Finanzierung
      </button>

      <header className="dvm-conditions__head">
        <h2 className="dvm-conditions__title">Schlussraten</h2>
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
          Schlussraten werden für alle Ausstattungslinien gleichzeitig gesetzt.
        </p>
      )}

      {trimScope && (
        <div className="dvm-lf-progress" aria-live="polite">
          <div className="dvm-lf-progress__bar">
            <span className="dvm-lf-progress__fill" style={{ width: `${progressPct}%` }} />
          </div>
          <p className="dvm-lf-progress__text">
            {progress.filled} von {progress.total} Schlussraten gepflegt
          </p>
        </div>
      )}

      {step === STEPS.TRIM && hasTrims && (
        <section className="dvm-wizard-step">
          <p className="dvm-wizard-step__kicker">Schritt 1 von 3</p>
          <h3 className="dvm-wizard-step__title">Für welche Ausstattung gelten die Werte?</h3>
          <div className="dvm-trim-picker">
            {trims.map((trim) => (
              <button
                key={trim.id}
                type="button"
                className="dvm-trim-picker__option"
                onClick={() => handleTrimSelect({ mode: 'single', trimId: trim.id })}
              >
                <span className="dvm-trim-picker__name">{trim.name}</span>
                <span className="dvm-trim-picker__meta">{trimMeta(trim.id)}</span>
              </button>
            ))}
            <button
              type="button"
              className="dvm-trim-picker__option dvm-trim-picker__option--all"
              onClick={() => handleTrimSelect({ mode: 'all', trimId: null })}
            >
              <span className="dvm-trim-picker__name">Alle Ausstattungen</span>
              <span className="dvm-trim-picker__meta">Werte auf alle Linien übernehmen</span>
            </button>
          </div>
        </section>
      )}

      {step === STEPS.TERM && trimScope && (
        <section className="dvm-wizard-step">
          <p className="dvm-wizard-step__kicker">Schritt {hasTrims ? 2 : 1} von 3</p>
          <h3 className="dvm-wizard-step__title">Laufzeit wählen</h3>
          <div className="dvm-wizard-options">
            {FINANCE_RESIDUAL_TERMS.map((t) => {
              const status = getFinanceResidualStatus(
                conditions,
                model.id,
                t,
                skippedMap,
                activeTrimId,
              );
              const value = getFinanceResidualValue(
                conditions,
                model.id,
                t,
                activeTrimId,
              );
              return (
                <button
                  key={t}
                  type="button"
                  className={`dvm-wizard-option${status === 'filled' ? ' is-done' : ''}${status === 'skipped' ? ' is-skipped' : ''}`}
                  onClick={() => handleTermSelect(t)}
                >
                  <span>{formatFinanceResidualTermLabel(t)}</span>
                  {status === 'filled' && value != null && (
                    <span className="dvm-wizard-option__badge">{value} %</span>
                  )}
                  {status === 'skipped' && (
                    <span className="dvm-wizard-option__badge">übersprungen</span>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {step === STEPS.VALUE && term != null && (
        <section className="dvm-wizard-step">
          <p className="dvm-wizard-step__kicker">Schritt {hasTrims ? 3 : 2} von 3</p>
          <h3 className="dvm-wizard-step__title">Schlussrate eingeben</h3>
          <p className="dvm-wizard-step__context">
            {formatFinanceResidualTermLabel(term)}
            {suggestion != null && (
              <> · Beispiel: {suggestion} %</>
            )}
          </p>

          <div className="dvm-lf-factor dvm-residual-input">
            <input
              type="text"
              inputMode="decimal"
              className="dvm-lf-factor__input"
              value={percentInput}
              onChange={(e) => setPercentInput(e.target.value)}
              placeholder={suggestion != null ? String(suggestion) : 'z. B. 55'}
              autoFocus
            />
            <span className="dvm-lf-factor__hint">Restwert in Prozent vom Fahrzeugpreis</span>
          </div>

          <div className="dvm-wizard-actions">
            <button
              type="button"
              className="dvm-wizard-actions__primary"
              onClick={handleSave}
              disabled={clampResidualPercentInput(percentInput) == null}
            >
              Speichern
            </button>
            <button type="button" className="dvm-wizard-actions__ghost" onClick={handleSkip}>
              Überspringen
            </button>
          </div>

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

          <div className="dvm-trim-copy dvm-trim-copy--inline">
            <button
              type="button"
              className="dvm-trim-copy__btn"
              onClick={() => setShowTransferPicker((v) => !v)}
              disabled={clampResidualPercentInput(percentInput) == null}
            >
              Auf weitere Laufzeiten übertragen
            </button>
            {showTransferPicker && (
              <p className="dvm-residual-transfer-hint">
                Der Wert wird auf alle noch offenen Laufzeiten übernommen.
              </p>
            )}
            {showTransferPicker && (
              <button
                type="button"
                className="dvm-wizard-actions__ghost dvm-residual-transfer-confirm"
                onClick={handleTransferToRemaining}
              >
                Jetzt übertragen
              </button>
            )}
          </div>

          <button type="button" className="dvm-wizard-link" onClick={() => setStep(STEPS.TERM)}>
            Laufzeit ändern
          </button>
        </section>
      )}

      {step === STEPS.SUMMARY && (
        <section className="dvm-wizard-step dvm-wizard-step--summary">
          <h3 className="dvm-wizard-step__title">Passt das so?</h3>

          <ul className="dvm-lf-summary-list">
            {FINANCE_RESIDUAL_TERMS.map((t) => {
              const status = getFinanceResidualStatus(
                conditions,
                model.id,
                t,
                skippedMap,
                activeTrimId,
              );
              const value = getFinanceResidualValue(
                conditions,
                model.id,
                t,
                activeTrimId,
              );
              return (
                <li
                  key={t}
                  className={`dvm-lf-summary-item dvm-lf-summary-item--${status}`}
                >
                  <span>
                    {status === 'filled' && value != null
                      ? `✓ ${formatResidualSummaryLine(t, value)}`
                      : status === 'skipped'
                        ? `⚪ ${formatFinanceResidualTermLabel(t)} → übersprungen`
                        : `○ ${formatFinanceResidualTermLabel(t)} → noch nicht gepflegt`}
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
