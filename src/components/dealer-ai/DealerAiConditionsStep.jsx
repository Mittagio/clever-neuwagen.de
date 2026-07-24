import { useMemo, useState } from 'react';
import { resolveConfigureHeroImage } from '../../services/dealerAiVehicleConfigureFlow.js';
import {
  buildConditionsFooterAction,
  buildConditionsFooterSummary,
  buildConditionsSellerHints,
  buildCompactVehicleSummary,
  computeConditionsStepPreview,
  DISCOUNT_GROUP_OPTIONS,
  DOWN_PAYMENT_OPTIONS,
  LEASING_MILEAGE_OPTIONS,
  LEASING_TERM_OPTIONS,
} from '../../services/configuration/conditionsStepPreview.js';
import {
  ConfigurationOverviewTiles,
} from './ConfigurationChecklist.jsx';
import {
  FlowCard,
  FlowChip,
  FlowPrimaryButton,
  FlowStickyFooter,
  OfferFlowLayout,
} from './flow/OfferFlowComponents.jsx';
import { PkwEnVkvCalculatorStatus } from '../compliance/PkwEnVkvBox.jsx';
import './DealerAiConditionsStep.css';

const PAYMENT_CARDS = [
  { id: 'leasing', label: 'Leasing', hint: 'Monatliche Rate' },
  { id: 'financing', label: 'Finanzierung', hint: 'Kredit / 3-Wege' },
  { id: 'cash', label: 'Kauf', hint: 'Barzahlung' },
];

const TERM_QUICK_PICKS = [24, 36, 48, 60];
const MILEAGE_QUICK_PICKS = [10000, 15000, 20000, 25000];
const DOWN_QUICK_PICKS = [0, 3000, 5000];

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

function formatDownTick(value) {
  if (value === 0) return '0 €';
  if (value >= 10000) return `${(value / 1000).toLocaleString('de-DE')}k €`;
  if (value >= 1000) return `${value / 1000}k €`;
  return formatDownPayment(value);
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

function isPresetDownPayment(value) {
  return DOWN_PAYMENT_OPTIONS.includes(value);
}

function buildPrepChips(defaultFee) {
  const values = new Set([...PREP_PRESETS, defaultFee].filter((v) => v != null));
  return [...values].sort((a, b) => a - b);
}

function ChoiceChip({ label, selected, onClick, className = '' }) {
  return (
    <FlowChip label={label} selected={selected} onClick={onClick} className={className} />
  );
}

function PaymentTab({ card, selected, onSelect }) {
  return (
    <button
      type="button"
      className={`dai-cond-pay-tab${selected ? ' is-selected' : ''}`}
      onClick={() => onSelect(card.id)}
      aria-pressed={selected}
    >
      {card.label}
    </button>
  );
}

function CompactVehicleCard({ summary, imageSrc, imageAlt, onEdit }) {
  return (
    <FlowCard className="dai-cond-vehicle-compact" variant="flat">
      <div className="dai-cond-vehicle-compact__row">
        {imageSrc ? (
          <img
            className="dai-cond-vehicle-compact__img"
            src={imageSrc}
            alt={imageAlt ?? summary.modelLine}
          />
        ) : (
          <div className="dai-cond-vehicle-compact__img dai-cond-vehicle-compact__img--placeholder" aria-hidden />
        )}
        <div className="dai-cond-vehicle-compact__body">
          <p className="dai-cond-vehicle-compact__model">{summary.modelLine}</p>
          {summary.metaLine && (
            <p className="dai-cond-vehicle-compact__meta">{summary.metaLine}</p>
          )}
          {summary.uvpFormatted && (
            <p className="dai-cond-vehicle-compact__uvp">
              UPE {summary.uvpFormatted}
            </p>
          )}
        </div>
        {onEdit && (
          <button type="button" className="dai-cond-vehicle-compact__edit" onClick={onEdit}>
            Bearbeiten
          </button>
        )}
      </div>
    </FlowCard>
  );
}

function SellerHints({ hints = [] }) {
  if (!hints.length) return null;
  return (
    <div className="dai-cond-hints" aria-live="polite">
      {hints.map((hint) => (
        <p key={hint.message} className={`dai-cond-hint dai-cond-hint--${hint.tone}`}>
          {hint.message}
        </p>
      ))}
    </div>
  );
}

function CashOfferSection({ draft, customerGroup, onPatch }) {
  return (
    <div className="dai-cond-cash-offer">
      <p className="dai-cond-block__title">Rabatt</p>
      <div className="dai-cond-chips dai-cond-chips--discount">
        {DISCOUNT_GROUP_OPTIONS.map((opt) => (
          <ChoiceChip
            key={opt.id}
            label={opt.label}
            selected={customerGroup === opt.id}
            onClick={() => onPatch({ customerGroup: opt.id })}
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
            onChange={(event) => onPatch({
              customDiscountPercent: event.target.value === ''
                ? null
                : Number(event.target.value),
            })}
          />
          <span className="dai-cond-custom-input__suffix">%</span>
        </div>
      )}
    </div>
  );
}

function QuickPickRow({ picks, value, onChange, formatLabel, extra }) {
  return (
    <div className="dai-cond-quick-picks">
      {picks.map((pick) => (
        <button
          key={pick}
          type="button"
          className={`dai-cond-quick-pick${value === pick ? ' is-selected' : ''}`}
          onClick={() => onChange(pick)}
        >
          {formatLabel(pick)}
        </button>
      ))}
      {extra}
    </div>
  );
}

function StepSlider({
  label,
  steps,
  value,
  onChange,
  formatValue,
  formatTick,
  displayValue,
  footer,
  quickPicks,
  formatQuick,
  quickValue,
  quickExtra,
}) {
  const index = nearestStepIndex(steps, value ?? steps[0]);
  const current = steps[index];
  const tickFormat = formatTick ?? formatValue;
  const shown = displayValue ?? formatValue(current);

  const quickFormat = formatQuick ?? formatValue;
  const hasQuick = quickPicks?.length > 0;

  return (
    <div className={`dai-cond-step${hasQuick ? ' dai-cond-step--with-quick' : ''}`}>
      <div className="dai-cond-step__head">
        <span className="dai-cond-step__label">{label}</span>
        <span className="dai-cond-step__value">{shown}</span>
      </div>
      {hasQuick && (
        <QuickPickRow
          picks={quickPicks}
          value={quickValue ?? current}
          onChange={onChange}
          formatLabel={quickFormat}
          extra={quickExtra}
        />
      )}
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
      {footer}
    </div>
  );
}

function DownPaymentSlider({
  value,
  onChange,
  customDownPayment,
  setCustomDownPayment,
  showCustomDown,
  setShowCustomDown,
}) {
  const preset = isPresetDownPayment(value);
  const sliderValue = preset ? value : DOWN_PAYMENT_OPTIONS[nearestStepIndex(DOWN_PAYMENT_OPTIONS, value)];

  function applyCustomDownPayment() {
    const parsedAmount = Number(String(customDownPayment).replace(/\./g, '').replace(',', '.').trim());
    if (!Number.isFinite(parsedAmount) || parsedAmount < 0) return;
    onChange(Math.round(parsedAmount));
    setCustomDownPayment('');
    setShowCustomDown(false);
  }

  return (
    <StepSlider
      label="Anzahlung"
      steps={DOWN_PAYMENT_OPTIONS}
      value={sliderValue}
      onChange={(amount) => {
        setShowCustomDown(false);
        onChange(amount);
      }}
      formatValue={formatDownPayment}
      formatTick={formatDownTick}
      displayValue={formatDownPayment(value)}
      quickPicks={DOWN_QUICK_PICKS}
      formatQuick={formatDownPayment}
      quickValue={value}
      quickExtra={(
        <button
          type="button"
          className={`dai-cond-quick-pick dai-cond-quick-pick--extra${showCustomDown || !preset ? ' is-selected' : ''}`}
          onClick={() => setShowCustomDown((open) => !open)}
        >
          Eigener Wert
        </button>
      )}
      footer={showCustomDown && (
            <div className="dai-cond-custom-input dai-cond-custom-input--inline">
              <input
                type="text"
                inputMode="numeric"
                className="dai-cond-custom-input__field"
                placeholder="Sonderbetrag in €"
                value={customDownPayment || (!preset ? String(value) : '')}
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
          )}
    />
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
    <div className="dai-cond-prep">
      <div className="dai-cond-step__head">
        <span className="dai-cond-step__label">Überführung</span>
        <span className="dai-cond-step__value">{formatCurrency(value)}</span>
      </div>
      <div className="dai-cond-chips dai-cond-chips--prep">
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
    </div>
  );
}

/** Schritt 2 – Konditionen (Tesla/Apple-Stil) */
export default function DealerAiConditionsStep({
  draft,
  vehicleConfiguration,
  conditions,
  onDraftChange,
  onContinue,
  onSave,
  onBack,
  onEditConfiguration = null,
  backLabel = '← Zur Konfiguration',
  wishChips = [],
  onWishChange,
  isExecuting = false,
}) {
  const [customDownPayment, setCustomDownPayment] = useState('');
  const [showCustomDown, setShowCustomDown] = useState(false);

  if (!draft || !vehicleConfiguration) return null;

  const editConfiguration = onEditConfiguration ?? onBack;

  const paymentType = draft.paymentType === 'unknown' ? 'leasing' : draft.paymentType;
  const isCash = paymentType === 'cash';
  const isFinance = paymentType === 'financing' || paymentType === 'threeWayFinancing';
  const isLeasing = paymentType === 'leasing';
  const isThreeWay = paymentType === 'threeWayFinancing';
  const defaultPreparationFee = conditions?.preparationFee ?? 1290;
  const preparationFee = draft.preparationFee ?? defaultPreparationFee;

  const footerAction = buildConditionsFooterAction();
  const preview = useMemo(
    () => computeConditionsStepPreview(vehicleConfiguration, draft, conditions),
    [vehicleConfiguration, draft, conditions],
  );
  const vehicleSummary = useMemo(
    () => buildCompactVehicleSummary(vehicleConfiguration, draft),
    [vehicleConfiguration, draft],
  );
  const footerSummary = useMemo(
    () => buildConditionsFooterSummary(preview, draft, vehicleSummary),
    [preview, draft, vehicleSummary],
  );
  const sellerHints = useMemo(
    () => buildConditionsSellerHints(preview, draft, wishChips, vehicleConfiguration),
    [preview, draft, wishChips, vehicleConfiguration],
  );
  const heroImage = useMemo(() => resolveConfigureHeroImage(draft), [draft]);

  function patch(partial) {
    onDraftChange({ ...draft, ...partial });
  }

  function handlePaymentType(id) {
    const next = { paymentType: id };
    if (id === 'cash') {
      next.desiredRate = null;
    } else {
      if (draft.desiredPrice && !draft.desiredRate) {
        next.desiredPrice = null;
      }
      if (!draft.termMonths) next.termMonths = 48;
      if (id === 'leasing' && !draft.mileagePerYear) next.mileagePerYear = 15000;
      if (!draft.downPayment && draft.downPayment !== 0) next.downPayment = 0;
    }
    patch(next);
  }

  const vehicleTitle = vehicleSummary.modelLine;

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
    <OfferFlowLayout
      className="dai-cond-workspace"
      backLabel={backLabel}
      onBack={onBack}
      title="Angebotskalkulator"
      subtitle="Konditionen festlegen und Angebot speichern."
    >
      {wishChips.length > 0 ? (
        <FlowCard className="dai-cond-wish-strip" variant="flat">
          <div className="dai-cond-wish-strip__row">
            <p className="dai-cond-wish-strip__line">
              <span className="dai-cond-wish-strip__label">Kundenwunsch · </span>
              {wishChips.join(' · ')}
            </p>
            {onWishChange ? (
              <button
                type="button"
                className="dai-cond-wish-strip__edit"
                onClick={onWishChange}
              >
                Ändern
              </button>
            ) : null}
          </div>
        </FlowCard>
      ) : null}

      <CompactVehicleCard
        summary={vehicleSummary}
        imageSrc={heroImage}
        imageAlt={vehicleTitle}
        onEdit={editConfiguration}
      />

      <PkwEnVkvCalculatorStatus draft={draft} />

      <ConfigurationOverviewTiles
        vehicleConfiguration={vehicleConfiguration}
        onEdit={editConfiguration}
        compact
      />

      <FlowCard className="dai-cond-module" variant="flat">
        <p className="dai-cond-module__title">Angebotsart</p>
        <div className="dai-cond-pay-tabs">
          {PAYMENT_CARDS.map((card) => (
            <PaymentTab
              key={card.id}
              card={card}
              selected={activePaymentCard === card.id}
              onSelect={handlePaymentType}
            />
          ))}
        </div>
        <p className="dai-cond-pay-legend">
          Leasing = monatliche Rate · Finanzierung = Kredit / 3-Wege · Kauf = Barzahlung
        </p>
      </FlowCard>

      <FlowCard className="dai-cond-module dai-cond-module--conditions" variant="flat">
        <p className="dai-cond-module__title">Konditionen</p>

        {isCash && (
          <CashOfferSection
            draft={draft}
            customerGroup={customerGroup}
            onPatch={patch}
          />
        )}

        {(isLeasing || isFinance) && (
          <StepSlider
            label="Laufzeit"
            steps={LEASING_TERM_OPTIONS}
            value={termValue}
            onChange={(months) => patch({ termMonths: months })}
            formatValue={(months) => `${months} Monate`}
            formatTick={(months) => String(months)}
            quickPicks={TERM_QUICK_PICKS}
            formatQuick={(months) => String(months)}
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
            quickPicks={MILEAGE_QUICK_PICKS}
            formatQuick={(km) => `${(km / 1000).toLocaleString('de-DE')}.000`}
          />
        )}

        {(isLeasing || isFinance) && (
          <DownPaymentSlider
            value={downValue}
            onChange={(amount) => patch({ downPayment: amount })}
            customDownPayment={customDownPayment}
            setCustomDownPayment={setCustomDownPayment}
            showCustomDown={showCustomDown}
            setShowCustomDown={setShowCustomDown}
          />
        )}

        <PreparationFeePicker
          value={preparationFee}
          defaultFee={defaultPreparationFee}
          onChange={(fee) => patch({ preparationFee: fee })}
        />
      </FlowCard>

      <SellerHints hints={sellerHints} />

      <details className="dai-cond-wish-fold dai-cond-wish-fold--compact">
        <summary>Weitere Optionen</summary>
        <div className="dai-cond-wish-fold__body">
          <div className="dai-cond-wish-field">
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

          <div className="dai-cond-wish-field">
            <p className="dai-cond-block__title">Leasingende</p>
            <input
              type="text"
              className="dai-cond-wish-input"
              placeholder="z. B. August 2026"
              value={draft.leasingEndDate ?? ''}
              onChange={(event) => patch({ leasingEndDate: event.target.value || null })}
            />
          </div>

          <label className="dai-cond-wish-toggle">
            <input
              type="checkbox"
              checked={Boolean(draft.vehicleChangeIntent)}
              onChange={(event) => patch({ vehicleChangeIntent: event.target.checked })}
            />
            <span>Fahrzeugwechsel geplant</span>
          </label>

          <label className="dai-cond-wish-toggle">
            <input
              type="checkbox"
              checked={Boolean(draft.immediateAvailability)}
              onChange={(event) => patch({ immediateAvailability: event.target.checked })}
            />
            <span>Sofortbedarf</span>
          </label>

          <div className="dai-cond-wish-field">
            <p className="dai-cond-block__title">Freitext Kundenwunsch</p>
            <textarea
              className="dai-cond-wish-textarea"
              rows={3}
              placeholder="Besondere Wünsche oder Hinweise …"
              value={draft.customer?.mailNote ?? ''}
              onChange={(event) => patch({
                customer: { ...draft.customer, mailNote: event.target.value || null },
              })}
            />
          </div>

          {isFinance && (
            <div className="dai-cond-wish-field">
              <p className="dai-cond-block__title">Finanzierungsart</p>
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
            </div>
          )}
        </div>
      </details>

      <FlowStickyFooter className="dai-cond-sticky-live">
        <div className="dai-cond-sticky-live__bar">
          <div className="dai-cond-sticky-live__context">
            {footerSummary.contextLine && (
              <p className="dai-cond-sticky-live__context-line">{footerSummary.contextLine}</p>
            )}
            {footerSummary.upe && preview?.isCash && (
              <p className="dai-cond-sticky-live__meta">UPE {footerSummary.upe}</p>
            )}
            {footerSummary.finalPayment && (
              <p className="dai-cond-sticky-live__meta">{footerSummary.finalPayment}</p>
            )}
          </div>
          {footerSummary.result && (
            <p className={`dai-cond-sticky-live__rate${footerSummary.hasLiveResult ? ' is-live' : ''}`}>
              <span>{footerSummary.result}</span>
              {footerSummary.resultSuffix ? (
                <span className="dai-cond-sticky-live__suffix">{footerSummary.resultSuffix}</span>
              ) : null}
            </p>
          )}
        </div>
        <div className="dai-cond-footer-actions">
          <FlowPrimaryButton
            className="dai-cond-save-btn"
            onClick={onSave ?? onContinue}
            disabled={isExecuting}
          >
            {isExecuting ? 'Wird gespeichert …' : footerAction.label}
          </FlowPrimaryButton>
          {onSave && onContinue ? (
            <button
              type="button"
              className="dai-cond-footer-actions__secondary"
              onClick={onContinue}
              disabled={isExecuting}
            >
              {footerAction.previewLabel}
            </button>
          ) : null}
        </div>
      </FlowStickyFooter>
    </OfferFlowLayout>
  );
}
