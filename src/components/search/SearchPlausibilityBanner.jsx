import './search-plausibility-banner.css';

/**
 * Kritische Korrekturhinweise – nur bei echten Risiken (z. B. 780 PS)
 */
export default function SearchPlausibilityBanner({
  warnings = [],
  corrections = [],
  onChoose,
}) {
  const choices = corrections.filter((c) => c.requiresChoice);
  if (!choices.length && !warnings.length) return null;

  const primary = choices[0];
  const warningText = warnings[0] ?? primary?.reason;

  return (
    <aside className="search-plausibility" role="note" aria-live="polite">
      <p className="search-plausibility__lead">Wir sind uns bei einem Punkt nicht sicher.</p>
      {warningText && (
        <p className="search-plausibility__text">{warningText}</p>
      )}
      {primary && (
        <div className="search-plausibility__actions">
          <button
            type="button"
            className="search-plausibility__btn search-plausibility__btn--primary"
            onClick={() => onChoose?.(primary, true)}
          >
            {primary.labelAccept ?? primary.suggestion}
          </button>
          <button
            type="button"
            className="search-plausibility__btn search-plausibility__btn--ghost"
            onClick={() => onChoose?.(primary, false)}
          >
            {primary.labelKeep ?? `${primary.original} beibehalten`}
          </button>
        </div>
      )}
      {choices.length > 1 && choices.slice(1).map((c) => (
        <div key={c.field + c.original} className="search-plausibility__actions">
          <button
            type="button"
            className="search-plausibility__btn search-plausibility__btn--primary"
            onClick={() => onChoose?.(c, true)}
          >
            {c.labelAccept ?? c.suggestion}
          </button>
          {c.altPatch && (
            <button
              type="button"
              className="search-plausibility__btn search-plausibility__btn--ghost"
              onClick={() => onChoose?.({ ...c, applyPatch: c.altPatch }, true)}
            >
              {c.labelKeep}
            </button>
          )}
        </div>
      ))}
    </aside>
  );
}
