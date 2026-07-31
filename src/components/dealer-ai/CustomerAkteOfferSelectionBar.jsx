/**
 * Mehrfachauswahl-Leiste unter den Spuren: Vergleichen / Kundenangebot / Nachricht.
 */
export default function CustomerAkteOfferSelectionBar({
  selectedCount = 0,
  onCompare = null,
  onCreateCustomerOffer = null,
  onPrepareMessage = null,
  onClear = null,
}) {
  if (selectedCount < 2) return null;

  return (
    <div className="cust-akte-offer-select" role="status">
      <p className="cust-akte-offer-select__count">
        {selectedCount}
        {' '}
        Angebote ausgewählt
      </p>
      <div className="cust-akte-offer-select__actions">
        <button type="button" className="cust-akte-offer-select__btn" onClick={onCompare}>
          Vergleichen
        </button>
        <button type="button" className="cust-akte-offer-select__btn" onClick={onCreateCustomerOffer}>
          Kundenangebot erstellen
        </button>
        <button
          type="button"
          className="cust-akte-offer-select__btn cust-akte-offer-select__btn--primary"
          onClick={onPrepareMessage}
        >
          Nachricht vorbereiten
        </button>
      </div>
      {onClear ? (
        <button type="button" className="cust-akte-offer-select__clear" onClick={onClear}>
          Auswahl leeren
        </button>
      ) : null}
    </div>
  );
}
