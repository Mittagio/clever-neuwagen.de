import { useMemo } from 'react';
import { PAYMENT_TYPE_LABELS } from '../../services/dealerAiParser.js';
import { resolveConfigureModel } from '../../services/configuration/configureModelBridge.js';
import { vehicleConfigurationTitle } from '../../services/configuration/vehicleConfigurationModel.js';
import VehicleConfigurationSummary from './VehicleConfigurationSummary.jsx';
import './DealerAiOfferPreview.css';
import './VehicleConfigurationSummary.css';

function formatCurrency(amount) {
  if (amount == null) return '–';
  return `${Number(amount).toLocaleString('de-DE')} €`;
}

function formatExtras(payment = {}) {
  const items = [];
  if (payment.towBar) items.push('AHK');
  if (payment.winterWheels) items.push('Winterräder');
  if (payment.maintenance) items.push('Wartung');
  if (payment.insurance) items.push('Versicherung');
  return items.length ? items.join(' · ') : 'Keine';
}

/** Schritt 3 – Angebotsvorschau: Konfiguration + Konditionen + Berechnung */
export default function DealerAiOfferPreview({
  offerDraft,
  onBack,
  onSave,
  onPreparePdfLink,
  isSaving = false,
}) {
  if (!offerDraft) return null;

  const {
    customer,
    vehicle,
    payment,
    timing,
    vehicleConfiguration,
    offerCalculation,
    offerPreview,
  } = offerDraft;

  const preview = offerPreview ?? {};
  const calculation = offerCalculation ?? {};
  const vehicleTitle = preview.vehicleTitle
    ?? vehicleConfigurationTitle(vehicleConfiguration)
    ?? [vehicle.model, vehicle.trimLabel, vehicle.battery].filter(Boolean).join(' ');

  const uvpTotal = preview.uvpConfigurationPrice
    ?? vehicleConfiguration?.uvpConfigurationPrice
    ?? vehicle.uvpConfigurationPrice
    ?? null;

  const discountPercent = preview.discountPercent ?? calculation.discountPercent ?? null;
  const discountAmount = preview.discountAmount ?? calculation.discountAmount ?? null;
  const housePrice = preview.housePrice ?? calculation.housePrice ?? null;
  const calculatedRate = payment.calculatedRate ?? preview.monthlyRate ?? calculation.monthlyRate ?? null;

  const paymentLabel = PAYMENT_TYPE_LABELS[payment.type === 'financing' ? 'financing' : payment.type]
    ?? payment.type;

  const budgetStatus = preview.budget;

  const packageLabels = useMemo(() => {
    const mfg = resolveConfigureModel(vehicle.modelKey);
    const ids = vehicle.selectedPackages ?? [];
    return ids.map((id) => mfg?.data?.packages?.find((p) => p.id === id)?.name ?? id);
  }, [vehicle.modelKey, vehicle.selectedPackages]);

  return (
    <div className="dai-offer-preview dai-offer-preview--calm">
      <header className="dai-offer-preview__header">
        {onBack && (
          <button type="button" className="dai-offer-preview__back" onClick={onBack}>
            ← Zu Konditionen
          </button>
        )}
        <h2 className="dai-offer-preview__title">Angebotsvorschau</h2>
      </header>

      <section className="dai-offer-preview__block dai-offer-preview__block--pricing">
        <h3>Angebot</h3>
        <p className="dai-offer-preview__line">{vehicleTitle || '–'}</p>

        {vehicleConfiguration && (
          <VehicleConfigurationSummary
            configuration={vehicleConfiguration}
            compact
            showSelections={false}
          />
        )}

        <dl className="dai-offer-preview__rows dai-offer-preview__rows--pricing">
          {!vehicleConfiguration && uvpTotal != null && (
            <div><dt>UVP Konfiguration</dt><dd>{formatCurrency(uvpTotal)}</dd></div>
          )}
          {discountPercent != null && (
            <div><dt>Rabatt</dt><dd>{discountPercent} %</dd></div>
          )}
          {discountAmount != null && (
            <div><dt>Rabattbetrag</dt><dd>− {formatCurrency(discountAmount)}</dd></div>
          )}
          {housePrice != null && (
            <div><dt>Händlerpreis</dt><dd>{formatCurrency(housePrice)}</dd></div>
          )}
        </dl>

        <dl className="dai-offer-preview__rows">
          <div><dt>Angebotsart</dt><dd>{paymentLabel}</dd></div>
          {payment.type !== 'cash' && (
            <>
              <div><dt>Laufzeit</dt><dd>{payment.termMonths ? `${payment.termMonths} Monate` : '–'}</dd></div>
              {payment.type === 'leasing' && (
                <div><dt>Kilometer</dt><dd>{payment.mileagePerYear?.toLocaleString('de-DE') ?? '–'} km/Jahr</dd></div>
              )}
              <div><dt>Anzahlung</dt><dd>{formatCurrency(payment.downPayment ?? 0)}</dd></div>
            </>
          )}
          <div><dt>Überführung</dt><dd>{formatCurrency(payment.transferCost)}</dd></div>
        </dl>
      </section>

      {calculatedRate != null && (
        <div className="dai-offer-preview__hero-rate">
          <span className="dai-offer-preview__hero-label">
            {payment.type === 'cash' ? 'Kaufpreis' : 'Rate'}
          </span>
          <span className="dai-offer-preview__hero-value">
            {payment.type === 'cash'
              ? formatCurrency(calculatedRate)
              : `${calculatedRate.toLocaleString('de-DE')} € / Monat`}
          </span>
          {payment.budget != null && calculatedRate != null && budgetStatus?.status !== 'open' && (
            <span className={`dai-offer-preview__hero-budget${budgetStatus?.status === 'ok' ? ' is-ok' : ' is-over'}`}>
              {budgetStatus?.status === 'ok'
                ? '✓ Budget erfüllt'
                : `⚠ Budget überschritten um ${(calculatedRate - payment.budget).toLocaleString('de-DE')} €`}
            </span>
          )}
        </div>
      )}

      <section className="dai-offer-preview__block">
        <h3>Kunde</h3>
        <p className="dai-offer-preview__line">{customer.name ?? 'Noch offen'}</p>
        {customer.phone && <p className="dai-offer-preview__muted">{customer.phone}</p>}
        {customer.email && <p className="dai-offer-preview__muted">{customer.email}</p>}
      </section>

      <section className="dai-offer-preview__block">
        <h3>Fahrzeug</h3>
        <p className="dai-offer-preview__line">{vehicleTitle || '–'}</p>
        <dl className="dai-offer-preview__rows">
          <div><dt>Farbe</dt><dd>{vehicle.color ?? '–'}</dd></div>
        </dl>
      </section>

      <section className="dai-offer-preview__block">
        <h3>Pakete & Extras</h3>
        {packageLabels.length > 0 ? (
          <ul className="dai-offer-preview__list">
            {packageLabels.map((label) => <li key={label}>{label}</li>)}
          </ul>
        ) : (
          <p className="dai-offer-preview__muted">Keine Pakete gewählt</p>
        )}
        <p className="dai-offer-preview__muted">Extras: {formatExtras(payment)}</p>
      </section>

      <section className="dai-offer-preview__block">
        <h3>Timing</h3>
        <dl className="dai-offer-preview__rows">
          <div>
            <dt>Wunschlieferdatum</dt>
            <dd>{timing.desiredDeliveryDate ?? 'offen'}</dd>
          </div>
          {timing.leasingEnd && (
            <div><dt>Leasingende</dt><dd>{timing.leasingEnd}</dd></div>
          )}
          {timing.vehicleChangePlanned && (
            <div><dt>Fahrzeugwechsel</dt><dd>Ja</dd></div>
          )}
        </dl>
      </section>

      <div className="dai-offer-preview__actions">
        <button
          type="button"
          className="dai-offer-preview__primary"
          onClick={onSave}
          disabled={isSaving}
        >
          {isSaving ? 'Wird gespeichert …' : 'Angebot speichern'}
        </button>
        <button
          type="button"
          className="dai-offer-preview__secondary"
          onClick={onPreparePdfLink}
          disabled={isSaving}
        >
          PDF / Kundenlink vorbereiten
        </button>
      </div>
    </div>
  );
}
