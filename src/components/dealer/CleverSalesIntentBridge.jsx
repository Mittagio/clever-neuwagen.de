import { CLEVER_SALES_MODES } from '../../services/dealer/cleverSalesIntent.js';
import './clever-consultation.css';

/**
 * Brücke zwischen Clever-Antwort und Beratungs-/Verkaufsflow.
 */
export default function CleverSalesIntentBridge({
  salesIntent,
  onStartConsultation,
}) {
  if (!salesIntent?.shouldStartConsultation) return null;

  const isSales = salesIntent.mode === CLEVER_SALES_MODES.SALES;

  return (
    <section className="dl-sales-intent" aria-labelledby="dl-sales-intent-title">
      <header className="dl-sales-intent__head">
        <span className={`dl-sales-intent__badge dl-sales-intent__badge--${salesIntent.mode}`}>
          {salesIntent.modeLabel}
        </span>
        <h2 id="dl-sales-intent-title" className="dl-sales-intent__title">
          {isSales ? 'Kaufabsicht erkannt' : 'Beratung starten'}
        </h2>
        <p className="dl-sales-intent__hint">{salesIntent.modeHint}</p>
      </header>

      {salesIntent.followUpQuestion && (
        <p className="dl-sales-intent__followup">
          <span className="dl-sales-intent__followup-label">Nächster Schritt</span>
          {salesIntent.followUpQuestion}
        </p>
      )}

      {salesIntent.leadHints && (
        <ul className="dl-sales-intent__chips">
          {salesIntent.leadHints.paymentType && (
            <li>{salesIntent.leadHints.paymentType === 'leasing' ? 'Leasing' : salesIntent.leadHints.paymentType === 'finance' ? 'Finanzierung' : 'Kauf'}</li>
          )}
          {salesIntent.leadHints.budgetBucket && (
            <li>
              Budget bis
              {' '}
              {salesIntent.leadHints.budgetBucket}
              {' '}
              €
            </li>
          )}
          {salesIntent.leadHints.modelKey && (
            <li>{salesIntent.leadHints.modelKey.toUpperCase()}</li>
          )}
        </ul>
      )}

      <button
        type="button"
        className="dl-sales-intent__cta"
        onClick={onStartConsultation}
      >
        {isSales ? 'Angebot vorbereiten' : 'Beratung fortsetzen'}
      </button>
    </section>
  );
}
