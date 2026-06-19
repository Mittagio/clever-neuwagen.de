import { PAYMENT_TYPE_LABELS } from '../../services/dealerAiParser.js';
import './DealerAiOfferPreview.css';

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
  return items.length ? items.join(', ') : 'Keine';
}

export default function DealerAiOfferPreview({
  offerDraft,
  onBack,
  onSave,
  onPreparePdfLink,
  isSaving = false,
}) {
  if (!offerDraft) return null;

  const { customer, vehicle, payment, timing } = offerDraft;
  const vehicleTitle = [vehicle.model, vehicle.trimLabel, vehicle.battery].filter(Boolean).join(' ');
  const paymentLabel = PAYMENT_TYPE_LABELS[payment.type === 'financing' ? 'financing' : payment.type]
    ?? payment.type;

  return (
    <div className="dai-offer-preview">
      <header className="dai-offer-preview__header">
        {onBack && (
          <button type="button" className="dai-offer-preview__back" onClick={onBack}>
            ← Zur Konfiguration
          </button>
        )}
        <h2 className="dai-offer-preview__title">Angebotsvorschau</h2>
        <p className="dai-offer-preview__subtitle">Basierend auf der aktuellen Clever Empfehlung</p>
      </header>

      <section className="dai-offer-preview__card">
        <h3>Kunde</h3>
        <p className="dai-offer-preview__value">{customer.name ?? 'Noch offen'}</p>
        {customer.phone && <p className="dai-offer-preview__meta">{customer.phone}</p>}
        {customer.email && <p className="dai-offer-preview__meta">{customer.email}</p>}
      </section>

      <section className="dai-offer-preview__card">
        <h3>Fahrzeug</h3>
        <p className="dai-offer-preview__value">{vehicleTitle || '–'}</p>
        <dl className="dai-offer-preview__dl">
          <div><dt>Modell</dt><dd>{vehicle.model ?? '–'}</dd></div>
          <div><dt>Linie</dt><dd>{vehicle.trimLabel ?? '–'}</dd></div>
          <div><dt>Batterie</dt><dd>{vehicle.battery ?? '–'}</dd></div>
          <div><dt>Farbe</dt><dd>{vehicle.color ?? '–'}</dd></div>
        </dl>
      </section>

      <section className="dai-offer-preview__card dai-offer-preview__card--highlight">
        <h3>Konditionen</h3>
        <dl className="dai-offer-preview__dl">
          <div><dt>Angebotsart</dt><dd>{paymentLabel}</dd></div>
          {payment.type !== 'cash' && (
            <>
              <div><dt>Laufzeit</dt><dd>{payment.termMonths ? `${payment.termMonths} Monate` : '–'}</dd></div>
              <div><dt>Kilometer</dt><dd>{payment.mileagePerYear?.toLocaleString('de-DE') ?? '–'} km</dd></div>
              <div><dt>Anzahlung</dt><dd>{formatCurrency(payment.downPayment ?? 0)}</dd></div>
            </>
          )}
          <div><dt>Überführung</dt><dd>{formatCurrency(payment.transferCost)}</dd></div>
        </dl>
        {payment.calculatedRate != null && (
          <p className="dai-offer-preview__rate">
            {payment.type === 'cash'
              ? formatCurrency(payment.calculatedRate)
              : `${payment.calculatedRate.toLocaleString('de-DE')} €/Monat`}
          </p>
        )}
        {payment.budget != null && payment.calculatedRate != null && (
          <p className={`dai-offer-preview__budget${payment.calculatedRate <= payment.budget ? ' is-ok' : ' is-over'}`}>
            {payment.calculatedRate <= payment.budget
              ? '✓ Budget erfüllt'
              : `⚠ Budget überschritten um ${(payment.calculatedRate - payment.budget).toLocaleString('de-DE')} €`}
          </p>
        )}
      </section>

      <section className="dai-offer-preview__card">
        <h3>Zusatzwünsche</h3>
        <p className="dai-offer-preview__value">{formatExtras(payment)}</p>
      </section>

      <section className="dai-offer-preview__card">
        <h3>Timing</h3>
        <dl className="dai-offer-preview__dl">
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
          {timing.urgentNeed && (
            <div><dt>Sofortbedarf</dt><dd>Ja</dd></div>
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
