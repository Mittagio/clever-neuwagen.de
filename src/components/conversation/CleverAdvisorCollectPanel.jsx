import { useMemo, useState } from 'react';
import {
  ADVISOR_COLLECT_COPY,
  buildAdvisorBoostView,
} from '../../services/consultation/consultationOfferHandoff.js';
import CleverAdvisorBoostPanels from './CleverAdvisorBoostPanels.jsx';
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

  return (
    <section className="cc-advisor-collect cc-turn-enter" aria-labelledby="cc-advisor-collect-title">
      <p className="cc-advisor-collect__eyebrow">{ADVISOR_COLLECT_COPY.sectionLabel}</p>
      <h2 id="cc-advisor-collect-title" className="cc-advisor-collect__title">
        {ADVISOR_COLLECT_COPY.title}
      </h2>
      <p className="cc-advisor-collect__reassurance">{ADVISOR_COLLECT_COPY.reassurance}</p>
      <p className="cc-advisor-collect__intro">{ADVISOR_COLLECT_COPY.intro}</p>

      <CleverAdvisorBoostPanels
        boostView={boostView}
        selectedIds={selectedIds}
        onToggleChip={toggleChip}
        chipClassName="cc-advisor-collect__chip"
        groupClassName="cc-advisor-collect__group"
      />

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
