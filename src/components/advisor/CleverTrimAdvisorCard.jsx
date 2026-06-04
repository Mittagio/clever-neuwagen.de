import '../vehicle-detail/vehicle-detail.css';

function TrimOption({ direction, trimName, vehicleModel, priceDelta, gains = [], losses = [], onSelect }) {
  const isSave = direction === 'down';

  return (
    <article className={`vd-trim-advisor__option vd-trim-advisor__option--${direction}`}>
      <p className="vd-trim-advisor__option-label">
        {isSave ? 'Günstigere Alternative' : 'Mehr Ausstattung'}
      </p>
      <h4 className="vd-trim-advisor__option-title">
        {vehicleModel} {trimName}
      </h4>
      {priceDelta && (
        <p className={`vd-trim-advisor__delta${isSave ? ' vd-trim-advisor__delta--save' : ''}`}>
          {priceDelta}
        </p>
      )}
      {losses.length > 0 && (
        <ul className="vd-trim-advisor__list vd-trim-advisor__list--loss">
          {losses.map((l) => (
            <li key={l}><span aria-hidden>✗</span> {l}</li>
          ))}
        </ul>
      )}
      {gains.length > 0 && (
        <ul className="vd-trim-advisor__list vd-trim-advisor__list--gain">
          {gains.map((g) => (
            <li key={g}><span aria-hidden>✓</span> {g}</li>
          ))}
        </ul>
      )}
      {onSelect && (
        <button type="button" className="vd-btn vd-btn--secondary vd-btn--sm vd-btn--block" onClick={onSelect}>
          {trimName} ansehen
        </button>
      )}
    </article>
  );
}

/**
 * Sprint 38 – Air ↔ Earth ↔ GT-Line Assistent („Clever sagt:“)
 */
export default function CleverTrimAdvisorCard({
  vehicleModel,
  currentTrimName,
  betterTrim,
  premiumTrim,
  onAcceptBetterTrim,
  onAcceptPremiumTrim,
}) {
  if (!betterTrim?.exists && !premiumTrim?.exists) return null;

  return (
    <section className="vd-trim-advisor" aria-label="Clever Trim-Empfehlung">
      <p className="vd-trim-advisor__kicker">Clever sagt:</p>
      <p className="vd-trim-advisor__lead">
        Sie schauen gerade den {vehicleModel} {currentTrimName ?? ''}. Es gibt smarte Alternativen:
      </p>
      <div className="vd-trim-advisor__grid">
        {betterTrim?.exists && (
          <TrimOption
            direction="down"
            trimName={betterTrim.trim}
            vehicleModel={vehicleModel}
            priceDelta={betterTrim.reason}
            gains={betterTrim.keepLabels ?? []}
            losses={betterTrim.loseLabels ?? []}
            onSelect={onAcceptBetterTrim ? () => onAcceptBetterTrim(betterTrim) : null}
          />
        )}
        {premiumTrim?.exists && (
          <TrimOption
            direction="up"
            trimName={premiumTrim.trim}
            vehicleModel={vehicleModel}
            priceDelta={premiumTrim.reason}
            gains={premiumTrim.gainLabels ?? []}
            onSelect={onAcceptPremiumTrim ? () => onAcceptPremiumTrim(premiumTrim) : null}
          />
        )}
      </div>
    </section>
  );
}
