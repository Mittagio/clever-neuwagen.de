import { useMemo, useState } from 'react';
import { buildAdvisorBoostView } from '../../services/consultation/consultationOfferHandoff.js';
import CleverAdvisorBoostPanels from './CleverAdvisorBoostPanels.jsx';
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

  const { copy } = boostView;

  return (
    <div id="cc-advisor-boost-panel" className="cc-advisor-contact__quick cc-advisor-boost">
      <p className="cc-advisor-contact__quick-eyebrow">{copy.sectionLabel}</p>
      <p className="cc-advisor-boost__reassurance">{copy.reassurance}</p>
      <p className="cc-advisor-contact__quick-intro">{copy.intro}</p>

      <CleverAdvisorBoostPanels
        boostView={boostView}
        selectedIds={selectedIds}
        onToggleChip={toggleChip}
      />

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
