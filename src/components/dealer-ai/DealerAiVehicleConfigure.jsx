import { useMemo } from 'react';
import {
  buildConfigureVehicleSummary,
  hasRecognizedModelKey,
} from '../../services/dealerAiVehicleConfigureFlow.js';
import { buildVehicleConfiguration } from '../../services/configuration/vehicleConfigurationModel.js';
import SellerVehicleConfigurator from './SellerVehicleConfigurator.jsx';
import VehicleConfigurationSummary from './VehicleConfigurationSummary.jsx';
import './DealerAiVehicleConfigure.css';
import './VehicleConfigurationSummary.css';

function formatCurrency(amount) {
  if (amount == null) return '–';
  return `${Number(amount).toLocaleString('de-DE')} €`;
}

/** Schritt 1 – Fahrzeug konfigurieren (nur UVP, keine Konditionen) */
export default function DealerAiVehicleConfigure({
  draft,
  customerContact,
  contextBanner,
  onDraftChange,
  onContinueToConditions,
  onBack,
  onSwitchToSearch,
  isExecuting = false,
}) {
  if (!draft) return null;

  const showVehicleSearch = !hasRecognizedModelKey({
    ok: true,
    fields: { modelId: draft.modelKey, model: draft.model },
  }) && Boolean(onSwitchToSearch);

  const summary = useMemo(() => buildConfigureVehicleSummary(draft), [draft]);
  const vehicleConfiguration = useMemo(() => buildVehicleConfiguration(draft), [draft]);
  const customer = draft.customer ?? {};

  const showCustomer = customerContact?.hasContact
    || customer.firstName
    || customer.lastName
    || customer.phone
    || customer.email
    || customer.mailNote;

  const headline = summary.vehicleTitle || draft.model;

  const detailLine = [draft.trimLabel, draft.batteryLabel || draft.motorLabel, draft.colorLabel]
    .filter(Boolean)
    .join(' · ');

  const uvpTotal = summary.uvpConfigurationPrice;

  return (
    <div className="dai-configure dai-configure--seller dai-configure--mobile">
      <header className="dai-configure-header dai-configure-header--compact">
        {onBack && (
          <button type="button" className="dai-configure-back" onClick={onBack}>
            ← {contextBanner ? 'Zur Kundenakte' : 'Zurück'}
          </button>
        )}
      </header>

      <aside className="dai-config-sticky-head" aria-live="polite">
        <div className="dai-config-sticky-head__main">
          <p className="dai-config-sticky-head__title">{headline}</p>
          <div className="dai-config-sticky-head__amount">
            <span className="dai-config-sticky-head__price-label">Konfigurationspreis (UVP)</span>
            <p className="dai-config-sticky-head__price">{formatCurrency(uvpTotal)}</p>
          </div>
        </div>
        {detailLine && (
          <p className="dai-config-sticky-head__meta">{detailLine}</p>
        )}
      </aside>

      {showCustomer && (
        <details className="dai-config-customer-fold">
          <summary>Kundendaten</summary>
          <div className="dai-config-customer-fold__body">
            {(customer.firstName || customer.lastName || customerContact?.firstName) && (
              <p>{[customer.firstName ?? customerContact?.firstName, customer.lastName ?? customerContact?.lastName].filter(Boolean).join(' ')}</p>
            )}
            {(customer.phone || customerContact?.phone) && (
              <p>{customer.phone ?? customerContact?.phone}</p>
            )}
            {(customer.email || customerContact?.email) && (
              <p>{customer.email ?? customerContact?.email}</p>
            )}
          </div>
        </details>
      )}

      <section className="dai-config-studio dai-config-studio--mobile">
        <SellerVehicleConfigurator draft={draft} onChange={onDraftChange} />
      </section>

      <VehicleConfigurationSummary
        configuration={vehicleConfiguration}
        summary={summary}
      />

      <footer className="dai-config-sticky-foot">
        <p className="dai-config-sticky-foot__price">
          <span className="vcfg-config-total-label">Konfigurationspreis (UVP)</span>
          <span className="vcfg-config-total-value">{formatCurrency(uvpTotal)}</span>
        </p>
        <p className="vcfg-config-total-hint">Leasing & Rabatte folgen im nächsten Schritt</p>
        <div className="dai-config-sticky-foot__actions">
          {showVehicleSearch && (
            <button
              type="button"
              className="dai-config-actions__secondary"
              onClick={onSwitchToSearch}
              disabled={isExecuting}
            >
              Fahrzeugsuche
            </button>
          )}
          <button
            type="button"
            className="dai-config-actions__primary"
            onClick={onContinueToConditions}
            disabled={isExecuting}
          >
            Weiter zu Konditionen
          </button>
        </div>
      </footer>
    </div>
  );
}
