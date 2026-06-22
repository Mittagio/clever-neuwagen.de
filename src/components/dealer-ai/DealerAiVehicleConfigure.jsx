import { useMemo } from 'react';
import {
  buildConfigureVehicleSummary,
  hasRecognizedModelKey,
  resolveConfigureHeroImage,
} from '../../services/dealerAiVehicleConfigureFlow.js';
import SellerVehicleConfigurator from './SellerVehicleConfigurator.jsx';
import './DealerAiVehicleConfigure.css';

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
  const heroImage = useMemo(() => resolveConfigureHeroImage(draft), [draft]);
  const customer = draft.customer ?? {};

  const showCustomer = customerContact?.hasContact
    || customer.firstName
    || customer.lastName
    || customer.phone
    || customer.email
    || customer.mailNote;

  const vehicleLine = [draft.model, draft.trimLabel, draft.batteryLabel || draft.motorLabel]
    .filter(Boolean)
    .join(' ');
  const trimLine = [draft.trimLabel, draft.batteryLabel || draft.motorLabel]
    .filter(Boolean)
    .join(' ');
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
        <div className="dai-config-sticky-head__pricebox">
          <p className="dai-config-sticky-head__title">{vehicleLine || draft.model}</p>
          {draft.colorLabel && (
            <p className="dai-config-sticky-head__color">{draft.colorLabel}</p>
          )}
          <p className="dai-config-sticky-head__price">{formatCurrency(uvpTotal)}</p>
        </div>

        {heroImage && (
          <div className="dai-config-hero-image">
            <img
              src={heroImage}
              alt={vehicleLine || draft.model}
              className="dai-config-hero-image__img"
            />
          </div>
        )}

        <div className="dai-config-hero-caption">
          <p className="dai-config-hero-caption__trim">{trimLine || draft.model}</p>
          {draft.colorLabel && (
            <p className="dai-config-hero-caption__color">{draft.colorLabel}</p>
          )}
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

      <section className="dai-config-studio dai-config-studio--mobile">
        <SellerVehicleConfigurator draft={draft} onChange={onDraftChange} />
      </section>

      <footer className="dai-config-sticky-foot dai-config-sticky-foot--cta-only">
        <p className="dai-config-sticky-foot__hint">Konditionen & Angebot im nächsten Schritt</p>
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
