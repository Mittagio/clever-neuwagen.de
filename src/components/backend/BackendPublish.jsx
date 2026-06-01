import { Link } from 'react-router-dom';
import { formatPublishedAt, getSyncStatusLabel } from '../../data/dealerConditionsSchema.js';
import ComplianceShieldBanner from '../compliance/ComplianceShieldBanner.jsx';
import { listComplianceVehicles } from '../../logic/complianceShield.js';
import './BackendSections.css';

export default function BackendPublish({
  conditions,
  publishedConditions,
  hasDraftChanges,
  onPublish,
  onDiscard,
}) {
  const syncStatus = getSyncStatusLabel(conditions, publishedConditions ?? conditions);
  const blockedCompliance = listComplianceVehicles().filter((v) => !v.publishable);

  return (
    <div className="backend-sections">
      <section className="backend-card backend-publish-card">
        <h2 className="backend-card-title">Veröffentlichung / Sync</h2>
        <p className="backend-section-intro">
          Entwürfe sind nur im Backend sichtbar. Nach Veröffentlichung aktualisieren sich Händlerseite,
          Konfigurator, Landingpage und Verkäuferflow automatisch.
        </p>

        {blockedCompliance.length > 0 ? (
          <div className="backend-compliance-gate">
            <ComplianceShieldBanner validation={blockedCompliance[0]} />
            <p className="backend-section-intro">
              {blockedCompliance.length} Motorisierung(en) blockiert – Inserate & Publishing gesperrt.
              {' '}
              <Link to="/admin/compliance">Compliance Shield →</Link>
            </p>
          </div>
        ) : (
          <p className="backend-section-intro" style={{ color: '#059669', fontWeight: 600 }}>
            🟢 Compliance Shield: alle Sportage-Motorisierungen veröffentlichbar
          </p>
        )}

        <dl className="backend-meta-list">
          <div>
            <dt>Status</dt>
            <dd>{syncStatus.emoji} {syncStatus.label}</dd>
          </div>
          <div>
            <dt>Letzte Veröffentlichung</dt>
            <dd>{formatPublishedAt(publishedConditions?.lastPublishedAt ?? conditions.lastPublishedAt)}</dd>
          </div>
          <div>
            <dt>Händlerseite</dt>
            <dd>{(publishedConditions ?? conditions).dealerPageOnline ? '🟢 Online' : '⚪ Offline'}</dd>
          </div>
        </dl>

        <div className="backend-sync-actions">
          <button
            type="button"
            className="btn btn-primary backend-publish-btn"
            onClick={onPublish}
            disabled={!hasDraftChanges}
          >
            Änderungen veröffentlichen
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onDiscard}
            disabled={!hasDraftChanges}
          >
            Entwurf verwerfen
          </button>
        </div>
      </section>

      <section className="backend-card">
        <h3 className="backend-card-subtitle">Synchronisierte Bereiche</h3>
        <ul className="backend-sync-list">
          <li>Händlerseite /haendler/autohaus-trinkle</li>
          <li>Sportage-Konfigurator</li>
          <li>Landingpage-Suchergebnisse</li>
          <li>Angebotskarten & Verkäuferflow</li>
          <li>Inseratgenerator</li>
        </ul>
      </section>
    </div>
  );
}
