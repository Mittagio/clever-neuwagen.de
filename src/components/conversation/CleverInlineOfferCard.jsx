import './clever-conversation.css';

/**
 * Inline-Angebotskarte im Thread – kein fixed Overlay.
 */
export default function CleverInlineOfferCard({
  vehicleCount = 0,
  onContinue,
}) {
  const count = Math.max(0, Number(vehicleCount) || 0);
  const sub = count > 0
    ? `${count} Fahrzeug${count === 1 ? '' : 'e'} ausgewählt`
    : 'Passendes Angebot vorbereiten';

  return (
    <article className="cc-inline-offer cc-turn-enter" aria-label="Angebot vorbereiten">
      <p className="cc-inline-offer__title">Angebot vorbereiten</p>
      <p className="cc-inline-offer__sub">{sub}</p>
      <button type="button" className="cc-inline-offer__cta" onClick={() => onContinue?.()}>
        Weiter zum Angebot
      </button>
    </article>
  );
}
