import { useState } from 'react';
import {
  SPECIAL_CONDITION_OPTIONS,
  selectSpecialCondition,
} from '../../services/dealer/specialConditionOptions.js';
import './dealer-landing.css';

/**
 * Sonderrabatte – letzter Schritt vor der Anfrage.
 */
export default function DealerSpecialConditionsCard({
  configSummary,
  value = [],
  onContinue,
}) {
  const [selected, setSelected] = useState(value?.[0] ?? 'privat');
  const showImprovement = selected && selected !== 'privat';

  function handleSubmit(event) {
    event.preventDefault();
    onContinue?.(selectSpecialCondition([], selected));
  }

  return (
    <section className="dl-special" aria-labelledby="dl-special-title">
      {configSummary && (
        <p className="dl-special__recap">
          <strong>
            Kia
            {' '}
            {configSummary.modelLabel}
          </strong>
          {configSummary.trimLabel && (
            <>
              {' · Ausstattung '}
              {configSummary.trimLabel}
            </>
          )}
        </p>
      )}

      <h2 id="dl-special-title" className="dl-special__title">
        Gehören Sie zu einer dieser Gruppen?
      </h2>

      <form className="dl-special__form" onSubmit={handleSubmit}>
        <fieldset className="dl-special__options dl-special__options--radio">
          <legend className="sr-only">Kundengruppe</legend>
          {SPECIAL_CONDITION_OPTIONS.map((option) => (
            <label
              key={option.id}
              className={`dl-special__option${selected === option.id ? ' dl-special__option--active' : ''}`}
            >
              <input
                type="radio"
                name="special-condition"
                value={option.id}
                checked={selected === option.id}
                onChange={() => setSelected(option.id)}
              />
              <span className="dl-special__option-label">{option.label}</span>
            </label>
          ))}
        </fieldset>

        {showImprovement && (
          <p className="dl-special__improved" aria-live="polite">
            Ihre Kondition wurde verbessert.
          </p>
        )}

        <button type="submit" className="btn btn-primary dl-special__cta">
          Weiter zur Anfrage
        </button>
      </form>
    </section>
  );
}
