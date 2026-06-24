import { useMemo, useState } from 'react';
import {
  clampDiscount,
  PAYMENT_DISCOUNT_QUICK_VALUES,
  resolveModelSettings,
} from '../../services/dealer/dealerVehicleManagement.js';
import {
  buildTrimConditionsPatch,
  buildTrimConditionsPatchForAll,
  copyTrimSettingsPatch,
  formatTrimScopeLabel,
  getModelTrimLines,
  getTrimsWithPaymentData,
  resolveTrimSettings,
} from '../../services/dealer/dealerTrimConditions.js';
import DealerValidityFields from './DealerValidityFields.jsx';
import './DealerVehicleManagement.css';

function DiscountStepper({ label, icon, value, onChange, min, max }) {
  function adjust(delta) {
    onChange(clampDiscount((Number(value) || 0) + delta, min, max));
  }

  return (
    <div className="dvm-wizard-panel">
      <div className="dvm-discount-card__head">
        <span className="dvm-discount-card__icon" aria-hidden>{icon}</span>
        <span className="dvm-discount-card__label">{label}</span>
      </div>

      <div className="dvm-stepper dvm-stepper--large">
        <button type="button" className="dvm-stepper__btn" onClick={() => adjust(-1)} aria-label="Weniger">−</button>
        <div className="dvm-stepper__value">
          <span className="dvm-stepper__percent dvm-stepper__percent--hero">{Number(value) || 0} %</span>
        </div>
        <button type="button" className="dvm-stepper__btn" onClick={() => adjust(1)} aria-label="Mehr">+</button>
      </div>

      <div className="dvm-quick-btns">
        {PAYMENT_DISCOUNT_QUICK_VALUES.map((pct) => (
          <button
            key={pct}
            type="button"
            className={`dvm-quick-btn dvm-quick-btn--large${Number(value) === pct ? ' is-active' : ''}`}
            onClick={() => onChange(pct)}
          >
            {pct} %
          </button>
        ))}
      </div>
    </div>
  );
}

const PAYMENT_META = {
  cash: { label: 'Barzahlung', icon: '💶' },
  financing: { label: 'Finanzierung', icon: '🏦' },
};

export default function DealerModelPaymentConditions({
  model,
  conditions,
  paymentType,
  trimScope,
  onBack,
  onUpdateModelSettings,
  onUpdateDiscount,
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

  const otherTrimsWithData = useMemo(() => (
    getTrimsWithPaymentData(settings, paymentType, trims)
      .filter((trim) => trim.id !== activeTrimId)
  ), [settings, paymentType, trims, activeTrimId]);

  const meta = PAYMENT_META[paymentType] ?? PAYMENT_META.cash;
  const min = settings.discountMin ?? 0;
  const max = settings.discountMax ?? 50;
  const value = trimSettings.paymentDiscounts?.[paymentType] ?? 0;
  const scopeLabel = formatTrimScopeLabel(trimScope, trims);

  function patchTrim(partial) {
    if (trimScope?.mode === 'all') {
      onUpdateModelSettings?.(
        model.id,
        buildTrimConditionsPatchForAll(settings, trims.map((t) => t.id), partial),
      );
      return;
    }
    if (!trimScope?.trimId) {
      onUpdateModelSettings?.(model.id, partial);
      return;
    }
    onUpdateModelSettings?.(
      model.id,
      buildTrimConditionsPatch(settings, trimScope.trimId, partial),
    );
  }

  function handleDiscountChange(next) {
    const clamped = clampDiscount(next, min, max);
    patchTrim({ paymentDiscounts: { [paymentType]: clamped } });
    onUpdateDiscount?.(model.id, 'standard', clamped);
  }

  function handleCopyFrom(sourceTrimId) {
    if (!trimScope?.trimId || trimScope.mode === 'all') return;
    onUpdateModelSettings?.(
      model.id,
      copyTrimSettingsPatch(settings, sourceTrimId, trimScope.trimId),
    );
    setShowCopyPicker(false);
  }

  return (
    <div className="dvm-conditions">
      <button type="button" className="dvm-back" onClick={onBack}>
        ← Konditionen
      </button>

      <header className="dvm-conditions__head">
        <h2 className="dvm-conditions__title">{meta.label}</h2>
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
          Änderungen werden für alle Ausstattungslinien übernommen.
        </p>
      )}

      <DiscountStepper
        label="Händlerrabatt"
        icon={meta.icon}
        value={value}
        min={min}
        max={max}
        onChange={handleDiscountChange}
      />

      <div className="dvm-wizard-panel">
        <label className="dvm-field">
          <span className="dvm-field__label">Fixer Bonus (€)</span>
          <input
            type="number"
            className="dvm-field__input dvm-field__input--large"
            min={0}
            value={trimSettings.bonusAmount ?? ''}
            onChange={(e) => patchTrim({
              bonusAmount: e.target.value === '' ? null : Number(e.target.value),
            })}
            placeholder="optional"
          />
        </label>
      </div>

      <DealerValidityFields
        value={trimSettings}
        onChange={(partial) => patchTrim(partial)}
        compact
      />

      {trimScope?.mode === 'single' && otherTrimsWithData.length > 0 && (
        <div className="dvm-trim-copy">
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

      <p className="dvm-conditions__autosave">Änderungen werden automatisch als Entwurf gespeichert.</p>
    </div>
  );
}
