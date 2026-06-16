import { useState } from 'react';
import LeadDetailPanel from './LeadDetailPanel.jsx';

export default function DealerAiReviewBar({
  reservedModel,
  onCreateLead,
  onPrepareOffer,
  onDraftReply,
  onEdit,
  onDiscard,
  isExecuting,
}) {
  const [moreOpen, setMoreOpen] = useState(false);

  const reservedLabel = reservedModel
    ? `${reservedModel.name.replace(/^Kia\s+/i, '')} vorgemerkt`
    : null;

  return (
    <>
      <div className="dai-review-bar" role="toolbar" aria-label="Nächster Schritt">
        {reservedLabel && (
          <p className="dai-review-bar__reserved">{reservedLabel}</p>
        )}
        <button
          type="button"
          className="dai-review-bar__cta"
          onClick={onCreateLead}
          disabled={isExecuting}
        >
          {isExecuting ? 'Wird erstellt …' : 'Verkaufschance erstellen'}
        </button>
        <button
          type="button"
          className="dai-review-bar__more"
          onClick={() => setMoreOpen(true)}
        >
          Mehr
        </button>
      </div>

      <LeadDetailPanel
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        title="Mehr"
      >
        <div className="dai-more-actions">
          <button
            type="button"
            className="dai-more-actions__btn"
            onClick={() => { setMoreOpen(false); onPrepareOffer?.(); }}
            disabled={isExecuting}
          >
            Angebot vorbereiten
          </button>
          <button
            type="button"
            className="dai-more-actions__btn"
            onClick={() => { setMoreOpen(false); onDraftReply?.(); }}
            disabled={isExecuting}
          >
            Rückfrage formulieren
          </button>
          <button
            type="button"
            className="dai-more-actions__btn"
            onClick={() => { setMoreOpen(false); onEdit?.(); }}
          >
            Bearbeiten
          </button>
          <button
            type="button"
            className="dai-more-actions__btn dai-more-actions__btn--muted"
            onClick={() => { setMoreOpen(false); onDiscard?.(); }}
          >
            Später
          </button>
        </div>
      </LeadDetailPanel>
    </>
  );
}
