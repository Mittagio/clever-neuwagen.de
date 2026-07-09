import { useMemo, useState } from 'react';
import { buildAdvisorBoostView } from '../../services/consultation/consultationOfferHandoff.js';
import './clever-conversation.css';

export default function CleverAdvisorBoost({ session, onChange }) {
  const boostView = useMemo(() => buildAdvisorBoostView(session), [session]);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [freetext, setFreetext] = useState('');

  const notifyChange = (nextIds, nextFreetext) => {
    onChange?.({ selectedChipIds: [...nextIds], freetext: nextFreetext });
  };

  const toggleChip = (chipId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(chipId)) next.delete(chipId);
      else next.add(chipId);
      notifyChange(next, freetext);
      return next;
    });
  };

  const handleFreetextChange = (value) => {
    setFreetext(value);
    notifyChange(selectedIds, value);
  };

  const { copy, categories, suggestions, showSuggestions } = boostView;

  return (
    <div id="cc-advisor-boost-panel" className="cc-advisor-contact__quick">
      <p className="cc-advisor-contact__quick-eyebrow">{copy.sectionLabel}</p>
      <h3 className="cc-advisor-contact__quick-title">{copy.title}</h3>
      <p className="cc-advisor-contact__quick-subtitle">{copy.subtitle}</p>
      <p className="cc-advisor-contact__quick-intro">{copy.intro}</p>

      {categories.map((category) => (
        <div key={category.id} className="cc-advisor-contact__quick-group">
          <p className="cc-advisor-contact__quick-group-label">{category.label}</p>
          <div
            className="cc-advisor-contact__quick-chips"
            role="group"
            aria-label={category.label}
          >
            {category.chips.map((chip) => {
              const selected = selectedIds.has(chip.id);
              return (
                <button
                  key={chip.id}
                  type="button"
                  className={`cc-advisor-contact__chip${selected ? ' cc-advisor-contact__chip--selected' : ''}`}
                  aria-pressed={selected}
                  onClick={() => toggleChip(chip.id)}
                >
                  <span className="cc-advisor-contact__chip-box" aria-hidden>
                    {selected ? '✓' : ''}
                  </span>
                  {chip.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {showSuggestions && (
        <div className="cc-advisor-contact__quick-group cc-advisor-contact__quick-group--suggestions">
          <p className="cc-advisor-contact__quick-group-label">{copy.suggestionsLabel}</p>
          <div
            className="cc-advisor-contact__quick-chips"
            role="group"
            aria-label={copy.suggestionsLabel}
          >
            {suggestions.map((chip) => {
              const selected = selectedIds.has(chip.id);
              return (
                <button
                  key={chip.id}
                  type="button"
                  className={`cc-advisor-contact__chip${selected ? ' cc-advisor-contact__chip--selected' : ''}`}
                  aria-pressed={selected}
                  onClick={() => toggleChip(chip.id)}
                >
                  <span className="cc-advisor-contact__chip-box" aria-hidden>
                    {selected ? '✓' : ''}
                  </span>
                  {chip.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <label className="cc-advisor-contact__quick-field-label" htmlFor="cc-advisor-boost-text">
        {copy.freetextLabel}
      </label>
      <textarea
        id="cc-advisor-boost-text"
        className="cc-advisor-contact__quick-field"
        placeholder={copy.freetextPlaceholder}
        value={freetext}
        onChange={(event) => handleFreetextChange(event.target.value)}
        rows={4}
      />
    </div>
  );
}
