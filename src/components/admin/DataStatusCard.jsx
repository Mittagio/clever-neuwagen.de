import HealthIndicator from './HealthIndicator.jsx';
import './DataStatusCard.css';

export default function DataStatusCard({ status }) {
  if (!status) return null;

  return (
    <article className="data-status-card card">
      <div className="data-status-head">
        <h3 className="data-status-model">{status.modelName}</h3>
        <HealthIndicator health={status.health} size="lg" />
      </div>

      <dl className="data-status-grid">
        <div className="data-status-item">
          <dt>Stand</dt>
          <dd>{status.dataStand}</dd>
        </div>
        <div className="data-status-item">
          <dt>Letzte Aktualisierung</dt>
          <dd>{status.lastUpdated}</dd>
        </div>
        <div className="data-status-item">
          <dt>Gepflegt von</dt>
          <dd>{status.updatedBy}</dd>
        </div>
        <div className="data-status-item">
          <dt>Änderungen</dt>
          <dd>{status.changeCount}</dd>
        </div>
      </dl>

      <p className="data-status-footer">
        Status: <strong>{status.healthLabel}</strong>
      </p>
    </article>
  );
}
