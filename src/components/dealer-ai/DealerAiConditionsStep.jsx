import { useMemo, useState } from 'react';
import {
  buildConditionsFooterAction,
  DISCOUNT_GROUP_OPTIONS,
  LEASING_MILEAGE_OPTIONS,
  LEASING_TERM_OPTIONS,
} from '../../services/configuration/conditionsStepPreview.js';
import { vehicleConfigurationTitle } from '../../services/configuration/vehicleConfigurationModel.js';
import ConfigurationChecklist, { buildHeroSubtitle } from './ConfigurationChecklist.jsx';
import './DealerAiConditionsStep.css';

const PAYMENT_CARDS = [
  { id: 'leasing', label: 'Leasing', hint: 'Monatliche Rate' },
  { id: 'financing', label: 'Finanzierung', hint: 'Kredit / 3-Wege' },
  { id: 'cash', label: 'Kauf', labelAlt: 'Barzahlung', hint: 'Einmalzahlung' },
];

const DOWN_CHIPS = [0, 3000, 6000, 9000, 12000];
const PREP_PRESETS = [990, 1190, 1290, 1490];

const DELIVERY_CHIPS = [
  { id: 'sofort', label: 'Sofort' },
  { id: '1-3-monate', label: '1–3 Monate' },
  { id: '3-6-monate', label: '3–6 Monate' },
  { id: 'flexibel', label: 'Flexibel' },
];

function formatCurrency(amount) {
  if (amount == null) return '–';
  return `${Number(amount).toLocaleString('de-DE')} €`;
}

function formatMileage(km) {
  return `${Number(km).toLocaleString('de-DE')} km/Jahr`;
}

function formatMileageShort(km) {
  const k = km / 1000;
  return Number.isInteger(k) ? `${k}k` : `${k.toLocaleString('de-DE')}k`;
}

function formatDownPayment(value) {
  return value === 0 ? '0 €' : `${value.toLocaleString('de-DE')} €`;
}

function nearestStepIndex(steps, value) {
  if (!steps.length) return 0;
  let bestIndex = 0;
  let bestDiff = Math.abs(steps[0] - value);
  steps.forEach((step, index) => {
    const diff = Math.abs(step - value);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestIndex = index;
    }
  });
  return bestIndex;
}

function buildPrepChips(defaultFee) {
  const values = new Set([...PREP_PRESETS, defaultFee].filter((v) => v != null));
  return [...values].sort((a, b) => a - b);
}

function isPresetDownPayment(value) {
  return DOWN_CHIPS.includes(value);
}

function ChoiceChip({ label, selected, onClick, className = '' }) {
  return (
    <button
      type="button"
      className={`dai-cond-chip${selected ? ' is-selected' : ''} ${className}`.trim()}
      onClick={onClick}
      aria-pressed={selected}
    >
      {label}
    </button>
  );
}

function PaymentCard({ card, selected, onSelect }) {
  return (
    <button
      type="button"
      className={`dai-cond-pay-card${selected ? ' is-selected' : ''}`}
      onClick={() => onSelect(card.id)}
      aria-pressed={selected}
    >
      <span className="dai-cond-pay-card__label">{card.label}</span>
      {card.labelAlt && (
        <span className="dai-cond-pay-card__label-alt">{card.labelAlt}</span>
      )}
      <span className="dai-cond-pay-card__hint">{card.hint}</span>
    </button>
  );
}

function SectionBlock({ title, children }) {
  return (
    <section className="dai-cond-block">
      {title && <h3 className="dai-cond-block__title">{title}</h3>}
      {children}
    </section>
  );
}

function StepSlider({
  label,
  steps,
  value,
  onChange,
  formatValue,
  formatTick,
}) {
  const index = nearestStepIndex(steps, value ?? steps[0]);
  const current = steps[index];
  const tickFormat = formatTick ?? formatValue;

  return (
    <div className="dai-cond-step">
      <span className="dai-cond-step__label">{label}</span>
      <div className="dai-cond-step__ticks" aria-hidden="true">
        {steps.map((step, stepIndex) => (
          <span
            key={step}
            className={`dai-cond-step__tick${stepIndex === index ? ' is-active' : ''}${stepIndex <= index ? ' is-filled' : ''}`}
          />
        ))}
      </div>
      <input
        type="range"
        className="dai-cond-step__range"
        min={0}
        max={Math.max(0, steps.length - 1)}
        step={1}
        value={index}
        onChange={(event) => onChange(steps[Number(event.target.value)])}
        aria-valuemin={steps[0]}
        aria-valuemax={steps[steps.length - 1]}
        aria-valuenow={current}
        aria-label={label}
      />
      <div className="dai-cond-step__scale">
        {steps.map((step) => (
          <span key={step} className="dai-cond-step__scale-mark">
            {tickFormat(step)}
          </span>
        ))}
      </div>
      <p className="dai-cond-step__result">{formatValue(current)}</p>
    </div>
  );
}

function DownPaymentPicker({
  value,
  onChange,
  customDownPayment,
  setCustomDownPayment,
  showCustomDown,
  setShowCustomDown,
}) {
  function applyCustomDownPayment() {
    const parsedAmount = Number(String(customDownPayment).replace(/\./g, '').replace(',', '.').trim());
    if (!Number.isFinite(parsedAmount) || parsedAmount < 0) return;
    onChange(Math.round(parsedAmount));
    setCustomDownPayment('');
    setShowCustomDown(false);
  }

  const customSelected = !isPresetDownPayment(value);

  return (
    <SectionBlock title="Anzahlung">
      <div className="dai-cond-chips">
        {DOWN_CHIPS.map((amount) => (
          <ChoiceChip
            key={amount}
            label={formatDownPayment(amount)}
            selected={value === amount && !showCustomDown}
            onClick={() => {
              setShowCustomDown(false);
              onChange(amount);
            }}
          />
        ))}
        <ChoiceChip
          label="Eigene Anzahlung"
          selected={showCustomDown || customSelected}
          onClick={() => setShowCustomDown(true)}
        />
      </div>
      {(showCustomDown || customSelected) && (
        <div className="dai-cond-custom-input dai-cond-custom-input--inline">
          <input
            type="text"
            inputMode="numeric"
            className="dai-cond-custom-input__field"
            placeholder="Betrag in €"
            value={customDownPayment || (customSelected && !showCustomDown ? String(value) : '')}
            onChange={(event) => setCustomDownPayment(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') applyCustomDownPayment();
            }}
          />
          <button
            type="button"
            className="dai-cond-custom-input__btn"
            onClick={applyCustomDownPayment}
          >
            OK
          </button>
        </div>
      )}
    </SectionBlock>
  );
}

function PreparationFeePicker({ value, defaultFee, onChange }) {
  const chips = useMemo(() => buildPrepChips(defaultFee), [defaultFee]);
  const [customFee, setCustomFee] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const presetSelected = chips.includes(value);

  function applyCustomFee() {
    const parsed = Number(String(customFee).replace(/\./g, '').replace(',', '.').trim());
    if (!Number.isFinite(parsed) || parsed < 0) return;
    onChange(Math.round(parsed));
    setCustomFee('');
    setShowCustom(false);
  }

  return (
    <SectionBlock title="Überführung">
      <div className="dai-cond-chips">
        {chips.map((amount) => (
          <ChoiceChip
            key={amount}
            label={formatCurrency(amount)}
            selected={value === amount && !showCustom}
            onClick={() => {
              setShowCustom(false);
              onChange(amount);
            }}
          />
        ))}
        <ChoiceChip
          label="Eigener Betrag"
          selected={showCustom || !presetSelected}
          onClick={() => setShowCustom(true)}
        />
      </div>
      {(showCustom || !presetSelected) && (
        <div className="dai-cond-custom-input dai-cond-custom-input--inline">
          <input
            type="text"
            inputMode="numeric"
            className="dai-cond-custom-input__field"
            placeholder="Betrag in €"
            value={customFee || (!presetSelected && !showCustom ? String(value) : '')}
            onChange={(event) => setCustomFee(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') applyCustomFee();
            }}
          />
          <button
            type="button"
            className="dai-cond-custom-input__btn"
            onClick={applyCustomFee}
          >
            OK
          </button>
        </div>
      )}
    </SectionBlock>
  );
}

/** Schritt 2 – Konditionen (Verkäufer-Geschwindigkeit) */
export default function DealerAiConditionsStep({
  draft,
  vehicleConfiguration,
  conditions,
  onDraftChange,
  onContinue,
  onBack,
  isExecuting = false,
}) {
  const [customDownPayment, setCustomDownPayment] = useState('');
  const [showCustomDown, setShowCustomDown] = useState(false);

  if (!draft || !vehicleConfiguration) return null;

  const paymentType = draft.paymentType === 'unknown' ? 'leasing' : draft.paymentType;
  const isCash = paymentType === 'cash';
  const isFinance = paymentType === 'financing' || paymentType === 'threeWayFinancing';
  const isLeasing = paymentType === 'leasing';
  const isThreeWay = paymentType === 'threeWayFinancing';
  const defaultPreparationFee = conditions?.preparationFee ?? 1290;
  const preparationFee = draft.preparationFee ?? defaultPreparationFee;

  const footerAction = buildConditionsFooterAction();

  function patch(partial) {
    onDraftChange({ ...draft, ...partial });
  }

  function handlePaymentType(id) {
    const next = { paymentType: id };
    if (id === 'cash') next.desiredRate = null;
    else if (id !== 'cash' && draft.desiredPrice && !draft.desiredRate) {
      next.desiredPrice = null;
    }
    patch(next);
  }

  const vehicleTitle = vehicleConfigurationTitle(vehicleConfiguration);
  const heroSubtitle = buildHeroSubtitle(vehicleConfiguration);
  const uvpTotal = vehicleConfiguration.uvpConfigurationPrice;

  const activePaymentCard = isCash
    ? 'cash'
    : isFinance
      ? 'financing'
      : 'leasing';

  const termValue = draft.termMonths ?? 48;
  const mileageValue = draft.mileagePerYear ?? 15000;
  const downValue = draft.downPayment ?? 0;
  const customerGroup = draft.customerGroup ?? 'standard';

  return (
    <div className="dai-conditions dai-conditions--sales">
      <header className="dai-cond-hero">
        {onBack && (
          <button type="button" className="dai-cond-hero__back" onClick={onBack}>
            ← Zur Konfiguration
          </button>
        )}
        <h2 className="dai-cond-hero__vehicle">{vehicleTitle || draft.model}</h2>
        <p className="dai-cond-hero__uvp-label">UVP</p>
        <p className="dai-cond-hero__uvp">{formatCurrency(uvpTotal)}</p>
        {heroSubtitle && (
          <p className="dai-cond-hero__subtitle">{heroSubtitle}</p>
        )}
      </header>

      <ConfigurationChecklist vehicleConfiguration={vehicleConfiguration} />

      <SectionBlock title="Angebotsart">
        <div className="dai-cond-pay-row">
          {PAYMENT_CARDS.map((card) => (
            <PaymentCard
              key={card.id}
              card={card}
              selected={activePaymentCard === card.id}
              onSelect={handlePaymentType}
            />
          ))}
        </div>
      </SectionBlock>

      {isCash && (
        <SectionBlock title="Rabatt">
          <div className="dai-cond-chips dai-cond-chips--discount">
            {DISCOUNT_GROUP_OPTIONS.map((opt) => (
              <ChoiceChip
                key={opt.id}
                label={opt.label}
                selected={customerGroup === opt.id}
                onClick={() => patch({ customerGroup: opt.id })}
              />
            ))}
          </div>
          {customerGroup === 'custom' && (
            <div className="dai-cond-custom-input dai-cond-custom-input--percent">
              <input
                type="number"
                min={0}
                max={100}
                step={0.5}
                className="dai-cond-custom-input__field"
                placeholder="Rabatt in %"
                value={draft.customDiscountPercent ?? ''}
                onChange={(event) => patch({
                  customDiscountPercent: event.target.value === ''
                    ? null
                    : Number(event.target.value),
                })}
              />
              <span className="dai-cond-custom-input__suffix">%</span>
            </div>
          )}
        </SectionBlock>
      )}

      {(isLeasing || isFinance) && (
        <StepSlider
          label="Laufzeit"
          steps={LEASING_TERM_OPTIONS}
          value={termValue}
          onChange={(months) => patch({ termMonths: months })}
          formatValue={(months) => `${months} Monate`}
          formatTick={(months) => String(months)}
        />
      )}

      {isLeasing && (
        <StepSlider
          label="Kilometer"
          steps={LEASING_MILEAGE_OPTIONS}
          value={mileageValue}
          onChange={(km) => patch({ mileagePerYear: km })}
          formatValue={formatMileage}
          formatTick={formatMileageShort}
        />
      )}

      {(isLeasing || isFinance) && (
        <DownPaymentPicker
          value={downValue}
          onChange={(amount) => patch({ downPayment: amount })}
          customDownPayment={customDownPayment}
          setCustomDownPayment={setCustomDownPayment}
          showCustomDown={showCustomDown}
          setShowCustomDown={setShowCustomDown}
        />
      )}

      {isFinance && (
        <SectionBlock title="Finanzierungsart">
          <div className="dai-cond-chips">
            <ChoiceChip
              label="Klassisch"
              selected={!isThreeWay}
              onClick={() => patch({ paymentType: 'financing' })}
            />
            <ChoiceChip
              label="3-Wege-Finanzierung"
              selected={isThreeWay}
              onClick={() => patch({ paymentType: 'threeWayFinancing' })}
            />
          </div>
        </SectionBlock>
      )}

      <PreparationFeePicker
        value={preparationFee}
        defaultFee={defaultPreparationFee}
        onChange={(fee) => patch({ preparationFee: fee })}
      />

      <details className="dai-cond-wish-fold">
        <summary>Weitere Optionen</summary>
        <div className="dai-cond-wish-fold__body">
          <p className="dai-cond-block__title">Wunschlieferdatum</p>
          <div className="dai-cond-chips dai-cond-chips--delivery">
            {DELIVERY_CHIPS.map((chip) => (
              <ChoiceChip
                key={chip.id}
                label={chip.label}
                selected={(draft.desiredDeliveryDate ?? '') === chip.id}
                onClick={() => patch({
                  desiredDeliveryDate: draft.desiredDeliveryDate === chip.id ? null : chip.id,
                })}
              />
            ))}
          </div>
        </div>
      </details>

      <footer className="dai-cond-sticky-foot dai-cond-sticky-foot--single">
        {footerAction.hint && (
          <p className="dai-cond-sticky-foot__hint">{footerAction.hint}</p>
        )}
        <button
          type="button"
          className="dai-cond-sticky-foot__cta"
          onClick={onContinue}
          disabled={isExecuting}
        >
          {isExecuting ? 'Wird geladen …' : footerAction.label}
        </button>
      </footer>
    </div>
  );
}
