import { useEffect, useMemo, useState } from 'react';
import { DEALER_AI_PURCHASE_BUDGET_VALUES } from '../../services/dealerAiBudget.js';
import LeadDetailPanel from './LeadDetailPanel.jsx';
import './CustomerAkte.css';

const PAYMENT_OPTIONS = [
  { id: 'leasing', label: 'Leasing' },
  { id: 'financing', label: 'Finanzierung', aliases: ['threeWayFinancing'] },
  { id: 'cash', label: 'Kauf' },
];

const TERM_OPTIONS = [24, 36, 48, 60];
const MILEAGE_OPTIONS = [5000, 10000, 15000, 20000, 30000];
const DOWN_OPTIONS = [0, 1000, 3000, 5000, 10000];
const MONTHLY_BUDGET_OPTIONS = [199, 249, 299, 349, 399, 449, 499, 599];

const DELIVERY_OPTIONS = [
  { value: 'sofort', label: 'Sofort' },
  { value: '1-3-monate', label: '1–3 Monate' },
  { value: '3-6-monate', label: '3–6 Monate' },
  { value: '', label: 'Egal' },
];

function formatEuro(amount) {
  const num = Number(amount) || 0;
  if (num === 0) return '0 €';
  return `${num.toLocaleString('de-DE')} €`;
}

function paymentActive(opt, paymentType) {
  if (paymentType === opt.id) return true;
  return (opt.aliases ?? []).includes(paymentType);
}

function nearestDownIndex(value) {
  const num = Number(value) || 0;
  let best = 0;
  let bestDiff = Math.abs(DOWN_OPTIONS[0] - num);
  DOWN_OPTIONS.forEach((step, index) => {
    const diff = Math.abs(step - num);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = index;
    }
  });
  return best;
}

function SheetField({ label, children, fieldId, focused = false }) {
  return (
    <div
      className={`cust-wish-sheet-field${focused ? ' is-focused' : ''}`}
      id={fieldId ? `wish-field-${fieldId}` : undefined}
      data-wish-field={fieldId || undefined}
    >
      <span className="cust-wish-sheet-field__label">{label}</span>
      {children}
    </div>
  );
}

function SheetSelect({ value, onChange, options }) {
  return (
    <div className="cust-wish-sheet-select">
      <select
        className="cust-wish-sheet-select__input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

export default function CustomerAkteWishConditionsSheet({
  open,
  onClose,
  values = {},
  onApply,
  getBudgetFieldLabel = () => 'Budget / Rate',
  saving = false,
  focusField = null,
}) {
  const [draft, setDraft] = useState(values);

  useEffect(() => {
    if (open) setDraft(values);
  }, [open, values]);

  useEffect(() => {
    if (!open || !focusField) return undefined;
    const timer = window.setTimeout(() => {
      document.getElementById(`wish-field-${focusField}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }, 180);
    return () => window.clearTimeout(timer);
  }, [open, focusField]);

  const paymentType = draft.paymentType ?? 'unknown';
  const isCash = paymentType === 'cash';
  const isLeasing = paymentType === 'leasing';
  const showFinanceFields = !isCash && paymentType !== 'unknown';

  const budgetOptions = useMemo(
    () => (isCash ? DEALER_AI_PURCHASE_BUDGET_VALUES : MONTHLY_BUDGET_OPTIONS),
    [isCash],
  );

  const downIndex = nearestDownIndex(draft.downPayment);

  function patch(next) {
    setDraft((prev) => ({ ...prev, ...next }));
  }

  function handlePaymentChange(id) {
    patch({
      paymentType: id,
      desiredRate: id === 'cash' ? '' : draft.desiredRate,
      desiredPrice: id === 'cash' ? draft.desiredPrice : '',
    });
  }

  const budgetField = isCash ? 'desiredPrice' : 'desiredRate';

  function handleApply() {
    onApply?.(draft);
  }

  const termSelectOptions = TERM_OPTIONS.map((m) => ({
    value: String(m),
    label: `${m} Monate`,
  }));

  const mileageSelectOptions = MILEAGE_OPTIONS.map((km) => ({
    value: String(km),
    label: `${km.toLocaleString('de-DE')} km/Jahr`,
  }));

  const budgetSelectOptions = [
    { value: '', label: 'Offen' },
    ...budgetOptions.map((amount) => ({
      value: String(amount),
      label: isCash ? formatEuro(amount) : `${amount} €/Monat`,
    })),
  ];

  return (
    <LeadDetailPanel
      open={open}
      onClose={onClose}
      title="Konditionen ändern"
      footer={(
        <button
          type="button"
          className="cust-wish-sheet__apply"
          onClick={handleApply}
          disabled={saving}
        >
          {saving ? 'Übernehmen …' : 'Übernehmen'}
        </button>
      )}
    >
      <div className="cust-wish-sheet">
        <SheetField label="Zahlungsart" fieldId="paymentType" focused={focusField === 'paymentType'}>
          <div className="cust-wish-sheet-segmented" role="group" aria-label="Zahlungsart">
            {PAYMENT_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={`cust-wish-sheet-segmented__btn${paymentActive(opt, paymentType) ? ' is-active' : ''}`}
                onClick={() => handlePaymentChange(opt.id)}
                aria-pressed={paymentActive(opt, paymentType)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </SheetField>

        {showFinanceFields && (
          <>
            <SheetField label="Anzahlung" fieldId="downPayment" focused={focusField === 'downPayment'}>
              <p className="cust-wish-sheet__value-display">{formatEuro(draft.downPayment ?? 0)}</p>
              <input
                type="range"
                min={0}
                max={DOWN_OPTIONS.length - 1}
                step={1}
                value={downIndex}
                className="cust-wish-sheet__slider"
                aria-label="Anzahlung"
                onChange={(e) => patch({
                  downPayment: String(DOWN_OPTIONS[Number(e.target.value)]),
                })}
              />
              <div className="cust-wish-sheet__ticks">
                {DOWN_OPTIONS.map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    className={`cust-wish-sheet__tick${
                      Number(draft.downPayment ?? 0) === amount ? ' is-active' : ''
                    }`}
                    onClick={() => patch({ downPayment: String(amount) })}
                  >
                    {formatEuro(amount)}
                  </button>
                ))}
              </div>
            </SheetField>

            <SheetField label="Laufzeit" fieldId="termMonths" focused={focusField === 'termMonths'}>
              <SheetSelect
                value={draft.termMonths ? String(draft.termMonths) : String(TERM_OPTIONS[2])}
                onChange={(v) => patch({ termMonths: v })}
                options={termSelectOptions}
              />
            </SheetField>

            {isLeasing && (
              <SheetField label="Laufleistung / Jahr" fieldId="mileagePerYear" focused={focusField === 'mileagePerYear'}>
                <SheetSelect
                  value={draft.mileagePerYear ? String(draft.mileagePerYear) : String(MILEAGE_OPTIONS[2])}
                  onChange={(v) => patch({ mileagePerYear: v })}
                  options={mileageSelectOptions}
                />
              </SheetField>
            )}
          </>
        )}

        {paymentType !== 'unknown' && (
          <SheetField
            label={getBudgetFieldLabel(paymentType)}
            fieldId={budgetField}
            focused={focusField === budgetField}
          >
            <SheetSelect
              value={isCash ? String(draft.desiredPrice ?? '') : String(draft.desiredRate ?? '')}
              onChange={(v) => patch(
                isCash
                  ? { desiredPrice: v }
                  : { desiredRate: v },
              )}
              options={budgetSelectOptions}
            />
          </SheetField>
        )}

        <SheetField label="Wunschliefertermin" fieldId="delivery" focused={focusField === 'delivery'}>
          <SheetSelect
            value={draft.delivery ?? ''}
            onChange={(v) => patch({ delivery: v })}
            options={DELIVERY_OPTIONS}
          />
        </SheetField>
      </div>
    </LeadDetailPanel>
  );
}
