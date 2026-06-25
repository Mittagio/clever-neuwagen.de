import { useMemo } from 'react';
import {
  buildConfigureVehicleSummary,
  hasRecognizedModelKey,
  resolveConfigureHeroImage,
} from '../../services/dealerAiVehicleConfigureFlow.js';
import {
  FlowPrimaryButton,
  FlowSecondaryButton,
  FlowStickyFooter,
  OfferFlowLayout,
  VehicleOfferHero,
} from './flow/OfferFlowComponents.jsx';
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

  const vehicleLine = [draft.model, draft.trimLabel].filter(Boolean).join(' ');
  const motorLine = draft.batteryLabel || draft.motorLabel || null;
  const uvpTotal = summary.uvpConfigurationPrice;

  return (
    <OfferFlowLayout
      backLabel={onBack ? `← ${contextBanner ? 'Zur Kundenakte' : 'Zurück'}` : null}
      onBack={onBack}
      title="Fahrzeug konfigurieren"
      subtitle="Stellen Sie das Fahrzeug zusammen – Preis ist die UVP."
    >
      <VehicleOfferHero
        modelLine={vehicleLine || draft.model}
        motorLine={motorLine}
        colorLabel={draft.colorLabel}
        imageSrc={heroImage}
        imageAlt={vehicleLine || draft.model}
        priceMain={formatCurrency(uvpTotal)}
        priceLabel="UVP Konfiguration"
      />

      {showCustomer && (
        <details className="cn-customer-fold">
          <summary>
            <span className="cn-customer-fold__label">Kunde</span>
            <span className="cn-customer-fold__name">
              {[customer.firstName ?? customerContact?.firstName, customer.lastName ?? customerContact?.lastName].filter(Boolean).join(' ') || 'Kontakt'}
            </span>
          </summary>
          <div className="cn-customer-fold__body">
            {(customer.phone || customerContact?.phone) && (
              <p>{customer.phone ?? customerContact?.phone}</p>
            )}
            {(customer.email || customerContact?.email) && (
              <p>{customer.email ?? customerContact?.email}</p>
            )}
          </div>
        </details>
      )}

      <SellerVehicleConfigurator draft={draft} onChange={onDraftChange} />

      <FlowStickyFooter hint="Clever-Vorschläge im nächsten Schritt">
        {showVehicleSearch && (
          <FlowSecondaryButton onClick={onSwitchToSearch} disabled={isExecuting}>
            Fahrzeugsuche
          </FlowSecondaryButton>
        )}
        <FlowPrimaryButton onClick={onContinueToConditions} disabled={isExecuting}>
          Weiter zu Vorschlägen
        </FlowPrimaryButton>
      </FlowStickyFooter>
    </OfferFlowLayout>
  );
}
