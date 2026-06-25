import { computeTradeDifference } from '../../services/customerAkteTradeIn.js';
import './CustomerAkteTradeInPanel.css';

function formatEuro(value) {
  if (value == null || Number.isNaN(Number(value))) return '–';
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(Number(value));
}

/**
 * Inzahlungnahme – strukturierte Werte aus Gespräch & Unterlagen.
 */
export default function CustomerAkteTradeInPanel({
  tradeIn,
  onChange,
}) {
  const difference = tradeIn?.difference ?? computeTradeDifference(tradeIn?.datValue, tradeIn?.payoffAmount);

  function patch(field, rawValue) {
    const value = ['datValue', 'payoffAmount'].includes(field)
      ? (rawValue === '' ? null : Number(rawValue))
      : rawValue;
    onChange?.({ [field]: value });
  }

  return (
    <section className="cust-trade-in" aria-labelledby="cust-trade-in-title">
      <div className="cust-trade-in__head">
        <h3 id="cust-trade-in-title" className="cust-trade-in__title">Inzahlungnahme</h3>
        <p className="cust-trade-in__hint">Werte für Angebot, Verrechnung & Finanzierung.</p>
      </div>

      <div className="cust-trade-in__grid">
        <label className="cust-trade-in__label">
          Fahrzeug
          <input
            type="text"
            className="cust-trade-in__input"
            value={tradeIn?.vehicle ?? ''}
            onChange={(e) => patch('vehicle', e.target.value)}
            placeholder="z. B. Kia EV6 GT-Line"
          />
        </label>
        <label className="cust-trade-in__label">
          DAT-Wert (€)
          <input
            type="number"
            inputMode="decimal"
            className="cust-trade-in__input"
            value={tradeIn?.datValue ?? ''}
            onChange={(e) => patch('datValue', e.target.value)}
            placeholder="34356"
          />
        </label>
        <label className="cust-trade-in__label">
          Ablösebetrag (€)
          <input
            type="number"
            inputMode="decimal"
            className="cust-trade-in__input"
            value={tradeIn?.payoffAmount ?? ''}
            onChange={(e) => patch('payoffAmount', e.target.value)}
            placeholder="48933"
          />
        </label>
        <label className="cust-trade-in__label">
          Bank
          <input
            type="text"
            className="cust-trade-in__input"
            value={tradeIn?.bank ?? ''}
            onChange={(e) => patch('bank', e.target.value)}
            placeholder="Bank11"
          />
        </label>
        <label className="cust-trade-in__label">
          Vertragsnummer
          <input
            type="text"
            className="cust-trade-in__input"
            value={tradeIn?.contractNumber ?? ''}
            onChange={(e) => patch('contractNumber', e.target.value)}
          />
        </label>
        <label className="cust-trade-in__label">
          Gültig bis
          <input
            type="date"
            className="cust-trade-in__input"
            value={tradeIn?.validUntil?.slice(0, 10) ?? ''}
            onChange={(e) => patch('validUntil', e.target.value)}
          />
        </label>
      </div>

      <div className="cust-trade-in__summary">
        <span className="cust-trade-in__summary-label">Differenz / Überzahlung</span>
        <strong className={`cust-trade-in__summary-value${difference != null && difference < 0 ? ' cust-trade-in__summary-value--neg' : ''}`}>
          {formatEuro(difference)}
        </strong>
      </div>

      <label className="cust-trade-in__label">
        Hinweise
        <textarea
          className="cust-trade-in__textarea"
          rows={2}
          value={tradeIn?.notes ?? ''}
          onChange={(e) => patch('notes', e.target.value)}
          placeholder="z. B. Verrechnung mit neuem Angebot prüfen"
        />
      </label>
    </section>
  );
}
