import { useMemo, useState } from 'react';
import {
  buildBudgetPriceOptions,
  buildBudgetRateOptions,
} from '../../services/dealerAiMailExtractor.js';
import { LEASING_MILEAGE_OPTIONS, LEASING_TERM_OPTIONS } from '../../data/dealerConditionsSchema.js';
import { vehicleConfigurationTitle } from '../../services/configuration/vehicleConfigurationModel.js';
import VehicleConfigurationSummary from './VehicleConfigurationSummary.jsx';
import './DealerAiConditionsStep.css';
import './VehicleConfigurationSummary.css';

const PAYMENT_CARDS = [
  { id: 'leasing', label: 'Leasing', hint: 'Monatliche Rate' },
  { id: 'financing', label: 'Finanzierung', hint: 'Kredit / 3-Wege' },
  { id: 'cash', label: 'Kauf', labelAlt: 'Barzahlung', hint: 'Einmalzahlung' },
];

const TERM_PRIMARY = [24, 36, 48, 60];
const MILEAGE_PRIMARY = [10000, 15000, 20000];
const DOWN_PRIMARY = [0, 3000, 6000];

const TERM_EXTENDED = LEASING_TERM_OPTIONS.filter((m) => !TERM_PRIMARY.includes(m));
const MILEAGE_EXTENDED = LEASING_MILEAGE_OPTIONS.filter(
  (km) => !MILEAGE_PRIMARY.includes(km) && km <= 30000,
);

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
  return `${(km / 1000).toLocaleString('de-DE')}.000`;
}

function formatDownPayment(value) {
  return value === 0 ? '0 €' : `${value.toLocaleString('de-DE')} €`;
}

function formatTermChip(months, compact = false) {
  return compact ? String(months) : `${months} Monate`;
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

function ExpandableChipSection({
  title,
  primaryValues,
  extendedValues,
  current,
  onSelect,
  formatPrimary,
  formatExtended,
  expandLabel,
  extraContent = null,
}) {
  const inPrimary = primaryValues.includes(current);
  const inExtended = extendedValues.includes(current);
  const showCustomSelected = current != null && !inPrimary && !inExtended;

  return (
    <SectionBlock title={title}>
      <div className="dai-cond-chips">
        {primaryValues.map((value) => (
          <ChoiceChip
            key={value}
            label={formatPrimary(value)}
            selected={current === value}
            onClick={() => onSelect(value)}
          />
        ))}
        {showCustomSelected && (
          <ChoiceChip
            label={formatExtended?.(current) ?? String(current)}
            selected
            onClick={() => onSelect(current)}
          />
        )}
      </div>
      {(extendedValues.length > 0 || extraContent) && (
        <details className="dai-cond-more">
          <summary>{expandLabel}</summary>
          <div className="dai-cond-more__body">
            {extendedValues.length > 0 && (
              <div className="dai-cond-chips dai-cond-chips--extended">
                {extendedValues.map((value) => (
                  <ChoiceChip
                    key={value}
                    label={formatExtended?.(value) ?? String(value)}
                    selected={current === value}
                    onClick={() => onSelect(value)}
                  />
                ))}
              </div>
            )}
            {extraContent}
          </div>
        </details>
      )}
    </SectionBlock>
  );
}

/** Schritt 2 – Konditionen (Händlerwelt, keine Live-Rate) */
export default function DealerAiConditionsStep({
  draft,
  vehicleConfiguration,
  parsed,
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

  const budgetRateOptions = useMemo(
    () => buildBudgetRateOptions(draft.desiredRate).map((amount) => ({
      id: String(amount),
      label: `${amount.toLocaleString('de-DE')} €`,
    })),
    [draft.desiredRate],
  );

  const budgetPriceOptions = useMemo(
    () => buildBudgetPriceOptions(draft.desiredPrice).map((amount) => ({
      id: String(amount),
      label: `${amount.toLocaleString('de-DE')} €`,
    })),
    [draft.desiredPrice],
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

  function patchBudgetRate(value) {
    if (!value) patch({ desiredRate: null });
    else patch({ desiredRate: Number(value), desiredPrice: null });
  }

  function patchBudgetPrice(value) {
    if (!value) patch({ desiredPrice: null });
    else patch({ desiredPrice: Number(value), desiredRate: null });
  }

  function applyCustomDownPayment() {
    const parsedAmount = Number(String(customDownPayment).replace(/\./g, '').replace(',', '.').trim());
    if (!Number.isFinite(parsedAmount) || parsedAmount < 0) return;
    patch({ downPayment: Math.round(parsedAmount) });
    setCustomDownPayment('');
  }

  const vehicleTitle = vehicleConfigurationTitle(vehicleConfiguration);

  const subtitleParts = [];
  if (!isCash && draft.termMonths) subtitleParts.push(`${draft.termMonths} Monate`);
  if (isLeasing && draft.mileagePerYear) {
    subtitleParts.push(`${formatMileage(draft.mileagePerYear)} km`);
  }
  if (!isCash && draft.downPayment != null) {
    subtitleParts.push(`${formatDownPayment(draft.downPayment)} Anzahlung`);
  }
  const subtitle = subtitleParts.join(' · ');

  const activePaymentCard = isCash
    ? 'cash'
    : isFinance
      ? 'financing'
      : 'leasing';

  const uvpTotal = vehicleConfiguration.uvpConfigurationPrice;
  const termValue = draft.termMonths ?? 48;
  const mileageValue = draft.mileagePerYear ?? 15000;
  const downValue = draft.downPayment ?? 0;

  return (
    <div className="dai-conditions dai-conditions--sales">
      <header className="dai-cond-hero">
        {onBack && (
          <button type="button" className="dai-cond-hero__back" onClick={onBack}>
            ← Zur Konfiguration
          </button>
        )}
        <h2 className="dai-cond-hero__vehicle">{vehicleTitle || draft.model}</h2>
        <p className="dai-cond-hero__uvp">{formatCurrency(uvpTotal)}</p>
        <p className="dai-cond-hero__meta">
          UVP Konfiguration
          {subtitle ? ` · ${subtitle}` : ''}
        </p>
      </header>

      <div className="dai-cond-config-handover">
        <p className="dai-cond-config-handover__label">Konfiguration übernommen</p>
        <p className="dai-cond-config-handover__title">{vehicleTitle}</p>
        <VehicleConfigurationSummary configuration={vehicleConfiguration} compact showSelections={false} />
      </div>

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

      {!isCash && (
        <ExpandableChipSection
          title="Laufzeit"
          primaryValues={TERM_PRIMARY}
          extendedValues={TERM_EXTENDED}
          current={termValue}
          onSelect={(months) => patch({ termMonths: months })}
          formatPrimary={(months) => formatTermChip(months, true)}
          formatExtended={(months) => formatTermChip(months, false)}
          expandLabel="Weitere Laufzeiten"
        />
      )}

      {isLeasing && (
        <ExpandableChipSection
          title="Kilometer"
          primaryValues={MILEAGE_PRIMARY}
          extendedValues={MILEAGE_EXTENDED}
          current={mileageValue}
          onSelect={(km) => patch({ mileagePerYear: km })}
          formatPrimary={(km) => formatMileage(km)}
          formatExtended={(km) => `${formatMileage(km)} km/Jahr`}
          expandLabel="Weitere Kilometer"
        />
      )}

      {!isCash && (
        <ExpandableChipSection
          title="Anzahlung"
          primaryValues={DOWN_PRIMARY}
          extendedValues={[9000, 12000, 15000]}
          current={downValue}
          onSelect={(amount) => patch({ downPayment: amount })}
          formatPrimary={formatDownPayment}
          formatExtended={formatDownPayment}
          expandLabel="Eigene Anzahlung"
          extraContent={(
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
          )}
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

      {(isLeasing || isCash) && (
        <SectionBlock title="Überführung">
          <div className="dai-cond-chips">
            <ChoiceChip
              label={formatCurrency(preparationFee)}
              selected
              onClick={() => {}}
              className="is-selected is-static"
            />
          </div>
        </SectionBlock>
      )}

      <SectionBlock title="Wunschlieferdatum">
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
      </SectionBlock>

      <p className="dai-cond-preview-hint">
        Rate, Rabatt und Angebot werden erst in der Angebotsvorschau berechnet.
      </p>

      <details className="dai-cond-wish-fold">
        <summary>Kundenwunsch</summary>
        <div className="dai-cond-wish-fold__body">
          <p className="dai-cond-wish-fold__hint">
            Optional – nur wenn der Kunde eine Wunschrate oder einen Wunschpreis genannt hat.
          </p>
          {!isCash ? (
            <div className="dai-cond-chips dai-cond-chips--budget">
              <ChoiceChip
                label="Offen"
                selected={draft.desiredRate == null}
                onClick={() => patchBudgetRate(null)}
              />
              {budgetRateOptions.map((opt) => (
                <ChoiceChip
                  key={opt.id}
                  label={opt.label}
                  selected={String(draft.desiredRate) === opt.id}
                  onClick={() => patchBudgetRate(opt.id)}
                />
              ))}
            </div>
          ) : (
            <div className="dai-cond-chips dai-cond-chips--budget">
              <ChoiceChip
                label="Offen"
                selected={draft.desiredPrice == null}
                onClick={() => patchBudgetPrice(null)}
              />
              {budgetPriceOptions.map((opt) => (
                <ChoiceChip
                  key={opt.id}
                  label={opt.label}
                  selected={String(draft.desiredPrice) === opt.id}
                  onClick={() => patchBudgetPrice(opt.id)}
                />
              ))}
            </div>
          )}
        </div>
      </details>

      <footer className="dai-cond-sticky-foot">
        <p className="dai-cond-sticky-foot__summary">
          <span className="dai-cond-sticky-foot__uvp">{formatCurrency(uvpTotal)}</span>
          <span className="dai-cond-sticky-foot__label"> UVP · Angebot in Vorschau</span>
        </p>
        <button
          type="button"
          className="dai-cond-sticky-foot__cta"
          onClick={onContinue}
          disabled={isExecuting}
        >
          {isExecuting ? 'Wird geladen …' : 'Angebotsvorschau anzeigen'}
        </button>
      </footer>
    </div>
  );
}
