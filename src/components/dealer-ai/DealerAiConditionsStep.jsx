import { useMemo, useState } from 'react';
import {
  buildConditionsFooterAction,
  computeConditionsStepPreview,
  DISCOUNT_GROUP_OPTIONS,
  LEASING_MILEAGE_OPTIONS,
  LEASING_TERM_OPTIONS,
} from '../../services/configuration/conditionsStepPreview.js';
import { vehicleConfigurationTitle } from '../../services/configuration/vehicleConfigurationModel.js';
import VehicleConfigurationSummary from './VehicleConfigurationSummary.jsx';
import './DealerAiConditionsStep.css';
import './VehicleConfigurationSummary.css';

const PAYMENT_CARDS = [
  { id: 'leasing', label: 'Leasing', hint: 'Monatliche Rate' },
  { id: 'financing', label: 'Finanzierung', hint: 'Kredit / 3-Wege' },
  { id: 'cash', label: 'Kauf', labelAlt: 'Barzahlung', hint: 'Einmalzahlung' },
];

const DOWN_CHIPS = [0, 3000, 6000];

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
  return `${(km / 1000).toLocaleString('de-DE')}.000 km`;
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

function StepSlider({ label, steps, value, onChange, formatValue }) {
  const index = nearestStepIndex(steps, value ?? steps[0]);
  const current = steps[index];

  return (
    <div className="dai-cond-step">
      <div className="dai-cond-step__head">
        <span className="dai-cond-step__label">{label}</span>
        <strong className="dai-cond-step__value">{formatValue(current)}</strong>
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
      <div className="dai-cond-step__ends">
        <span>{formatValue(steps[0])}</span>
        <span>{formatValue(steps[steps.length - 1])}</span>
      </div>
    </div>
  );
}

function buildConfigFoldSummary(vehicleConfiguration) {
  const parts = [];
  if (vehicleConfiguration?.colorLabel) parts.push(vehicleConfiguration.colorLabel);
  const pkgCount = vehicleConfiguration?.selectedPackages?.length ?? 0;
  if (pkgCount > 0) parts.push(`${pkgCount} Paket${pkgCount > 1 ? 'e' : ''}`);
  const accCount = vehicleConfiguration?.accessories?.length ?? 0;
  if (accCount > 0) parts.push(`${accCount} Extra${accCount > 1 ? 's' : ''}`);
  return parts.length ? parts.join(' · ') : 'Details anzeigen';
}

/** Schritt 2 – Konditionen */
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

  if (!draft || !vehicleConfiguration) return null;

  const paymentType = draft.paymentType === 'unknown' ? 'leasing' : draft.paymentType;
  const isCash = paymentType === 'cash';
  const isFinance = paymentType === 'financing' || paymentType === 'threeWayFinancing';
  const isLeasing = paymentType === 'leasing';
  const isThreeWay = paymentType === 'threeWayFinancing';
  const preparationFee = draft.preparationFee ?? conditions?.preparationFee ?? 1290;

  const preview = useMemo(
    () => computeConditionsStepPreview(vehicleConfiguration, draft, conditions),
    [vehicleConfiguration, draft, conditions],
  );

  const footerAction = useMemo(
    () => buildConditionsFooterAction(preview),
    [preview],
  );

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

  function applyCustomDownPayment() {
    const parsedAmount = Number(String(customDownPayment).replace(/\./g, '').replace(',', '.').trim());
    if (!Number.isFinite(parsedAmount) || parsedAmount < 0) return;
    patch({ downPayment: Math.round(parsedAmount) });
    setCustomDownPayment('');
  }

  const vehicleTitle = vehicleConfigurationTitle(vehicleConfiguration);
  const uvpTotal = vehicleConfiguration.uvpConfigurationPrice;
  const configFoldSummary = buildConfigFoldSummary(vehicleConfiguration);

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
      </header>

      <details className="dai-cond-config-fold">
        <summary>Konfiguration · {configFoldSummary}</summary>
        <div className="dai-cond-config-fold__body">
          <VehicleConfigurationSummary
            configuration={vehicleConfiguration}
            showSelections
            hidePrice
          />
        </div>
      </details>

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
        <>
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

          <SectionBlock title="Überführung">
            <p className="dai-cond-static-value">{formatCurrency(preparationFee)}</p>
          </SectionBlock>

          {preview?.cashOfferPrice != null && (
            <div className="dai-cond-offer-live">
              <p className="dai-cond-offer-live__label">Angebotspreis aktuell</p>
              <p className="dai-cond-offer-live__value">{formatCurrency(preview.cashOfferPrice)}</p>
              {preview.discountPercent != null && (
                <p className="dai-cond-offer-live__meta">
                  UVP {formatCurrency(preview.uvpTotal)}
                  {' · '}
                  Rabatt {preview.discountPercent} %
                  {' · '}
                  Überführung {formatCurrency(preparationFee)}
                </p>
              )}
            </div>
          )}
        </>
      )}

      {isLeasing && (
        <>
          <StepSlider
            label="Laufzeit"
            steps={LEASING_TERM_OPTIONS}
            value={termValue}
            onChange={(months) => patch({ termMonths: months })}
            formatValue={(months) => `${months} Monate`}
          />
          <StepSlider
            label="Kilometer pro Jahr"
            steps={LEASING_MILEAGE_OPTIONS}
            value={mileageValue}
            onChange={(km) => patch({ mileagePerYear: km })}
            formatValue={formatMileage}
          />
          <SectionBlock title="Anzahlung">
            <div className="dai-cond-chips">
              {DOWN_CHIPS.map((amount) => (
                <ChoiceChip
                  key={amount}
                  label={formatDownPayment(amount)}
                  selected={downValue === amount}
                  onClick={() => patch({ downPayment: amount })}
                />
              ))}
            </div>
            <details className="dai-cond-more">
              <summary>Eigene Anzahlung</summary>
              <div className="dai-cond-more__body">
                <div className="dai-cond-custom-input">
                  <input
                    type="text"
                    inputMode="numeric"
                    className="dai-cond-custom-input__field"
                    placeholder="Betrag in €"
                    value={customDownPayment}
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
                    Übernehmen
                  </button>
                </div>
              </div>
            </details>
          </SectionBlock>

          {preview?.canShowLiveLeasingRate && preview.monthlyRate != null ? (
            <div className="dai-cond-offer-live">
              <p className="dai-cond-offer-live__label">Rate aktuell</p>
              <p className="dai-cond-offer-live__value">
                {preview.monthlyRate.toLocaleString('de-DE')} €/Monat
              </p>
              <p className="dai-cond-offer-live__meta">
                {termValue} Monate · {formatMileage(mileageValue)} · {formatDownPayment(downValue)} Anzahlung
              </p>
            </div>
          ) : (
            <div className="dai-cond-offer-pending">
              <p className="dai-cond-offer-pending__title">Leasingangebot vorbereiten</p>
              <p className="dai-cond-offer-pending__text">Rate wird im Bankangebot bestätigt.</p>
            </div>
          )}
        </>
      )}

      {isFinance && (
        <>
          <StepSlider
            label="Laufzeit"
            steps={LEASING_TERM_OPTIONS}
            value={termValue}
            onChange={(months) => patch({ termMonths: months })}
            formatValue={(months) => `${months} Monate`}
          />
          <SectionBlock title="Anzahlung">
            <div className="dai-cond-chips">
              {DOWN_CHIPS.map((amount) => (
                <ChoiceChip
                  key={amount}
                  label={formatDownPayment(amount)}
                  selected={downValue === amount}
                  onClick={() => patch({ downPayment: amount })}
                />
              ))}
            </div>
            <details className="dai-cond-more">
              <summary>Eigene Anzahlung</summary>
              <div className="dai-cond-more__body">
                <div className="dai-cond-custom-input">
                  <input
                    type="text"
                    inputMode="numeric"
                    className="dai-cond-custom-input__field"
                    placeholder="Betrag in €"
                    value={customDownPayment}
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
                    Übernehmen
                  </button>
                </div>
              </div>
            </details>
          </SectionBlock>

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

          {isThreeWay && preview?.finalPayment != null && (
            <SectionBlock title="Schlussrate">
              <p className="dai-cond-static-value">{formatCurrency(preview.finalPayment)}</p>
            </SectionBlock>
          )}

          {preview?.canShowLiveFinanceRate && preview.monthlyRate != null ? (
            <div className="dai-cond-offer-live">
              <p className="dai-cond-offer-live__label">Rate aktuell</p>
              <p className="dai-cond-offer-live__value">
                {preview.monthlyRate.toLocaleString('de-DE')} €/Monat
              </p>
            </div>
          ) : (
            <div className="dai-cond-offer-pending">
              <p className="dai-cond-offer-pending__title">Finanzierungsangebot vorbereiten</p>
              <p className="dai-cond-offer-pending__text">Rate wird im Bankangebot bestätigt.</p>
            </div>
          )}
        </>
      )}

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
