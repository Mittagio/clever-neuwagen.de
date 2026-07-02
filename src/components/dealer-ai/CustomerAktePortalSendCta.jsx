import './CustomerAkte.css';

function resolveSendLabel({ boardItems = [], singleOffer = false } = {}) {
  if (singleOffer) return 'Kundenlink senden';
  const selectionGroups = boardItems.filter((item) => item.type === 'selection_group').length;
  const vehicles = boardItems.filter((item) => item.type === 'vehicle').length;
  if (selectionGroups + vehicles <= 1) return 'Kundenlink senden';
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
  const singleOffer = boardItems.length === 1;
  const label = resolveSendLabel({ boardItems, singleOffer });

  if (!hasItems) return null;

  return (
    <section className="cust-akte-portal-send" aria-label="Kundenlink senden">
      <div className="cust-akte-portal-send__copy">
        <h3 className="cust-akte-portal-send__title">Clever Auswahl an Kunden senden</h3>
        <p className="cust-akte-portal-send__text">
          Persönlicher Link zur Fahrzeugauswahl – der Kunde bestätigt den Zugang mit einem Code.
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
          disabled={disabled}
        >
          {label}
        </button>
      )}
    </section>
  );
}
