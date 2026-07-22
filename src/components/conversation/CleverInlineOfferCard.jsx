import './clever-conversation.css';
import { buildIncompleteOfferHandoffCopy } from '../../services/consultation/customerIntakeExits.js';

/**
 * Inline-Angebotskarte im Thread – kein fixed Overlay.
 * Unvollständige Profile sind erlaubt (Intake).
 */
export default function CleverInlineOfferCard({
  vehicleCount = 0,
  onContinue,
  onEnrichLease,
  incomplete = true,
}) {
  const copy = buildIncompleteOfferHandoffCopy();
  const count = Math.max(0, Number(vehicleCount) || 0);
  const sub = incomplete
    ? copy.body
    : (count > 0
      ? `${count} Fahrzeug${count === 1 ? '' : 'e'} ausgewählt`
      : 'Passendes Angebot vorbereiten');

  return (
    <article className="cc-inline-offer cc-turn-enter" aria-label="Angebot vorbereiten">
      <p className="cc-inline-offer__title">{copy.title}</p>
      <p className="cc-inline-offer__sub">{sub}</p>
      <div className="cc-inline-offer__actions">
        <button type="button" className="cc-inline-offer__cta" onClick={() => onContinue?.()}>
          {copy.primaryLabel}
        </button>
        {incomplete && (
          <button
            type="button"
            className="cc-inline-offer__cta cc-inline-offer__cta--secondary"
            onClick={() => (onEnrichLease ? onEnrichLease() : onContinue?.())}
          >
            {copy.secondaryLabel}
          </button>
        )}
      </div>
    </article>
  );
}
