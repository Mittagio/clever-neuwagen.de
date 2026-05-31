import { DEALER_AI_ACTIONS } from '../../services/dealerAiParser.js';

export default function DealerAiActionCard({ parsed, onConfirm, onEdit, onDiscard, isExecuting }) {
  if (!parsed?.ok) return null;

  const action = DEALER_AI_ACTIONS[parsed.action];

  return (
    <section className="dai-card dai-card--action">
      <header className="dai-card__head">
        <h2 className="dai-card__title">Was soll erstellt werden?</h2>
      </header>

      <div className="dai-action-preview">
        <p className="dai-action-preview__label">{action?.label ?? parsed.actionLabel}</p>
        <p className="dai-action-preview__desc">{action?.description ?? parsed.actionDescription}</p>
      </div>

      <div className="dai-confirm-row">
        <button
          type="button"
          className="dai-btn dai-btn--success"
          onClick={onConfirm}
          disabled={isExecuting}
        >
          ✓ So übernehmen
        </button>
        <button type="button" className="dai-btn dai-btn--ghost" onClick={onEdit}>
          ✎ Bearbeiten
        </button>
        <button type="button" className="dai-btn dai-btn--ghost" onClick={onDiscard}>
          ✕ Verwerfen
        </button>
      </div>
    </section>
  );
}
