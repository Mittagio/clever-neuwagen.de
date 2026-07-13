import { useRef, useState } from 'react';
import {
  buildWishHandoffCta,
  countSessionUnderstandingLabels,
  QUICK_HANDOFF_COPY,
} from '../../services/consultation/consultationOfferHandoff.js';
import CleverAdvisorBoost from './CleverAdvisorBoost.jsx';
import './clever-conversation.css';

export default function CleverAdvisorContactPrompt({
  session,
  dealerName = 'Autohaus',
  onContact,
  onExpandedChange,
}) {
  const [expanded, setExpanded] = useState(false);
  const enrichmentRef = useRef({ selectedChipIds: [], freetext: '' });

  const understandingCount = countSessionUnderstandingLabels(session);
  const showBoost = understandingCount > 0;

  const toggleExpanded = () => {
    setExpanded((prev) => {
      const next = !prev;
      onExpandedChange?.(next);
      return next;
    });
  };

  const handleContact = () => {
    onContact?.(showBoost ? enrichmentRef.current : undefined);
  };

  return (
    <aside
      className={`cc-wish-handoff${expanded ? ' cc-wish-handoff--expanded' : ''}`}
      aria-label="Wunsch übergeben"
    >
      <button
        type="button"
        className="cc-wish-handoff__cta"
        onClick={handleContact}
      >
        <span className="cc-wish-handoff__cta-main">
          <span className="cc-wish-handoff__icon" aria-hidden>✓</span>
          <span className="cc-wish-handoff__cta-copy">
            <span className="cc-wish-handoff__cta-title">Wunsch verstanden</span>
            <span className="cc-wish-handoff__cta-sub">Passendes Angebot erhalten</span>
          </span>
        </span>
      </button>

      {showBoost && (
        <button
          type="button"
          className="cc-wish-handoff__expand"
          onClick={toggleExpanded}
          aria-expanded={expanded}
          aria-controls="cc-advisor-boost-panel"
        >
          {expanded ? QUICK_HANDOFF_COPY.collapseLabel : QUICK_HANDOFF_COPY.expandLabel}
        </button>
      )}

      {showBoost && expanded && (
        <CleverAdvisorBoost
          session={session}
          onChange={(enrichment) => {
            enrichmentRef.current = enrichment;
          }}
        />
      )}
    </aside>
  );
}
