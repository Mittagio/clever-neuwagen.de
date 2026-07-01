import { useEffect, useMemo, useState } from 'react';
import LeadDetailPanel from './LeadDetailPanel.jsx';
import { getCustomerOfferInteraction } from '../../services/customerOfferInteraction.js';
import { formatVehicleCardTitle } from '../../services/customerAkte.js';
import { buildLocalOfferQuestionAnswerSuggestion } from '../../services/dealer/customerOfferQuestionAnswerService.js';

export default function CustomerOfferQuestionAnswerSheet({
  open,
  onClose,
  lead,
  offerId,
  questionId,
  vehicleLabel = null,
  onSave,
  onMarkDoneOnly,
  saving = false,
}) {
  const interaction = useMemo(
    () => (offerId ? getCustomerOfferInteraction(lead, offerId) : null),
    [lead, offerId],
  );
  const question = useMemo(
    () => (interaction?.customerQuestions ?? []).find((q) => q.id === questionId) ?? null,
    [interaction, questionId],
  );

  const [answerText, setAnswerText] = useState(question?.answerText ?? '');
  const suggestion = useMemo(
    () => buildLocalOfferQuestionAnswerSuggestion(question?.text ?? ''),
    [question?.text],
  );

  useEffect(() => {
    if (open && question) {
      setAnswerText(question.answerText ?? '');
    }
  }, [open, question?.id, question?.answerText]);

  if (!question) return null;

  function handleUseSuggestion() {
    if (suggestion) setAnswerText(suggestion);
  }

  function handleSave() {
    if (!answerText.trim()) return;
    onSave?.({ answerText: answerText.trim() });
  }

  return (
    <LeadDetailPanel
      open={open}
      onClose={onClose}
      title="Kundenfrage beantworten"
      footer={(
        <>
          <button type="button" className="dai-btn dai-btn--ghost" onClick={onClose}>
            Abbrechen
          </button>
          {onMarkDoneOnly && question.status === 'open' && (
            <button
              type="button"
              className="dai-btn dai-btn--ghost"
              onClick={() => onMarkDoneOnly()}
              disabled={saving}
            >
              Nur als erledigt markieren
            </button>
          )}
          <button
            type="button"
            className="dai-btn dai-btn--primary"
            onClick={handleSave}
            disabled={saving || !answerText.trim()}
          >
            Antwort speichern
          </button>
        </>
      )}
    >
      <div className="cust-akte-special-q">
        {vehicleLabel && (
          <p className="cust-akte-special-q__meta">
            Angebot:
            {' '}
            <strong>{vehicleLabel}</strong>
          </p>
        )}

        <p className="cust-akte-special-q__label">Kundenfrage</p>
        <blockquote className="cust-akte-special-q__quote">
          „
          {question.text}
          “
        </blockquote>

        {suggestion && (
          <div className="cust-akte-special-q__hint">
            <button
              type="button"
              className="dai-btn dai-btn--ghost"
              onClick={handleUseSuggestion}
            >
              Antwortvorschlag übernehmen
            </button>
            <p>{suggestion}</p>
          </div>
        )}

        <label className="dai-lead-field" htmlFor="offer-q-answer">
          <span className="dai-lead-field__label">Antwort an den Kunden</span>
          <textarea
            id="offer-q-answer"
            className="dai-lead-field__input dai-lead-field__input--area"
            rows={4}
            value={answerText}
            onChange={(e) => setAnswerText(e.target.value)}
            placeholder="Antwort an den Kunden schreiben …"
          />
        </label>
      </div>
    </LeadDetailPanel>
  );
}

export function resolveOfferQuestionVehicleLabel(lead, offerId, vehicleCards = []) {
  const card = vehicleCards.find((c) => c.id === offerId);
  if (card) return formatVehicleCardTitle(card);
  const interaction = getCustomerOfferInteraction(lead, offerId);
  return interaction?.vehicleLabel ?? lead?.vehicle?.label ?? null;
}
