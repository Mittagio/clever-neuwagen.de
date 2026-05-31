import { useMemo } from 'react';
import {
  formatPublishedAt,
  getChangesSincePublish,
  getLeasingFactorSnapshot,
  getSyncStatusLabel,
} from '../../data/dealerConditionsSchema.js';
import { getLowestSportageLeasingRate } from '../../logic/priceCalculator.js';
import { formatPrice } from '../../data/kiaSportage.js';
import './BackendSyncStatus.css';

const DEMO_TERM = 48;
const DEMO_KM = 15000;

const LANDING_PREVIEW_CONFIG = {
  model: 'Sportage',
  customerGroup: 'standard',
  paymentType: 'leasing',
  termMonths: DEMO_TERM,
  mileagePerYear: DEMO_KM,
  downPayment: 0,
};

export default function BackendSyncStatus({
  draftConditions,
  publishedConditions,
  hasDraftChanges,
  onPublish,
  onDiscard,
}) {
  const syncStatus = getSyncStatusLabel(draftConditions, publishedConditions);
  const changes = getChangesSincePublish(draftConditions, publishedConditions);

  const draftLf = getLeasingFactorSnapshot(draftConditions, 'sportage', DEMO_TERM, DEMO_KM);
  const publishedLf = getLeasingFactorSnapshot(publishedConditions, 'sportage', DEMO_TERM, DEMO_KM);

  const { publishedLandingRate, draftLandingRate } = useMemo(() => ({
    publishedLandingRate: getLowestSportageLeasingRate(publishedConditions, {
      termMonths: DEMO_TERM,
      mileagePerYear: DEMO_KM,
    }),
    draftLandingRate: getLowestSportageLeasingRate(draftConditions, {
      termMonths: DEMO_TERM,
      mileagePerYear: DEMO_KM,
    }),
  }), [draftConditions, publishedConditions]);

  return (
    <section className={`backend-sync card backend-sync--${syncStatus.id}`}>
      <header className="backend-sync-head">
        <div>
          <p className="backend-sync-eyebrow">Veröffentlichungsstatus</p>
          <h2 className="backend-sync-title">
            {syncStatus.emoji} {syncStatus.label}
          </h2>
        </div>
        {hasDraftChanges && (
          <span className="backend-sync-badge">Entwurf nicht veröffentlicht</span>
        )}
      </header>

      <dl className="backend-sync-meta">
        <div>
          <dt>Letzte Veröffentlichung</dt>
          <dd>{formatPublishedAt(publishedConditions.lastPublishedAt)}</dd>
        </div>
        <div>
          <dt>Änderungen seit Veröffentlichung</dt>
          <dd>{changes.length}</dd>
        </div>
      </dl>

      <div className="backend-sync-demo">
        <p className="backend-sync-demo-title">Demo: LF {DEMO_TERM} Mt. / {DEMO_KM.toLocaleString('de-DE')} km</p>
        <div className="backend-sync-demo-grid">
          <div className="backend-sync-demo-col">
            <span className="backend-sync-demo-label">Veröffentlicht (Landingpage)</span>
            <strong className="backend-sync-demo-value">{publishedLf ?? '–'}</strong>
            <span className="backend-sync-demo-rate">
              ab {publishedLandingRate != null ? `${formatPrice(publishedLandingRate)}/Monat` : '–'}
            </span>
          </div>
          <div className="backend-sync-demo-col backend-sync-demo-col--draft">
            <span className="backend-sync-demo-label">Entwurf (Backend)</span>
            <strong className="backend-sync-demo-value">{draftLf ?? '–'}</strong>
            <span className="backend-sync-demo-rate">
              ab {draftLandingRate != null ? `${formatPrice(draftLandingRate)}/Monat` : '–'}
            </span>
          </div>
        </div>
        {hasDraftChanges && publishedLandingRate != null && draftLandingRate != null
          && draftLandingRate !== publishedLandingRate && (
          <p className="backend-sync-demo-hint">
            Nach Veröffentlichung zeigt die Landingpage{' '}
            <strong>{formatPrice(draftLandingRate)}/Monat</strong>
            {draftLandingRate < publishedLandingRate ? ' (niedriger)' : ''}.
          </p>
        )}
      </div>

      {changes.length > 0 && (
        <ul className="backend-sync-changes">
          {changes.map((c) => (
            <li key={c.id}>
              <span>{c.label}</span>
              <span>{c.from} → {c.to}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="backend-sync-actions">
        <button
          type="button"
          className="btn btn-primary"
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
  );
}
