import { getKiaModelMediaEntry } from '../../data/kia/kiaModelImages.js';
import './clever-conversation.css';

function medalForIndex(idx, faded = false) {
  if (faded) return '⚪';
  if (idx === 0) return '🥇';
  if (idx === 1) return '🥈';
  return '🥉';
}

export default function CleverVehicleReasoningPanel({
  items = [],
  fadedItems = [],
  intro = null,
  compact = false,
  showMatchPercent = false,
  excludedKeys = [],
  excludeReaction = null,
  onExclude,
  offerPrep = null,
}) {
  const visibleActive = items.filter((item) => !excludedKeys.includes(item.modelKey));
  const visibleFaded = fadedItems.filter((item) => !excludedKeys.includes(item.modelKey));

  if (!visibleActive.length && !visibleFaded.length) return null;

  const panelClass = [
    'cc-reasoning',
    compact ? 'cc-reasoning--compact' : '',
    showMatchPercent ? 'cc-reasoning--endgame' : '',
  ].filter(Boolean).join(' ');

  const renderCard = (item, idx, faded = false) => {
    const medal = medalForIndex(idx, faded);
    const img = getKiaModelMediaEntry(item.modelKey, 'card').card;
    const isSelected = offerPrep?.selectedKeys?.includes(item.modelKey);

    return (
      <article
        key={`${item.modelKey}-${faded ? 'faded' : 'active'}-${idx}`}
        className={[
          'cc-reasoning__card',
          faded ? 'cc-reasoning__card--faded' : '',
          offerPrep && !faded ? 'cc-reasoning__card--selectable' : '',
          isSelected ? 'is-selected' : '',
        ].filter(Boolean).join(' ')}
      >
        {offerPrep && !faded && (
          <label className="cc-reasoning__offer-check">
            <input
              type="checkbox"
              checked={Boolean(isSelected)}
              onChange={() => offerPrep.onToggle?.(item.modelKey)}
            />
            <span className="cc-reasoning__offer-check-label">Angebot</span>
          </label>
        )}
        <div className="cc-reasoning__media">
          <img className="cc-reasoning__img" src={img} alt={item.title} loading="lazy" />
          <span className="cc-reasoning__rank" aria-hidden>{medal}</span>
          {(showMatchPercent || faded) && item.matchPercent != null && (
            <span className={`cc-reasoning__match${faded ? ' cc-reasoning__match--faded' : ''}`}>
              {item.matchPercent} %
            </span>
          )}
        </div>
        <div className="cc-reasoning__body">
          <h2 className="cc-reasoning__title">{item.title}</h2>
          {!compact && item.subtitle && <p className="cc-reasoning__subtitle">{item.subtitle}</p>}
          {item.rateLine && <p className="cc-reasoning__rate">{item.rateLine}</p>}
          {faded && item.exclusionReason && (
            <p className="cc-reasoning__exclusion">✕ {item.exclusionReason}</p>
          )}
          {!faded && (item.reasons?.length ?? 0) > 0 && (
            <ul className="cc-reasoning__reasons">
              {item.reasons.map((reason) => (
                <li key={reason}>✓ {reason}</li>
              ))}
            </ul>
          )}
          {onExclude && !offerPrep && !faded && (
            <button
              type="button"
              className="cc-reasoning__exclude"
              onClick={() => onExclude(item.modelKey)}
            >
              Gefällt mir nicht
            </button>
          )}
        </div>
      </article>
    );
  };

  return (
    <section className={panelClass} aria-label="Clever denkt mit">
      <p className="cc-reasoning__kicker">CLEVER DENKT MIT</p>
      {intro && <p className="cc-reasoning__intro">{intro}</p>}
      <div className="cc-reasoning__cards">
        {visibleActive.map((item, idx) => renderCard(item, idx, false))}
        {visibleFaded.map((item, idx) => renderCard(item, idx, true))}
      </div>
      {excludeReaction && (
        <p className="cc-reasoning__reaction" role="status">{excludeReaction}</p>
      )}
      {offerPrep?.selectedKeys?.length > 0 && (
        <p className="cc-reasoning__offer-lead">
          Für welche Fahrzeuge dürfen wir etwas vorbereiten?
        </p>
      )}
    </section>
  );
}
