import { useEffect, useMemo, useState } from 'react';
import {
  getQuickHandoffChip,
  getVisibleHandoffCategories,
  inferPrefilledHandoffChipIds,
  QUICK_HANDOFF_COPY,
} from '../../services/consultation/consultationOfferHandoff.js';
import './clever-conversation.css';

export default function CleverHandoffEnrichment({ session, onChange }) {
  const prefilledIds = useMemo(
    () => new Set(inferPrefilledHandoffChipIds(session)),
    [session],
  );
  const categories = useMemo(
    () => getVisibleHandoffCategories(session?.needProfile ?? {}),
    [session?.needProfile],
  );

  const [selectedIds, setSelectedIds] = useState(() => new Set(prefilledIds));
  const [freetext, setFreetext] = useState('');

  useEffect(() => {
    onChange?.({ selectedChipIds: [...prefilledIds], freetext: '' });
  }, [onChange, prefilledIds]);

  const toggleChip = (chipId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(chipId)) next.delete(chipId);
      else next.add(chipId);
      onChange?.({ selectedChipIds: [...next], freetext });
      return next;
    });
  };

  const handleFreetextChange = (value) => {
    setFreetext(value);
    onChange?.({ selectedChipIds: [...selectedIds], freetext: value });
  };

  return (
    <div className="cc-offer-handoff__enrichment">
      <p className="cc-offer-handoff__enrichment-label">{QUICK_HANDOFF_COPY.sectionLabel}</p>
      <h3 className="cc-offer-handoff__enrichment-title">{QUICK_HANDOFF_COPY.title}</h3>
      <p className="cc-offer-handoff__enrichment-subtitle">{QUICK_HANDOFF_COPY.subtitle}</p>

      {categories.map((category) => (
        <div key={category.id} className="cc-offer-handoff__enrichment-group">
          <p className="cc-offer-handoff__enrichment-group-label">
            <span aria-hidden>{category.icon}</span>
            {category.label}
          </p>
          <div
            className="cc-offer-handoff__chips"
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
                  className={`cc-option-chip cc-offer-handoff__chip${
                    selected ? ' cc-offer-handoff__chip--selected' : ''
                  }`}
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

      <label className="cc-offer-handoff__enrichment-freetext-label" htmlFor="cc-handoff-enrichment-text">
        Freitext
      </label>
      <textarea
        id="cc-handoff-enrichment-text"
        className="cc-offer-handoff__note"
        placeholder={QUICK_HANDOFF_COPY.freetextPlaceholder}
        value={freetext}
        onChange={(event) => handleFreetextChange(event.target.value)}
        rows={3}
        aria-label="Optionaler Hinweis für Ihren Berater"
      />
    </div>
  );
}
