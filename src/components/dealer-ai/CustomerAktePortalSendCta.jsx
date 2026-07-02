import './CustomerAkte.css';
import { countSendableBoardItems } from '../../services/dealer/boardOfferModel.js';

function resolveSendLabel({ boardItems = [], lead = null, singleOffer = false } = {}) {
  const sendable = countSendableBoardItems(boardItems, lead);
  if (sendable === 0) return 'An Kunden senden';
  if (singleOffer || sendable === 1) return 'Kundenlink senden';
  return 'Auswahl senden';
}

export default function CustomerAktePortalSendCta({
  boardItems = [],
  email = '',
  lead = null,
  onSend,
  onAddEmail,
  disabled = false,
}) {
  const hasItems = boardItems.length > 0;
  const hasEmail = Boolean(email?.trim());
  const sendableCount = countSendableBoardItems(boardItems, lead);
  const singleOffer = sendableCount === 1;
  const label = resolveSendLabel({ boardItems, lead, singleOffer });
  const hasDraftOnly = hasItems && sendableCount === 0;

  if (!hasItems) return null;

  return (
    <section className="cust-akte-portal-send" aria-label="Angebote an Kunden senden">
      <div className="cust-akte-portal-send__copy">
        <h3 className="cust-akte-portal-send__title">Angebote an Kunden senden</h3>
        <p className="cust-akte-portal-send__text">
          {hasDraftOnly
            ? 'Entwürfe müssen zuerst im Angebotsrechner erstellt werden, bevor sie versendet werden können.'
            : 'Persönlicher Link zur Fahrzeugauswahl – der Kunde bestätigt den Zugang mit einem Code.'}
        </p>
      </div>

      {!hasEmail ? (
        <div className="cust-akte-portal-send__missing">
          <p className="cust-akte-portal-send__hint">E-Mail-Adresse ergänzen, um den Kundenlink zu senden.</p>
          <button type="button" className="cust-akte-portal-send__btn" onClick={onAddEmail}>
            E-Mail ergänzen
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="cust-akte-portal-send__btn cust-akte-portal-send__btn--primary"
          onClick={onSend}
          disabled={disabled || hasDraftOnly}
        >
          {label}
        </button>
      )}
    </section>
  );
}
