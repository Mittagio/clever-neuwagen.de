import './clever-conversation.css';

/**
 * Permanente Wunschübergabe am Composer – ab Turn 1, ohne Bedarfsanalyse-Zwang.
 */
export default function CleverComposerExits({
  primaryLabel = 'Meine Wünsche weitergeben',
  secondaryLabel = null,
  onPrimary,
  onSecondary,
  /** @deprecated legacy alias */
  offerLabel,
  /** @deprecated legacy alias */
  contactLabel,
  /** @deprecated legacy alias */
  onOffer,
  /** @deprecated legacy alias */
  onContact,
  disabled = false,
}) {
  const label = primaryLabel || offerLabel || contactLabel || 'Meine Wünsche weitergeben';
  const handlePrimary = onPrimary || onOffer || onContact;

  return (
    <div className="cc-exits" role="group" aria-label="Wünsche weitergeben">
      <button
        type="button"
        className="cc-exits__btn cc-exits__btn--wish"
        onClick={() => handlePrimary?.()}
        disabled={disabled}
      >
        <span className="cc-exits__btn-icon" aria-hidden>→</span>
        <span>{label}</span>
      </button>
      {secondaryLabel && (
        <button
          type="button"
          className="cc-exits__btn cc-exits__btn--secondary"
          onClick={() => onSecondary?.()}
          disabled={disabled}
        >
          {secondaryLabel}
        </button>
      )}
    </div>
  );
}
