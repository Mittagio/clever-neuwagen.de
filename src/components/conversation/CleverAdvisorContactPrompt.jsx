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
  offerModelKeys = [],
  offerModels = [],
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
    const enrichment = showBoost ? enrichmentRef.current : undefined;
    if (offerModelKeys.length) {
      onContact?.({
        ...enrichment,
        selectedOfferModels: offerModelKeys,
        offerModelLabels: offerModels
          .filter((item) => offerModelKeys.includes(item.modelKey))
          .map((item) => item.title),
      });
      return;
    }
    onContact?.(enrichment);
  };

  const ctaSub = offerModelKeys.length
    ? `Angebot für ${offerModelKeys.length} Fahrzeug${offerModelKeys.length > 1 ? 'e' : ''} vorbereiten`
    : 'Passendes Angebot erhalten';

  return (
    <aside
      className={`cc-wish-handoff${expanded ? ' cc-wish-handoff--expanded' : ''}`}
      aria-label="Wünsche weitergeben"
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
            <span className="cc-wish-handoff__cta-sub">{ctaSub}</span>
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
