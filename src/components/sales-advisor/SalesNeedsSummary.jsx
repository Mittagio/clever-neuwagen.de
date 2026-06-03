import { buildNeedsSummary } from '../../services/sales/salesAdvisorService.js';
import './smartSales.css';

export default function SalesNeedsSummary({
  chipIds = [],
  customer = {},
  mileagePerYear = null,
  onConfirm,
  onBack,
}) {
  const summary = buildNeedsSummary(chipIds, customer, mileagePerYear);

  return (
    <section className="ss-needs" aria-labelledby="ss-needs-title">
      <h1 id="ss-needs-title">Wir haben verstanden</h1>
      <p className="ss-needs__lead">{summary.customerLabel} sucht:</p>
      <ul className="ss-needs__list">
        {summary.items.map((item) => (
          <li key={item}><span aria-hidden>✓</span> {item}</li>
        ))}
        {summary.budgetMax && (
          <li><span aria-hidden>✓</span> Budget bis {summary.budgetMax} €/Monat</li>
        )}
        {summary.mileagePerYear && (
          <li><span aria-hidden>✓</span> {summary.mileagePerYear.toLocaleString('de-DE')} km/Jahr</li>
        )}
        {summary.powertrainLabel && (
          <li><span aria-hidden>✓</span> Antrieb: {summary.powertrainLabel}</li>
        )}
      </ul>
      <p className="ss-needs__class">
        <strong>Empfohlene Fahrzeugklasse:</strong> {summary.vehicleClass}
      </p>
      <div className="ss-needs__actions">
        <button type="button" className="ss-btn ss-btn--ghost" onClick={onBack}>
          Wünsche ändern
        </button>
        <button type="button" className="ss-btn ss-btn--primary ss-btn--xl" onClick={onConfirm}>
          Fahrzeuge finden
        </button>
      </div>
    </section>
  );
}
