import {
  buildConfigureVehicleSummary,
  hasRecognizedModelKey,
} from '../../services/dealerAiVehicleConfigureFlow.js';
import SellerVehicleConfigurator from './SellerVehicleConfigurator.jsx';
import './DealerAiVehicleConfigure.css';

function formatCurrency(amount) {
  if (amount == null) return '–';
  return `${Number(amount).toLocaleString('de-DE')} €`;
}

/** Schritt 2 – Fahrzeug konfigurieren (ohne Konditionen) */
export default function DealerAiVehicleConfigure({
  draft,
  conditions,
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

  const summary = buildConfigureVehicleSummary(draft, conditions);
  const customer = draft.customer ?? {};

  const showCustomer = customerContact?.hasContact
    || customer.firstName
    || customer.lastName
    || customer.phone
    || customer.email
    || customer.mailNote;

  const vehicleLine = summary.vehicleTitle
    || [draft.model, draft.trimLabel, draft.batteryLabel].filter(Boolean).join(' ');

  const colorSuffix = summary.colorLabel ? ` · ${summary.colorLabel}` : '';

  return (
    <div className="dai-configure dai-configure--seller dai-configure--studio">
      <header className="dai-configure-header">
        {onBack && (
          <button type="button" className="dai-configure-back" onClick={onBack}>
            ← {contextBanner ? 'Zur Kundenakte' : 'Zurück'}
          </button>
        )}
        <h2 className="dai-configure-header__title">Fahrzeug konfigurieren</h2>
      </header>

      <aside className="dai-config-sticky-price" aria-live="polite">
        <div className="dai-config-sticky-price__inner">
          <div className="dai-config-sticky-price__info">
            <p className="dai-config-sticky-price__vehicle">
              {vehicleLine}{colorSuffix}
            </p>
          </div>
          <div className="dai-config-sticky-price__amount">
            <span className="dai-config-sticky-price__value">
              {formatCurrency(summary.listPrice)}
            </span>
          </div>
        </div>
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

      <section className="dai-config-studio">
        <SellerVehicleConfigurator draft={draft} onChange={onDraftChange} />
      </section>

      <div className="dai-config-actions">
        {showVehicleSearch && (
          <button
            type="button"
            className="dai-config-actions__secondary"
            onClick={onSwitchToSearch}
            disabled={isExecuting}
          >
            Fahrzeugsuche öffnen
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
    </div>
  );
}
