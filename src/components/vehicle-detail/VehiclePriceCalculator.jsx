import { useEffect, useMemo, useState } from 'react';
import { formatCurrency } from '../../logic/marketplaceService.js';
import { formatSavingsBlock } from '../../logic/localOfferPresentation.js';
import { computeDetailPricing, buildPaymentTeaserLine } from '../../logic/vehicleDetailPricing.js';
import {
  LEASING_TERMS,
  LEASING_MILEAGES,
  LEASING_DOWN_PAYMENTS,
  FINANCE_TERMS,
  FINANCE_DOWN_PAYMENTS,
  FINANCE_BALLOONS,
} from '../../logic/vehicleDetailConfig.js';
import './vehicle-detail.css';

function OptionChips({ options, value, onChange, formatLabel }) {
  return (
    <div className="vd-calc__chips" role="group">
      {options.map((opt) => {
        const id = typeof opt === 'object' ? opt.id ?? opt : opt;
        const label = formatLabel ? formatLabel(opt) : (typeof opt === 'object' ? opt.label : String(opt));
        return (
          <button
            key={id}
            type="button"
            className={`vd-calc__chip${value === id ? ' is-active' : ''}`}
            onClick={() => onChange(id)}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function CalcPanelBody({
  draft,
  onDraftChange,
  previewPricing,
  discountPercent,
}) {
  const savings = formatSavingsBlock({ cashPrice: previewPricing.cashPrice, discountPercent });
  const tabs = [
    { id: 'leasing', label: 'Leasing' },
    { id: 'finance', label: 'Finanzierung' },
    { id: 'cash', label: 'Kaufpreis' },
  ];

  const set = (patch) => onDraftChange((prev) => ({ ...prev, ...patch }));

  return (
    <>
      <div className="vd-calc__tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`vd-calc__tab${draft.paymentView === tab.id ? ' is-active' : ''}`}
            onClick={() => set({ paymentView: tab.id })}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="vd-calc__live">
        <span className="vd-calc__live-value">{previewPricing.priceLabel}</span>
        <span className="vd-calc__live-sub">{previewPricing.subtitle}</span>
      </div>

      {draft.paymentView === 'leasing' && (
        <div className="vd-calc__fields">
          <div className="vd-calc__field">
            <span className="vd-calc__field-label">Laufzeit</span>
            <OptionChips
              options={LEASING_TERMS}
              value={draft.termMonths}
              onChange={(termMonths) => set({ termMonths })}
              formatLabel={(m) => `${m} Monate`}
            />
          </div>
          <div className="vd-calc__field">
            <span className="vd-calc__field-label">Kilometer</span>
            <OptionChips
              options={LEASING_MILEAGES}
              value={draft.mileagePerYear}
              onChange={(mileagePerYear) => set({ mileagePerYear })}
              formatLabel={(m) => `${m.toLocaleString('de-DE')} km`}
            />
          </div>
          <div className="vd-calc__field">
            <span className="vd-calc__field-label">Anzahlung</span>
            <OptionChips
              options={LEASING_DOWN_PAYMENTS}
              value={draft.downPayment}
              onChange={(downPayment) => set({ downPayment })}
              formatLabel={(m) => (m === 0 ? '0 €' : formatCurrency(m))}
            />
          </div>
        </div>
      )}

      {draft.paymentView === 'finance' && (
        <div className="vd-calc__fields">
          <div className="vd-calc__field">
            <span className="vd-calc__field-label">Anzahlung</span>
            <OptionChips
              options={FINANCE_DOWN_PAYMENTS}
              value={draft.financeDown}
              onChange={(financeDown) => set({ financeDown })}
              formatLabel={(m) => (m === 0 ? '0 €' : formatCurrency(m))}
            />
          </div>
          <div className="vd-calc__field">
            <span className="vd-calc__field-label">Laufzeit</span>
            <OptionChips
              options={FINANCE_TERMS}
              value={draft.termMonths}
              onChange={(termMonths) => set({ termMonths })}
              formatLabel={(m) => `${m} Monate`}
            />
          </div>
          <div className="vd-calc__field">
            <span className="vd-calc__field-label">Schlussrate</span>
            <OptionChips
              options={FINANCE_BALLOONS}
              value={draft.financeBalloon}
              onChange={(financeBalloon) => set({ financeBalloon })}
              formatLabel={(m) => (m === 0 ? 'Keine' : formatCurrency(m))}
            />
          </div>
        </div>
      )}

      {draft.paymentView === 'cash' && (
        <dl className="vd-calc__cash-breakdown">
          <div className="vd-calc__cash-row">
            <dt>Listenpreis</dt>
            <dd>{formatCurrency(savings.listPrice)}</dd>
          </div>
          <div className="vd-calc__cash-row vd-calc__cash-row--highlight">
            <dt>Barpreis</dt>
            <dd>{formatCurrency(savings.yourPrice)}</dd>
          </div>
        </dl>
      )}
    </>
  );
}

function buildDraftFromProps(props) {
  return {
    paymentView: props.paymentView,
    termMonths: props.termMonths,
    mileagePerYear: props.mileagePerYear,
    downPayment: props.downPayment,
    financeDown: props.financeDown,
    financeBalloon: props.financeBalloon,
  };
}

export default function VehiclePriceCalculator({
  paymentView,
  termMonths,
  mileagePerYear,
  downPayment,
  financeDown,
  financeBalloon,
  pricing,
  discountPercent,
  basePricing,
  activeDealer,
  vehicle,
  open = false,
  onOpenChange,
  onApply,
  embedded = false,
}) {
  const [draft, setDraft] = useState(() => buildDraftFromProps({
    paymentView, termMonths, mileagePerYear, downPayment, financeDown, financeBalloon,
  }));

  useEffect(() => {
    if (open) {
      setDraft(buildDraftFromProps({
        paymentView, termMonths, mileagePerYear, downPayment, financeDown, financeBalloon,
      }));
    }
  }, [open, paymentView, termMonths, mileagePerYear, downPayment, financeDown, financeBalloon]);

  const previewPricing = useMemo(
    () => computeDetailPricing({
      payment: draft.paymentView,
      termMonths: draft.termMonths,
      mileagePerYear: draft.mileagePerYear,
      downPayment: draft.downPayment,
      financeDown: draft.financeDown,
      financeBalloon: draft.financeBalloon,
      basePricing,
      activeDealer,
      vehicle,
    }),
    [draft, basePricing, activeDealer, vehicle],
  );

  const teaserLine = buildPaymentTeaserLine(pricing);

  function handleOpen() {
    onOpenChange?.(true);
  }

  function handleApply() {
    onApply?.(draft);
    onOpenChange?.(false);
  }

  function handleClose() {
    onOpenChange?.(false);
  }

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    const mq = window.matchMedia('(max-width: 1023px)');
    const lock = () => {
      if (mq.matches) document.body.style.overflow = 'hidden';
    };
    lock();
    mq.addEventListener('change', lock);
    return () => {
      document.body.style.overflow = prev;
      mq.removeEventListener('change', lock);
    };
  }, [open]);

  if (embedded && !open) return null;

  return (
    <section
      className={`vd-calc${embedded ? ' vd-calc--embedded' : ' vd-tool-row'}${open ? ' vd-calc--open' : ''}`}
      id="vd-price-calc"
      aria-label="Preis und Zahlungsart"
    >
      {!embedded && (
        <div className="vd-calc__teaser">
          <div className="vd-calc__teaser-text">
            <p className="vd-calc__teaser-title">Preis & Zahlungsart</p>
            <p className="vd-calc__teaser-sub">{teaserLine}</p>
          </div>
          {!open && (
            <button
              type="button"
              className="vd-calc__teaser-btn"
              onClick={handleOpen}
              aria-expanded={false}
              aria-controls="vd-calc-panel"
            >
              Rate anpassen
            </button>
          )}
        </div>
      )}

      {open && (
        <div id="vd-calc-panel" className="vd-calc__panel vd-calc__panel--inline">
          <CalcPanelBody
            draft={draft}
            onDraftChange={setDraft}
            previewPricing={previewPricing}
            discountPercent={discountPercent}
          />
          <div className="vd-calc__panel-foot">
            <button type="button" className="vd-btn vd-btn--primary vd-btn--block" onClick={handleApply}>
              Übernehmen
            </button>
          </div>
        </div>
      )}

      {open && (
        <div
          className="vd-calc__sheet-backdrop"
          role="presentation"
          onClick={handleClose}
        >
          <div
            className="vd-calc__sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="vd-calc-sheet-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="vd-calc__sheet-head">
              <h2 id="vd-calc-sheet-title" className="vd-calc__sheet-title">Preis & Zahlungsart</h2>
              <button
                type="button"
                className="vd-calc__sheet-close"
                onClick={handleClose}
                aria-label="Schließen"
              >
                ×
              </button>
            </div>
            <div className="vd-calc__sheet-body">
              <CalcPanelBody
                draft={draft}
                onDraftChange={setDraft}
                previewPricing={previewPricing}
                discountPercent={discountPercent}
              />
            </div>
            <div className="vd-calc__sheet-foot">
              <p className="vd-calc__sheet-rate">{previewPricing.priceLabel}</p>
              <p className="vd-calc__sheet-sub">{previewPricing.subtitle}</p>
              <button type="button" className="vd-btn vd-btn--primary vd-btn--block" onClick={handleApply}>
                Übernehmen
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
