import './clever-conversation.css';

export default function CleverVehicleMiniRecommendation({
  recommendation,
  onHandoffToDealer,
  onAddMore,
}) {
  if (!recommendation?.ready) return null;

  return (
    <section className="cc-vehicle-mini cc-turn-enter" aria-labelledby="cc-vehicle-mini-title">
      <h2 id="cc-vehicle-mini-title" className="cc-vehicle-mini__headline">
        {recommendation.headline}
      </h2>

      <div className="cc-vehicle-mini__direction">
        <p className="cc-vehicle-mini__battery">{recommendation.batteryLine}</p>
        <p className="cc-vehicle-mini__trim">{recommendation.trimLine}</p>
      </div>

      {recommendation.whyLines?.length > 0 && (
        <div className="cc-vehicle-mini__why">
          <p className="cc-vehicle-mini__why-title">Warum?</p>
          <ul className="cc-vehicle-mini__why-list">
            {recommendation.whyLines.map((line) => (
              <li key={line} className="cc-vehicle-mini__why-item">
                <span aria-hidden>✓</span>
                {line}
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        type="button"
        className="cc-vehicle-mini__cta"
        onClick={onHandoffToDealer}
      >
        Wunsch an Berater übergeben
      </button>

      <button
        type="button"
        className="cc-vehicle-mini__secondary"
        onClick={onAddMore}
      >
        Noch etwas zum EV3 ergänzen
      </button>
    </section>
  );
}
