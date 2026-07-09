import { useState } from 'react';
import {
  buildAdvisorContactPrompt,
  getQuickHandoffChip,
  QUICK_HANDOFF_CATEGORIES,
  QUICK_HANDOFF_COPY,
} from '../../services/consultation/consultationOfferHandoff.js';
import './clever-conversation.css';

export default function CleverAdvisorContactPrompt({
  understandingCount = 0,
  variant = 'engaged',
  onContact,
  onExpandedChange,
}) {
  const [expanded, setExpanded] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [freetext, setFreetext] = useState('');

  const prompt = buildAdvisorContactPrompt(understandingCount, variant);
  if (!prompt) return null;

  const toggleExpanded = () => {
    setExpanded((prev) => {
      const next = !prev;
      onExpandedChange?.(next);
      return next;
    });
  };

  const toggleChip = (chipId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(chipId)) next.delete(chipId);
      else next.add(chipId);
      return next;
    });
  };

  const handleContact = () => {
    onContact?.({
      selectedChipIds: [...selectedIds],
      freetext,
    });
  };

  return (
    <aside
      className={`cc-advisor-contact${expanded ? ' cc-advisor-contact--expanded' : ''}${variant === 'opening' ? ' cc-advisor-contact--opening' : ''}`}
      aria-label="Persönliche Beratung"
    >
      {variant === 'opening' && (
        <p className="cc-advisor-contact__opening-or">oder</p>
      )}
      {prompt.hint && (
        <p className="cc-advisor-contact__hint">{prompt.hint}</p>
      )}
      <button
        type="button"
        className="cc-advisor-contact__cta"
        onClick={handleContact}
      >
        <span className="cc-advisor-contact__icon" aria-hidden>☎</span>
        Mit einem Berater sprechen
      </button>

      {prompt.optionalNote && (
        <p className="cc-advisor-contact__optional-note">{prompt.optionalNote}</p>
      )}

      {variant !== 'opening' && (
        <button
          type="button"
          className="cc-advisor-contact__expand"
          onClick={toggleExpanded}
          aria-expanded={expanded}
          aria-controls="cc-advisor-quick-panel"
        >
          {expanded ? QUICK_HANDOFF_COPY.collapseLabel : QUICK_HANDOFF_COPY.expandLabel}
        </button>
      )}

      {expanded && (
        <div id="cc-advisor-quick-panel" className="cc-advisor-contact__quick">
          <h3 className="cc-advisor-contact__quick-title">{QUICK_HANDOFF_COPY.title}</h3>
          <p className="cc-advisor-contact__quick-subtitle">{QUICK_HANDOFF_COPY.subtitle}</p>
          {QUICK_HANDOFF_CATEGORIES.map((category) => (
            <div key={category.id} className="cc-advisor-contact__quick-group">
              <p className="cc-advisor-contact__quick-group-label">
                <span aria-hidden>{category.icon}</span>
                {category.label}
              </p>
              <div
                className="cc-advisor-contact__quick-chips"
                role="group"
                aria-label={category.label}
              >
                {category.chipIds.map((chipId) => {
                  const chip = getQuickHandoffChip(chipId);
                  if (!chip) return null;
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
          <label className="cc-advisor-contact__quick-field-label" htmlFor="cc-advisor-quick-text">
            Freitext
          </label>
          <textarea
            id="cc-advisor-quick-text"
            className="cc-advisor-contact__quick-field"
            placeholder={QUICK_HANDOFF_COPY.freetextPlaceholder}
            value={freetext}
            onChange={(event) => setFreetext(event.target.value)}
            rows={4}
          />
        </div>
      )}
    </aside>
  );
}
