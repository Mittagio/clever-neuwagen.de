import { useEffect, useMemo, useState } from 'react';
import { DEALER_AI_PURCHASE_BUDGET_VALUES } from '../../services/dealerAiBudget.js';
import LeadDetailPanel from './LeadDetailPanel.jsx';
import './CustomerAkte.css';

const PAYMENT_OPTIONS = [
  { id: 'leasing', label: 'Leasing' },
  { id: 'financing', label: 'Finanzierung', aliases: ['threeWayFinancing'] },
  { id: 'cash', label: 'Kauf' },
];

const TYPICAL_TERMS = [24, 36, 48];
const TERM_OPTIONS = Array.from({ length: 12 }, (_, i) => (i + 1) * 6); // 6 … 72
const MILEAGE_OPTIONS = [10000, 15000, 20000, 25000, 30000];
const DOWN_QUICK = [1000, 2000, 3000, 4000, 5000];
const DOWN_MIN = 0;
const DOWN_MAX = 20000;
const DOWN_STEP = 500;
const MONTHLY_BUDGET_OPTIONS = [199, 249, 299, 349, 399, 449, 499, 599];

const DELIVERY_OPTIONS = [
  { value: 'sofort', label: 'Sofort' },
  { value: '1-3-monate', label: '1–3 Monate' },
  { value: '3-6-monate', label: '3–6 Monate' },
  { value: '', label: 'Egal / offen' },
];

const FIELD_TITLES = {
  paymentType: 'Zahlungsart',
  downPayment: 'Anzahlung',
  termMonths: 'Laufzeit',
  mileagePerYear: 'km/Jahr',
  delivery: 'Verfügbarkeit',
  desiredRate: 'Wunschrate',
  desiredPrice: 'Budget',
};

function formatEuro(amount) {
  const num = Number(amount) || 0;
  if (num === 0) return '0 €';
  return `${num.toLocaleString('de-DE')} €`;
}

function paymentActive(opt, paymentType) {
  if (paymentType === opt.id) return true;
  return (opt.aliases ?? []).includes(paymentType);
}

function snapDownPayment(value) {
  const num = Number(value) || 0;
  const snapped = Math.round(num / DOWN_STEP) * DOWN_STEP;
  return Math.min(DOWN_MAX, Math.max(DOWN_MIN, snapped));
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
          <option key={opt.value === '' ? '__empty' : opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

/**
 * Chip-Klick → nur dieses Feld (focusField).
 * Ausnahme Zahlungsart: Leasing/Finanzierung/Kauf inkl. abhängiger Konditionen.
 * Ohne focusField (Ändern) → komplettes Sheet.
 */
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
  const [showAllTerms, setShowAllTerms] = useState(false);
  const [customMileage, setCustomMileage] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDraft(values);
    const term = Number(values.termMonths);
    setShowAllTerms(Boolean(term) && !TYPICAL_TERMS.includes(term));
    const km = Number(values.mileagePerYear);
    setCustomMileage(Boolean(km) && !MILEAGE_OPTIONS.includes(km));
  }, [open, values]);

  const paymentType = draft.paymentType ?? 'unknown';
  const isCash = paymentType === 'cash';
  const isLeasing = paymentType === 'leasing';
  const showFinanceFields = !isCash && paymentType !== 'unknown';
  const singleField = Boolean(focusField) && focusField !== 'paymentType';

  function showField(id) {
    if (!focusField) return true;
    if (focusField === 'paymentType') {
      return [
        'paymentType',
        'downPayment',
        'termMonths',
        'mileagePerYear',
        'desiredRate',
        'desiredPrice',
      ].includes(id);
    }
    return focusField === id;
  }

  /** Einzel-Chip: Feld trotzdem zeigen, auch wenn Zahlungsart noch unbekannt. */
  function showCommercial(id) {
    if (!showField(id)) return false;
    if (singleField && focusField === id) return true;
    if (!showFinanceFields) return false;
    if (id === 'mileagePerYear') return isLeasing;
    return true;
  }

  const budgetOptions = useMemo(
    () => (isCash ? DEALER_AI_PURCHASE_BUDGET_VALUES : MONTHLY_BUDGET_OPTIONS),
    [isCash],
  );

  const downValue = snapDownPayment(draft.downPayment);

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
    onApply?.({
      ...draft,
      downPayment: String(snapDownPayment(draft.downPayment)),
    });
  }

  const budgetSelectOptions = [
    { value: '', label: 'Offen' },
    ...budgetOptions.map((amount) => ({
      value: String(amount),
      label: isCash ? formatEuro(amount) : `${amount} €/Monat`,
    })),
  ];

  const sheetTitle = focusField && FIELD_TITLES[focusField]
    ? FIELD_TITLES[focusField]
    : 'Konditionen ändern';

  const termIsCustom = Number(draft.termMonths) > 0
    && !TYPICAL_TERMS.includes(Number(draft.termMonths));
  const mileageIsCustom = Number(draft.mileagePerYear) > 0
    && !MILEAGE_OPTIONS.includes(Number(draft.mileagePerYear));

  return (
    <LeadDetailPanel
      open={open}
      onClose={onClose}
      title={sheetTitle}
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
      <div className={`cust-wish-sheet${singleField ? ' cust-wish-sheet--single' : ''}`}>
        {showField('paymentType') ? (
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
        ) : null}

        {showCommercial('downPayment') ? (
          <SheetField label="Anzahlung" fieldId="downPayment" focused={focusField === 'downPayment'}>
            <p className="cust-wish-sheet__value-display">{formatEuro(downValue)}</p>
            <input
              type="range"
              min={DOWN_MIN}
              max={DOWN_MAX}
              step={DOWN_STEP}
              value={downValue}
              className="cust-wish-sheet__slider"
              aria-label="Anzahlung"
              onChange={(e) => patch({
                downPayment: String(snapDownPayment(e.target.value)),
              })}
            />
            <div className="cust-wish-sheet__ticks">
              <button
                type="button"
                className={`cust-wish-sheet__tick${downValue === 0 ? ' is-active' : ''}`}
                onClick={() => patch({ downPayment: '0' })}
              >
                0 €
              </button>
              {DOWN_QUICK.map((amount) => (
                <button
                  key={amount}
                  type="button"
                  className={`cust-wish-sheet__tick${downValue === amount ? ' is-active' : ''}`}
                  onClick={() => patch({ downPayment: String(amount) })}
                >
                  {formatEuro(amount)}
                </button>
              ))}
            </div>
            <p className="cust-wish-sheet__hint">In 500-€-Schritten bis {formatEuro(DOWN_MAX)}</p>
          </SheetField>
        ) : null}

        {showCommercial('termMonths') ? (
          <SheetField label="Laufzeit" fieldId="termMonths" focused={focusField === 'termMonths'}>
            <div className="cust-wish-sheet-segmented" role="group" aria-label="Typische Laufzeit">
              {TYPICAL_TERMS.map((months) => (
                <button
                  key={months}
                  type="button"
                  className={`cust-wish-sheet-segmented__btn${Number(draft.termMonths) === months ? ' is-active' : ''}`}
                  onClick={() => {
                    setShowAllTerms(false);
                    patch({ termMonths: String(months) });
                  }}
                  aria-pressed={Number(draft.termMonths) === months}
                >
                  {months}
                </button>
              ))}
              <button
                type="button"
                className={`cust-wish-sheet-segmented__btn${showAllTerms || termIsCustom ? ' is-active' : ''}`}
                onClick={() => setShowAllTerms((v) => !v)}
                aria-expanded={showAllTerms || termIsCustom}
              >
                Weitere
              </button>
            </div>
            {(showAllTerms || termIsCustom) ? (
              <div className="cust-wish-sheet-segmented cust-wish-sheet-segmented--wrap cust-wish-sheet-segmented--terms" role="group" aria-label="Laufzeit 6–72 Monate">
                {TERM_OPTIONS.map((months) => (
                  <button
                    key={months}
                    type="button"
                    className={`cust-wish-sheet-segmented__btn${Number(draft.termMonths) === months ? ' is-active' : ''}${TYPICAL_TERMS.includes(months) ? ' is-typical' : ''}`}
                    onClick={() => patch({ termMonths: String(months) })}
                    aria-pressed={Number(draft.termMonths) === months}
                  >
                    {months}
                  </button>
                ))}
              </div>
            ) : null}
          </SheetField>
        ) : null}

        {showCommercial('mileagePerYear') ? (
          <SheetField label="km/Jahr" fieldId="mileagePerYear" focused={focusField === 'mileagePerYear'}>
            <div className="cust-wish-sheet-segmented cust-wish-sheet-segmented--wrap" role="group" aria-label="Laufleistung">
              {MILEAGE_OPTIONS.map((km) => (
                <button
                  key={km}
                  type="button"
                  className={`cust-wish-sheet-segmented__btn${Number(draft.mileagePerYear) === km ? ' is-active' : ''}`}
                  onClick={() => {
                    setCustomMileage(false);
                    patch({ mileagePerYear: String(km) });
                  }}
                  aria-pressed={Number(draft.mileagePerYear) === km}
                >
                  {km.toLocaleString('de-DE')}
                </button>
              ))}
              <button
                type="button"
                className={`cust-wish-sheet-segmented__btn${customMileage || mileageIsCustom ? ' is-active' : ''}`}
                onClick={() => setCustomMileage(true)}
                aria-pressed={customMileage || mileageIsCustom}
              >
                Weitere
              </button>
            </div>
            {(customMileage || mileageIsCustom) ? (
              <label className="cust-wish-sheet-custom">
                <span className="cust-wish-sheet-custom__label">Eigene km/Jahr</span>
                <input
                  type="number"
                  className="cust-wish-sheet-custom__input"
                  min={1000}
                  max={100000}
                  step={500}
                  inputMode="numeric"
                  placeholder="z. B. 12500"
                  value={draft.mileagePerYear ?? ''}
                  onChange={(e) => patch({ mileagePerYear: e.target.value })}
                />
              </label>
            ) : null}
          </SheetField>
        ) : null}

        {paymentType !== 'unknown' && showField(budgetField) ? (
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
        ) : null}

        {showField('delivery') ? (
          <SheetField
            label="Verfügbarkeit"
            fieldId="delivery"
            focused={focusField === 'delivery'}
          >
            <div className="cust-wish-sheet-segmented cust-wish-sheet-segmented--wrap" role="group" aria-label="Verfügbarkeit">
              {DELIVERY_OPTIONS.map((opt) => (
                <button
                  key={opt.value === '' ? '__open' : opt.value}
                  type="button"
                  className={`cust-wish-sheet-segmented__btn${String(draft.delivery ?? '') === opt.value ? ' is-active' : ''}`}
                  onClick={() => patch({ delivery: opt.value })}
                  aria-pressed={String(draft.delivery ?? '') === opt.value}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </SheetField>
        ) : null}
      </div>
    </LeadDetailPanel>
  );
}
