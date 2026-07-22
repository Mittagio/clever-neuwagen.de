import './clever-conversation.css';

/**
 * Permanente Ausgänge am Composer – ab Turn 1, ohne Bedarfsanalyse-Zwang.
 */
export default function CleverComposerExits({
  offerLabel = 'Angebot anfordern',
  contactLabel = 'Verkäufer kontaktieren',
  onOffer,
  onContact,
  disabled = false,
}) {
  return (
    <div className="cc-exits" role="group" aria-label="Gespräch beenden oder Angebot">
      <button
        type="button"
        className="cc-exits__btn cc-exits__btn--offer"
        onClick={() => onOffer?.()}
        disabled={disabled}
      >
        {offerLabel}
      </button>
      <button
        type="button"
        className="cc-exits__btn cc-exits__btn--contact"
        onClick={() => onContact?.()}
        disabled={disabled}
      >
        {contactLabel}
      </button>
    </div>
  );
}
