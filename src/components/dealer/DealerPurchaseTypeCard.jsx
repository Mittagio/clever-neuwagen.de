import { useEffect, useMemo, useState } from 'react';
import {
  CASH_TIMING_OPTIONS,
  DOWN_PAYMENT_OPTIONS,
  FINANCE_BALLOON_OPTIONS,
  FINANCE_TERM_OPTIONS,
  getPaymentStepCta,
  LEASING_MILEAGE_OPTIONS,
  LEASING_TERM_OPTIONS,
  PAYMENT_TYPE_CARDS,
  TRADE_IN_OPTIONS,
} from '../../services/dealer/purchaseTypeFormOptions.js';
import './dealer-landing.css';

function ConfigRecap({ summary }) {
  if (!summary) return null;

  return (
    <div className="dl-purchase__recap" aria-label="Ihre Konfiguration">
      <p className="dl-purchase__recap-label">Ihr Fahrzeug</p>
      <p className="dl-purchase__recap-title">
        Kia
        {' '}
        {summary.modelLabel}
      </p>
      {summary.trimLabel && (
        <p className="dl-purchase__recap-trim">
          Ausstattung
          {' '}
          {summary.trimLabel}
        </p>
      )}
    </div>
  );
}

function ChipGroup({ label, options, value, onChange }) {
  return (
    <div className="dl-purchase__field">
      <p className="dl-purchase__field-label">{label}</p>
      <div className="dl-purchase__chips" role="group" aria-label={label}>
        {options.map((option) => {
          const active = value === option.id;
          return (
            <button
              key={option.id}
              type="button"
              className={`dl-purchase__chip${active ? ' dl-purchase__chip--active' : ''}`}
              aria-pressed={active}
              onClick={() => onChange(option.id)}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function LeasingFields({ details, onChange }) {
  return (
    <div className="dl-purchase__details">
      <ChipGroup
        label="Laufzeit"
        options={LEASING_TERM_OPTIONS}
        value={details.termId}
        onChange={(v) => onChange({ termId: v })}
      />
      <ChipGroup
        label="Kilometer pro Jahr"
        options={LEASING_MILEAGE_OPTIONS}
        value={details.mileageId}
        onChange={(v) => onChange({ mileageId: v })}
      />
      <ChipGroup
        label="Anzahlung"
        options={DOWN_PAYMENT_OPTIONS}
        value={details.downPayment}
        onChange={(v) => onChange({ downPayment: v })}
      />
      <div className="dl-purchase__extras">
        <p className="dl-purchase__field-label">Optional</p>
        <label className="dl-purchase__check">
          <input
            type="checkbox"
            checked={details.maintenance}
            onChange={(e) => onChange({ maintenance: e.target.checked })}
          />
          <span>Wartung / Service</span>
        </label>
        <label className="dl-purchase__check">
          <input
            type="checkbox"
            checked={details.insurance}
            onChange={(e) => onChange({ insurance: e.target.checked })}
          />
          <span>Versicherung</span>
        </label>
      </div>
    </div>
  );
}

function FinanceFields({ details, onChange }) {
  return (
    <div className="dl-purchase__details">
      <ChipGroup
        label="Anzahlung"
        options={DOWN_PAYMENT_OPTIONS}
        value={details.downPayment}
        onChange={(v) => onChange({ downPayment: v })}
      />
      <ChipGroup
        label="Laufzeit"
        options={FINANCE_TERM_OPTIONS}
        value={details.termId}
        onChange={(v) => onChange({ termId: v })}
      />
      <div className="dl-purchase__field">
        <label className="dl-purchase__field-label" htmlFor="finance-rate">
          Wunschrate (optional)
        </label>
        <input
          id="finance-rate"
          type="number"
          inputMode="numeric"
          className="dl-purchase__input"
          placeholder="z. B. 350"
          value={details.desiredRate ?? ''}
          onChange={(e) => onChange({ desiredRate: e.target.value })}
        />
      </div>
      <ChipGroup
        label="Schlussrate"
        options={FINANCE_BALLOON_OPTIONS}
        value={details.balloon}
        onChange={(v) => onChange({ balloon: v })}
      />
    </div>
  );
}

function CashFields({ details, onChange }) {
  return (
    <div className="dl-purchase__details">
      <ChipGroup
        label="Kaufzeitpunkt"
        options={CASH_TIMING_OPTIONS}
        value={details.purchaseTiming}
        onChange={(v) => onChange({ purchaseTiming: v })}
      />
      <ChipGroup
        label="Inzahlungnahme"
        options={TRADE_IN_OPTIONS}
        value={details.tradeIn}
        onChange={(v) => onChange({ tradeIn: v })}
      />
      <div className="dl-purchase__field">
        <label className="dl-purchase__field-label" htmlFor="cash-accessories">
          Zubehör / Extras (optional)
        </label>
        <input
          id="cash-accessories"
          type="text"
          className="dl-purchase__input"
          placeholder="z. B. AHK, Winterräder"
          value={details.accessories ?? ''}
          onChange={(e) => onChange({ accessories: e.target.value })}
        />
      </div>
      <label className="dl-purchase__check">
        <input
          type="checkbox"
          checked={details.wantsBindingOffer}
          onChange={(e) => onChange({ wantsBindingOffer: e.target.checked })}
        />
        <span>Verbindliches Kaufangebot vom Autohaus</span>
      </label>
    </div>
  );
}

const DEFAULT_DETAILS = {
  leasing: {
    termId: 'term_36',
    mileageId: 'km_15000',
    downPayment: 'dp_open',
    maintenance: false,
    insurance: false,
  },
  finance: {
    downPayment: 'dp_open',
    termId: 'term_48',
    desiredRate: '',
    balloon: 'balloon_unknown',
  },
  cash: {
    purchaseTiming: 'timing_open',
    tradeIn: 'trade_maybe',
    accessories: '',
    wantsBindingOffer: true,
  },
};

/**
 * Zahlungsart – nach Ausstattung, mit dynamischen Folgefragen.
 */
export default function DealerPurchaseTypeCard({
  configSummary,
  value = null,
  initialDetails = null,
  onContinue,
  onSelectionChange,
  formId = 'dl-advisor-purchase-form',
}) {
  const [selected, setSelected] = useState(value);
  const [detailsByType, setDetailsByType] = useState(() => ({
    ...DEFAULT_DETAILS,
    ...(initialDetails ?? {}),
  }));

  useEffect(() => {
    if (!value) return;
    setSelected(value);
    onSelectionChange?.(value);
  }, [value, onSelectionChange]);

  const details = selected ? detailsByType[selected] ?? DEFAULT_DETAILS[selected] : null;

  function handleSelect(optionId) {
    setSelected(optionId);
    onSelectionChange?.(optionId);
  }

  function patchDetails(patch) {
    if (!selected) return;
    setDetailsByType((prev) => ({
      ...prev,
      [selected]: { ...prev[selected], ...patch },
    }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (!selected) return;
    onContinue?.(selected, detailsByType[selected] ?? {});
  }

  const ctaLabel = useMemo(() => getPaymentStepCta(selected), [selected]);

  return (
    <section className="dl-purchase" aria-labelledby="dl-purchase-title">
      <ConfigRecap summary={configSummary} />
      <p className="dl-purchase__phase">Zahlungsart</p>
      <h2 id="dl-purchase-title" className="dl-purchase__title">
        Wie möchten Sie Ihr Fahrzeug kaufen?
      </h2>

      <form id={formId} className="dl-purchase__form" onSubmit={handleSubmit}>
        <div className="dl-purchase__type-cards">
          {PAYMENT_TYPE_CARDS.map((option) => {
            const active = selected === option.id;
            return (
              <button
                key={option.id}
                type="button"
                className={`dl-purchase__type-card${active ? ' dl-purchase__type-card--active' : ''}`}
                onClick={() => handleSelect(option.id)}
                aria-pressed={active}
              >
                <span className="dl-purchase__type-card-label">{option.label}</span>
                <span className="dl-purchase__type-card-sub">{option.subline}</span>
              </button>
            );
          })}
        </div>

        {selected === 'leasing' && (
          <LeasingFields details={details} onChange={patchDetails} />
        )}
        {selected === 'finance' && (
          <FinanceFields details={details} onChange={patchDetails} />
        )}
        {selected === 'cash' && (
          <CashFields details={details} onChange={patchDetails} />
        )}

        <button
          type="submit"
          className="btn btn-primary dl-purchase__cta"
          disabled={!selected}
        >
          {ctaLabel}
        </button>
      </form>
    </section>
  );
}
