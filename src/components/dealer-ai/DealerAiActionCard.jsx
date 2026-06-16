import { DEALER_AI_ACTIONS, PAYMENT_TYPE_LABELS } from '../../services/dealerAiParser.js';

export default function DealerAiActionCard({
  parsed,
  selectedModelId,
  onConfirm,
  onCreateLead,
  onPrepareOffer,
  onDraftReply,
  onEdit,
  onDiscard,
  isExecuting,
}) {
  if (!parsed?.ok) return null;

  const action = DEALER_AI_ACTIONS[parsed.action];
  const reservedModel = parsed.suggestedModels?.find((m) => m.id === selectedModelId);
  const paymentLabel = PAYMENT_TYPE_LABELS[parsed.fields?.paymentType] ?? 'Noch unklar';

  return (
    <section className="dai-card dai-card--action">
      <header className="dai-card__head">
        <h2 className="dai-card__title">Nächster Schritt</h2>
      </header>

      <div className="dai-action-preview">
        <p className="dai-action-preview__label">{action?.label ?? parsed.actionLabel}</p>
        <p className="dai-action-preview__desc">
          Angebotsart: <strong>{paymentLabel}</strong>
          {reservedModel && (
            <> · Vorgemerkt: <strong>{reservedModel.name}</strong></>
          )}
          {!reservedModel && parsed.fields?.model && (
            <> · Modell: <strong>Kia {parsed.fields.model}</strong></>
          )}
        </p>
      </div>

      <div className="dai-confirm-row dai-confirm-row--stack">
        <button
          type="button"
          className="dai-btn dai-btn--success"
          onClick={onCreateLead}
          disabled={isExecuting}
        >
          Verkaufschance erstellen
        </button>
        <div className="dai-confirm-row dai-confirm-row--secondary">
          <button
            type="button"
            className="dai-btn dai-btn--ghost"
            onClick={onPrepareOffer}
            disabled={isExecuting}
          >
            Angebot vorbereiten
          </button>
          <button
            type="button"
            className="dai-btn dai-btn--ghost"
            onClick={onDraftReply}
            disabled={isExecuting}
          >
            Rückfrage formulieren
          </button>
        </div>
        <div className="dai-confirm-row dai-confirm-row--secondary">
          <button type="button" className="dai-btn dai-btn--ghost" onClick={onEdit}>
            ✎ Eingabe bearbeiten
          </button>
          <button type="button" className="dai-btn dai-btn--ghost" onClick={onDiscard}>
            Später speichern
          </button>
        </div>
      </div>
    </section>
  );
}
