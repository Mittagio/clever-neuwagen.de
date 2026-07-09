import { useRef, useState } from 'react';
import {
  buildAdvisorContactPrompt,
  QUICK_HANDOFF_COPY,
} from '../../services/consultation/consultationOfferHandoff.js';
import CleverAdvisorBoost from './CleverAdvisorBoost.jsx';
import './clever-conversation.css';

export default function CleverAdvisorContactPrompt({
  session,
  understandingCount = 0,
  variant = 'engaged',
  onContact,
  onExpandedChange,
}) {
  const [expanded, setExpanded] = useState(false);
  const enrichmentRef = useRef({ selectedChipIds: [], freetext: '' });

  const prompt = buildAdvisorContactPrompt(understandingCount, variant);
  if (!prompt) return null;

  const showBoost = variant !== 'opening' && understandingCount > 0;

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

      {showBoost && (
        <button
          type="button"
          className="cc-advisor-contact__expand"
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
