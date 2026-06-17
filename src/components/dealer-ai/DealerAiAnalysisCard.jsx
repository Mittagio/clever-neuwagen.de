import { useState } from 'react';
import {
  DEALER_AI_ACTIONS,
  DEALER_AI_BUDGET_OPTIONS,
  DEALER_AI_CASH_PRICE_OPTIONS,
  DEALER_AI_DELIVERY_DATE_OPTIONS,
  DEALER_AI_MILEAGE_OPTIONS,
  DEALER_AI_PAYMENT_OPTIONS,
  DEALER_AI_TERM_OPTIONS,
  PAYMENT_TYPE_LABELS,
  buildCompactWishSummary,
  formatBudgetDisplay,
  formatDeliveryDisplay,
  formatPaymentDisplay,
  getActionsForPaymentType,
} from '../../services/dealerAiParser.js';
import { getBudgetFieldLabel } from '../../services/dealerAiBudget.js';
import LeadDetailPanel from './LeadDetailPanel.jsx';

const SHEETS = {
  payment: 'payment',
  budget: 'budget',
  delivery: 'delivery',
  action: 'action',
};

function OptionList({ options, value, onSelect, formatLabel }) {
  return (
    <div className="dai-sheet-options" role="listbox">
      {options.map((opt) => {
        const id = typeof opt === 'object' ? opt.id : opt;
        const label = formatLabel ? formatLabel(opt) : String(opt);
        const selected = value === id;
        return (
          <button
            key={id}
            type="button"
            role="option"
            aria-selected={selected}
            className={`dai-sheet-option${selected ? ' is-active' : ''}`}
            onClick={() => onSelect(id)}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function BudgetChips({ label, options, suffix, value, onChange }) {
  return (
    <div className="dai-sheet-chips-group">
      <p className="dai-sheet-chips-group__label">{label}</p>
      <div className="dai-budget-chips dai-budget-chips--sheet" role="listbox" aria-label={label}>
        {options.map((amount) => (
          <button
            key={amount}
            type="button"
            role="option"
            aria-selected={value === amount}
            className={`dai-budget-chip${value === amount ? ' is-active' : ''}`}
            onClick={() => onChange(amount)}
          >
            {amount.toLocaleString('de-DE')} {suffix}
          </button>
        ))}
      </div>
    </div>
  );
}

function ReviewRow({ label, value, onClick }) {
  return (
    <button type="button" className="dai-review-row" onClick={onClick}>
      <span className="dai-review-row__label">{label}</span>
      <span className="dai-review-row__value">{value}</span>
      <span className="dai-review-row__chev" aria-hidden>›</span>
    </button>
  );
}

export default function DealerAiAnalysisCard({
  parsed,
  onFieldsChange,
}) {
  const [activeSheet, setActiveSheet] = useState(null);

  if (!parsed?.ok) return null;

  const { fields } = parsed;
  const paymentType = fields.paymentType ?? 'unknown';
  const actionOptions = getActionsForPaymentType(paymentType);
  const wishSummary = buildCompactWishSummary(fields);

  function closeSheet() {
    setActiveSheet(null);
  }

  function openSheet(id) {
    setActiveSheet(id);
  }

  return (
    <section className="dai-review">
      <div className="dai-review-summary-card">
        <span className="dai-review-summary-card__title">Kundenwunsch</span>
        <span className="dai-review-summary-card__text">{wishSummary}</span>
      </div>

      <div className="dai-review-rows">
        <ReviewRow
          label="Angebotsart"
          value={formatPaymentDisplay(fields)}
          onClick={() => openSheet(SHEETS.payment)}
        />
        <ReviewRow
          label={getBudgetFieldLabel(paymentType)}
          value={formatBudgetDisplay(fields)}
          onClick={() => openSheet(SHEETS.budget)}
        />
        <ReviewRow
          label="Übergabe"
          value={formatDeliveryDisplay(fields)}
          onClick={() => openSheet(SHEETS.delivery)}
        />
        <ReviewRow
          label="Aktion"
          value={DEALER_AI_ACTIONS[parsed.action]?.label ?? parsed.actionLabel}
          onClick={() => openSheet(SHEETS.action)}
        />
      </div>

      <LeadDetailPanel
        open={activeSheet === SHEETS.payment}
        onClose={closeSheet}
        title="Angebotsart"
      >
        <OptionList
          options={DEALER_AI_PAYMENT_OPTIONS}
          value={paymentType}
          formatLabel={(id) => PAYMENT_TYPE_LABELS[id] ?? id}
          onSelect={(id) => {
            const patch = { paymentType: id ?? 'unknown' };
            if (id === 'cash') patch.desiredRate = null;
            else if (id && id !== 'unknown') patch.desiredPrice = null;
            onFieldsChange?.(patch);
            closeSheet();
          }}
        />
      </LeadDetailPanel>

      <LeadDetailPanel
        open={activeSheet === SHEETS.budget}
        onClose={closeSheet}
        title={getBudgetFieldLabel(paymentType)}
      >
        {(paymentType === 'leasing' || paymentType === 'financing' || paymentType === 'threeWayFinancing') && (
          <BudgetChips
            label="Monatsrate"
            options={DEALER_AI_BUDGET_OPTIONS}
            suffix="€/Monat"
            value={fields.desiredRate}
            onChange={(v) => onFieldsChange?.({ desiredRate: v })}
          />
        )}
        {paymentType === 'cash' && (
          <BudgetChips
            label="Kaufpreis"
            options={DEALER_AI_CASH_PRICE_OPTIONS}
            suffix="€"
            value={fields.desiredPrice}
            onChange={(v) => onFieldsChange?.({ desiredPrice: v })}
          />
        )}
        {paymentType === 'unknown' && (
          <p className="dai-sheet-hint">Angebotsart wählen – dann passt sich das Budget an.</p>
        )}
        {(paymentType === 'leasing' || paymentType === 'threeWayFinancing' || paymentType === 'financing') && (
          <>
            <div className="dai-sheet-chips-group">
              <p className="dai-sheet-chips-group__label">Laufzeit</p>
              <div className="dai-budget-chips dai-budget-chips--sheet">
                {DEALER_AI_TERM_OPTIONS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    className={`dai-budget-chip${fields.termMonths === m ? ' is-active' : ''}`}
                    onClick={() => onFieldsChange?.({ termMonths: m })}
                  >
                    {m} Monate
                  </button>
                ))}
              </div>
            </div>
            {(paymentType === 'leasing' || paymentType === 'threeWayFinancing') && (
              <div className="dai-sheet-chips-group">
                <p className="dai-sheet-chips-group__label">Kilometer</p>
                <div className="dai-budget-chips dai-budget-chips--sheet">
                  {DEALER_AI_MILEAGE_OPTIONS.map((km) => (
                    <button
                      key={km}
                      type="button"
                      className={`dai-budget-chip${fields.mileagePerYear === km ? ' is-active' : ''}`}
                      onClick={() => onFieldsChange?.({ mileagePerYear: km })}
                    >
                      {km.toLocaleString('de-DE')} km/Jahr
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
        <button type="button" className="dai-btn dai-btn--primary dai-btn--block" onClick={closeSheet}>
          Fertig
        </button>
      </LeadDetailPanel>

      <LeadDetailPanel
        open={activeSheet === SHEETS.delivery}
        onClose={closeSheet}
        title="Übergabe"
      >
        <div className="dai-budget-chips dai-budget-chips--sheet dai-budget-chips--scroll" role="listbox" aria-label="Übergabe">
          {DEALER_AI_DELIVERY_DATE_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              role="option"
              aria-selected={fields.desiredDeliveryDate === option}
              className={`dai-budget-chip${fields.desiredDeliveryDate === option ? ' is-active' : ''}`}
              onClick={() => onFieldsChange?.({ desiredDeliveryDate: option })}
            >
              {option}
            </button>
          ))}
        </div>
        <label className="dai-lead-field" htmlFor="dai-delivery-free">
          <span className="dai-lead-field__label">Freitext</span>
          <input
            id="dai-delivery-free"
            type="text"
            className="dai-field-text"
            placeholder="z. B. Ende Juni"
            value={fields.desiredDeliveryDate ?? ''}
            onChange={(e) => onFieldsChange?.({ desiredDeliveryDate: e.target.value || null })}
          />
        </label>
        <button type="button" className="dai-btn dai-btn--primary dai-btn--block" onClick={closeSheet}>
          Fertig
        </button>
      </LeadDetailPanel>

      <LeadDetailPanel
        open={activeSheet === SHEETS.action}
        onClose={closeSheet}
        title="Aktion"
      >
        <OptionList
          options={actionOptions}
          value={parsed.action}
          formatLabel={(id) => DEALER_AI_ACTIONS[id]?.label ?? id}
          onSelect={(id) => {
            onFieldsChange?.({ action: id });
            closeSheet();
          }}
        />
      </LeadDetailPanel>
    </section>
  );
}
