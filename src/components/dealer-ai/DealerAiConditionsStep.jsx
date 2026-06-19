import { useMemo } from 'react';
import {
  DEALER_AI_DELIVERY_DATE_OPTIONS,
  DEALER_AI_MILEAGE_OPTIONS,
  DEALER_AI_PAYMENT_OPTIONS,
  DEALER_AI_TERM_OPTIONS,
  PAYMENT_TYPE_LABELS,
} from '../../services/dealerAiParser.js';
import {
  buildBudgetPriceOptions,
  buildBudgetRateOptions,
  buildDownPaymentOptions,
} from '../../services/dealerAiMailExtractor.js';
import { buildOfferPreview } from '../../services/dealerAiVehicleConfigureFlow.js';
import './DealerAiConditionsStep.css';

function SelectField({ label, value, options, onChange, formatOption, hint }) {
  return (
    <label className="dai-cond-field">
      <span className="dai-cond-field__label">{label}</span>
      {hint && <span className="dai-cond-field__hint">{hint}</span>}
      <select
        className="dai-cond-field__select"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((opt) => {
          const id = typeof opt === 'object' ? opt.id : opt;
          const optLabel = formatOption
            ? formatOption(opt)
            : (typeof opt === 'object' ? opt.label : String(opt));
          return (
            <option key={String(id)} value={id}>{optLabel}</option>
          );
        })}
      </select>
    </label>
  );
}

function PaymentTypeCard({ id, label, selected, onSelect }) {
  return (
    <button
      type="button"
      className={`dai-cond-payment${selected ? ' is-selected' : ''}`}
      onClick={() => onSelect(id)}
      aria-pressed={selected}
    >
      {label}
    </button>
  );
}

/** Schritt 3 – Konditionen (nach Fahrzeugkonfiguration) */
export default function DealerAiConditionsStep({
  draft,
  parsed,
  conditions,
  onDraftChange,
  onContinue,
  onBack,
  isExecuting = false,
}) {
  if (!draft) return null;

  const fields = parsed?.fields ?? {};
  const paymentType = draft.paymentType === 'unknown' ? 'leasing' : draft.paymentType;
  const isCash = paymentType === 'cash';
  const isFinance = paymentType === 'financing' || paymentType === 'threeWayFinancing';
  const isLeasing = paymentType === 'leasing';

  const budgetOptions = useMemo(() => (
    isCash ? buildBudgetPriceOptions(draft.desiredPrice) : buildBudgetRateOptions(draft.desiredRate)
  ).map((amount) => ({ id: String(amount), label: `${amount.toLocaleString('de-DE')} €` })), [isCash, draft.desiredPrice, draft.desiredRate]);

  const budgetValue = isCash
    ? (draft.desiredPrice != null ? String(draft.desiredPrice) : '')
    : (draft.desiredRate != null ? String(draft.desiredRate) : '');

  const downPaymentOptions = buildDownPaymentOptions(draft.downPayment ?? 0).map((v) => ({
    id: String(v),
    label: v === 0 ? '0 €' : `${v.toLocaleString('de-DE')} €`,
  }));

  const paymentOptions = DEALER_AI_PAYMENT_OPTIONS.filter((p) => p.id !== 'unknown');
  const preview = buildOfferPreview(draft, conditions, fields);

  function patch(partial) {
    onDraftChange({ ...draft, ...partial });
  }

  function patchBudget(value) {
    if (!value) {
      patch({ desiredRate: null, desiredPrice: null });
      return;
    }
    const amount = Number(value);
    if (isCash) patch({ desiredPrice: amount, desiredRate: null });
    else patch({ desiredRate: amount, desiredPrice: null });
  }

  function handlePaymentType(paymentType) {
    const next = { paymentType };
    if (paymentType === 'cash') {
      next.desiredRate = null;
    } else if (paymentType !== 'cash' && draft.desiredPrice && !draft.desiredRate) {
      next.desiredPrice = null;
    }
    patch(next);
  }

  const vehicleLine = [draft.model, draft.trimLabel, draft.batteryLabel].filter(Boolean).join(' ');

  return (
    <div className="dai-conditions">
      <header className="dai-conditions__header">
        {onBack && (
          <button type="button" className="dai-conditions__back" onClick={onBack}>
            ← Zur Konfiguration
          </button>
        )}
        <h2 className="dai-conditions__title">Konditionen</h2>
        <p className="dai-conditions__vehicle">{vehicleLine}</p>
      </header>

      <section className="dai-conditions__section">
        <h3 className="dai-conditions__section-title">Angebotsart</h3>
        <div className="dai-cond-payment-row">
          {paymentOptions.map((opt) => (
            <PaymentTypeCard
              key={opt.id}
              id={opt.id}
              label={PAYMENT_TYPE_LABELS[opt.id] ?? opt.label}
              selected={paymentType === opt.id}
              onSelect={handlePaymentType}
            />
          ))}
        </div>
      </section>

      {isLeasing && (
        <section className="dai-conditions__section">
          <h3 className="dai-conditions__section-title">Leasing</h3>
          <div className="dai-conditions__grid">
            <SelectField
              label="Laufzeit"
              value={draft.termMonths}
              options={DEALER_AI_TERM_OPTIONS}
              onChange={(v) => patch({ termMonths: Number(v) })}
              formatOption={(m) => `${m} Monate`}
            />
            <SelectField
              label="Kilometer / Jahr"
              value={draft.mileagePerYear}
              options={DEALER_AI_MILEAGE_OPTIONS}
              onChange={(v) => patch({ mileagePerYear: Number(v) })}
              formatOption={(m) => `${(m / 1000).toLocaleString('de-DE')}.000 km`}
            />
            <SelectField
              label="Anzahlung"
              value={String(draft.downPayment ?? 0)}
              options={downPaymentOptions}
              onChange={(v) => patch({ downPayment: Number(v) || 0 })}
            />
            <SelectField
              label="Überführung"
              value={String(draft.preparationFee ?? conditions?.preparationFee ?? 1290)}
              options={[
                { id: String(conditions?.preparationFee ?? 1290), label: `${(conditions?.preparationFee ?? 1290).toLocaleString('de-DE')} €` },
              ]}
              onChange={() => {}}
            />
            <SelectField
              label="Budget / Wunschrate"
              value={budgetValue}
              options={[{ id: '', label: 'offen' }, ...budgetOptions]}
              onChange={patchBudget}
            />
          </div>
        </section>
      )}

      {isFinance && (
        <section className="dai-conditions__section">
          <h3 className="dai-conditions__section-title">Finanzierung</h3>
          <div className="dai-conditions__grid">
            <SelectField
              label="Laufzeit"
              value={draft.termMonths}
              options={DEALER_AI_TERM_OPTIONS}
              onChange={(v) => patch({ termMonths: Number(v) })}
              formatOption={(m) => `${m} Monate`}
            />
            <SelectField
              label="Anzahlung"
              value={String(draft.downPayment ?? 0)}
              options={downPaymentOptions}
              onChange={(v) => patch({ downPayment: Number(v) || 0 })}
            />
            <SelectField
              label="Schlussrate"
              value={draft.paymentType === 'threeWayFinancing' ? 'yes' : 'no'}
              options={[
                { id: 'no', label: 'Nein' },
                { id: 'yes', label: 'Ja (3-Wege-Finanzierung)' },
              ]}
              onChange={(v) => patch({
                paymentType: v === 'yes' ? 'threeWayFinancing' : 'financing',
              })}
            />
            <SelectField
              label="Budget / Wunschrate"
              value={budgetValue}
              options={[{ id: '', label: 'offen' }, ...budgetOptions]}
              onChange={patchBudget}
            />
          </div>
        </section>
      )}

      {isCash && (
        <section className="dai-conditions__section">
          <h3 className="dai-conditions__section-title">Kauf / Barzahlung</h3>
          <div className="dai-conditions__grid">
            <SelectField
              label="Wunschpreis"
              value={budgetValue}
              options={[{ id: '', label: 'offen' }, ...budgetOptions]}
              onChange={patchBudget}
            />
            <SelectField
              label="Überführung"
              value={String(draft.preparationFee ?? conditions?.preparationFee ?? 1290)}
              options={[
                { id: String(conditions?.preparationFee ?? 1290), label: `${(conditions?.preparationFee ?? 1290).toLocaleString('de-DE')} €` },
              ]}
              onChange={() => {}}
            />
            <SelectField
              label="Wunschlieferdatum"
              value={draft.desiredDeliveryDate ?? ''}
              options={[
                { id: '', label: 'offen' },
                ...DEALER_AI_DELIVERY_DATE_OPTIONS.map((d) => ({ id: d, label: d })),
              ]}
              onChange={(v) => patch({ desiredDeliveryDate: v || null })}
            />
          </div>
        </section>
      )}

      {!isCash && (
        <section className="dai-conditions__section dai-conditions__section--compact">
          <SelectField
            label="Wunschlieferdatum"
            value={draft.desiredDeliveryDate ?? ''}
            options={[
              { id: '', label: 'offen' },
              ...DEALER_AI_DELIVERY_DATE_OPTIONS.map((d) => ({ id: d, label: d })),
            ]}
            onChange={(v) => patch({ desiredDeliveryDate: v || null })}
          />
        </section>
      )}

      {preview.monthlyRate != null && (
        <p className="dai-conditions__live-rate" aria-live="polite">
          {isCash
            ? `Kaufpreis: ${preview.monthlyRate.toLocaleString('de-DE')} €`
            : `Rate: ${preview.monthlyRate.toLocaleString('de-DE')} € / Monat`}
          {preview.budget?.status === 'ok' && ' · ✓ Budget erfüllt'}
          {preview.budget?.status === 'over' && ` · ⚠ ${preview.budget.label}`}
        </p>
      )}

      <div className="dai-conditions__actions">
        <button
          type="button"
          className="dai-conditions__primary"
          onClick={onContinue}
          disabled={isExecuting}
        >
          {isExecuting ? 'Wird geladen …' : 'Angebotsvorschau anzeigen'}
        </button>
      </div>
    </div>
  );
}
