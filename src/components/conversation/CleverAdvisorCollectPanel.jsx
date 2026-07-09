import { useMemo, useState } from 'react';
import {
  ADVISOR_COLLECT_COPY,
  buildAdvisorBoostView,
} from '../../services/consultation/consultationOfferHandoff.js';
import './clever-conversation.css';

export default function CleverAdvisorCollectPanel({ session, onSubmit }) {
  const boostView = useMemo(() => buildAdvisorBoostView(session), [session]);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [freetext, setFreetext] = useState('');

  const toggleChip = (chipId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(chipId)) next.delete(chipId);
      else next.add(chipId);
      return next;
    });
  };

  const handleSubmit = () => {
    onSubmit?.({
      selectedChipIds: [...selectedIds],
      freetext,
    });
  };

  const { categories, suggestions, showSuggestions } = boostView;

  return (
    <section className="cc-advisor-collect cc-turn-enter" aria-labelledby="cc-advisor-collect-title">
      <p className="cc-advisor-collect__eyebrow">{ADVISOR_COLLECT_COPY.sectionLabel}</p>
      <h2 id="cc-advisor-collect-title" className="cc-advisor-collect__title">
        {ADVISOR_COLLECT_COPY.title}
      </h2>
      <p className="cc-advisor-collect__subtitle">{ADVISOR_COLLECT_COPY.subtitle}</p>
      <p className="cc-advisor-collect__reassurance">{ADVISOR_COLLECT_COPY.reassurance}</p>
      <p className="cc-advisor-collect__intro">{ADVISOR_COLLECT_COPY.intro}</p>

      {categories.map((category) => (
        <div key={category.id} className="cc-advisor-collect__group">
          <p className="cc-advisor-collect__group-label">{category.label}</p>
          <div className="cc-advisor-collect__chips" role="group" aria-label={category.label}>
            {category.chips.map((chip) => {
              const selected = selectedIds.has(chip.id);
              return (
                <button
                  key={chip.id}
                  type="button"
                  className={`cc-advisor-collect__chip${selected ? ' cc-advisor-collect__chip--selected' : ''}`}
                  aria-pressed={selected}
                  onClick={() => toggleChip(chip.id)}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {showSuggestions && (
        <div className="cc-advisor-collect__group cc-advisor-collect__group--suggestions">
          <p className="cc-advisor-collect__group-label">{boostView.copy.suggestionsLabel}</p>
          <div className="cc-advisor-collect__chips" role="group" aria-label={boostView.copy.suggestionsLabel}>
            {suggestions.map((chip) => {
              const selected = selectedIds.has(chip.id);
              return (
                <button
                  key={chip.id}
                  type="button"
                  className={`cc-advisor-collect__chip${selected ? ' cc-advisor-collect__chip--selected' : ''}`}
                  aria-pressed={selected}
                  onClick={() => toggleChip(chip.id)}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <label className="cc-advisor-collect__freetext-label" htmlFor="cc-advisor-collect-text">
        {ADVISOR_COLLECT_COPY.freetextLabel}
      </label>
      <textarea
        id="cc-advisor-collect-text"
        className="cc-advisor-collect__freetext"
        placeholder={ADVISOR_COLLECT_COPY.freetextPlaceholder}
        value={freetext}
        onChange={(event) => setFreetext(event.target.value)}
        rows={4}
      />

      <button type="button" className="cc-advisor-collect__submit" onClick={handleSubmit}>
        {ADVISOR_COLLECT_COPY.submitLabel}
      </button>
    </section>
  );
}
