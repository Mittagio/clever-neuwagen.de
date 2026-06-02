import { formatPrice } from '../../data/kiaSportage.js';
import { getPaymentLabel } from '../../logic/offerService.js';
import { CUSTOMER_COUNTER_RESPONSES } from '../../data/offerDialogTypes.js';
import './CounterOfferBanner.css';

export default function CounterOfferBanner({
  counterOffer,
  offer,
  canRespond,
  authHint,
  onAccept,
  onDecline,
  onQuestion,
  busy = false,
}) {
  if (!counterOffer) return null;

  const pricing = counterOffer.pricing ?? offer.pricing;
  const paymentType = pricing.paymentType ?? 'leasing';
  const rate = pricing.rate ?? pricing.leasingRate ?? pricing.cashPrice;

  return (
    <section className="counter-offer-banner card" aria-label="Aktualisiertes Angebot">
      <div className="counter-offer-banner__badge">Aktualisiertes Angebot</div>
      <h2>Ihr Verkäufer hat das Angebot angepasst</h2>

      {counterOffer.dealerMessage && (
        <p className="counter-offer-banner__message">{counterOffer.dealerMessage}</p>
      )}

      <div className="counter-offer-banner__rate">
        <span className="counter-offer-banner__rate-label">{getPaymentLabel(paymentType)}</span>
        <strong>
          {paymentType === 'cash' ? formatPrice(rate ?? 0) : formatPrice(rate ?? 0)}
          {paymentType !== 'cash' && <span>/ Monat</span>}
        </strong>
      </div>

      <ul className="counter-offer-banner__details">
        {pricing.termMonths && <li>Laufzeit: {pricing.termMonths} Monate</li>}
        {pricing.mileagePerYear && (
          <li>{pricing.mileagePerYear.toLocaleString('de-DE')} km/Jahr</li>
        )}
        {pricing.downPayment > 0 && (
          <li>Anzahlung: {formatPrice(pricing.downPayment)}</li>
        )}
        {counterOffer.accessoriesNote && (
          <li>{counterOffer.accessoriesNote}</li>
        )}
      </ul>

      {canRespond ? (
        <div className="counter-offer-banner__actions">
          <button
            type="button"
            className="angebot-btn angebot-btn--primary"
            onClick={onAccept}
            disabled={busy}
          >
            {CUSTOMER_COUNTER_RESPONSES.accept.label}
          </button>
          <button
            type="button"
            className="angebot-btn angebot-btn--outline"
            onClick={onQuestion}
            disabled={busy}
          >
            {CUSTOMER_COUNTER_RESPONSES.question.label}
          </button>
          <button
            type="button"
            className="angebot-btn angebot-btn--ghost"
            onClick={onDecline}
            disabled={busy}
          >
            {CUSTOMER_COUNTER_RESPONSES.decline.label}
          </button>
        </div>
      ) : (
        <p className="counter-offer-banner__auth">
          {authHint ?? 'Bitte öffnen Sie den Link aus Ihrer E-Mail, um digital zu antworten.'}
        </p>
      )}
    </section>
  );
}
