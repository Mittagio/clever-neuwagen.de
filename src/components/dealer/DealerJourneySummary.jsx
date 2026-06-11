import { getPurchaseTypeLabel, shouldShowAllPaymentVariants } from '../../services/dealer/purchaseTypeOptions.js';
import { getSpecialConditionLabels } from '../../services/dealer/specialConditionOptions.js';
import './dealer-landing.css';

/**
 * Zusammenfassung nach Phase 4 – Brücke zum Angebot (Phase 5).
 */
export default function DealerJourneySummary({
  configSummary,
  purchaseType,
  specialConditions = [],
  onShowOffers,
}) {
  if (!configSummary || !purchaseType) return null;

  const purchaseLabel = getPurchaseTypeLabel(purchaseType);
  const allVariants = shouldShowAllPaymentVariants(purchaseType);
  const conditionLabels = getSpecialConditionLabels(specialConditions);

  return (
    <section className="dl-journey-summary" aria-labelledby="dl-journey-summary-title">
      <h2 id="dl-journey-summary-title" className="dl-journey-summary__title">
        Kia
        {' '}
        {configSummary.modelLabel}
      </h2>
      {configSummary.trimLabel && (
        <p className="dl-journey-summary__trim">
          Ausstattung
          {' '}
          {configSummary.trimLabel}
        </p>
      )}
      <dl className="dl-journey-summary__facts">
        {configSummary.powertrainLabel && (
        <div>
          <dt>Antrieb</dt>
          <dd>{configSummary.powertrainLabel}</dd>
        </div>
        )}
        {configSummary.packageLabels?.length > 0 && (
          <div>
            <dt>Extras</dt>
            <dd>{configSummary.packageLabels.join(' · ')}</dd>
          </div>
        )}
        <div>
          <dt>Kaufart</dt>
          <dd>
            {allVariants
              ? 'Alle Varianten vergleichen (Kauf, Finanzierung, Leasing)'
              : purchaseLabel}
          </dd>
        </div>
        {conditionLabels.length > 0 && (
          <div>
            <dt>Sonderkondition</dt>
            <dd>{conditionLabels.join(' · ')}</dd>
          </div>
        )}
      </dl>
      {onShowOffers && (
        <button
          type="button"
          className="btn btn-primary dl-journey-summary__cta"
          onClick={onShowOffers}
        >
          {allVariants ? 'Preise anzeigen' : 'Preis anzeigen'}
        </button>
      )}
    </section>
  );
}
