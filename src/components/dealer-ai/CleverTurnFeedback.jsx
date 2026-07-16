import { useState } from 'react';
import { SELLER_FEEDBACK_CATEGORIES } from '../../services/clever/learning/sellerConversationFeedbackService.js';
import './CleverTurnFeedback.css';

const CATEGORY_OPTIONS = [
  { id: SELLER_FEEDBACK_CATEGORIES.GOOD, label: '👍 Passt' },
  { id: SELLER_FEEDBACK_CATEGORIES.WRONG_VEHICLE_FACT, label: 'Falsche Fahrzeuginformation' },
  { id: SELLER_FEEDBACK_CATEGORIES.UNNECESSARY_QUESTION, label: 'Unnötige Rückfrage' },
  { id: SELLER_FEEDBACK_CATEGORIES.MISSED_CUSTOMER_NEED, label: 'Kundenwunsch übersehen' },
  { id: SELLER_FEEDBACK_CATEGORIES.UNNATURAL_SELLER_LANGUAGE, label: 'Klingt nicht wie ein Verkäufer' },
];

/**
 * Verkäuferfeedback zu einer Clever-Antwort.
 */
export default function CleverTurnFeedback({
  conversationId = null,
  turnId = null,
  originalCustomerMessage = '',
  originalCleverReply = '',
  originalNextAction = null,
  customerUnderstandingSnapshot = null,
  evidenceIds = [],
  model = null,
  promptVersion = null,
}) {
  const [open, setOpen] = useState(false);
  const [correction, setCorrection] = useState('');
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(category) {
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch('/api/v1/clever/seller-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          turnId,
          category,
          sellerCorrection: correction.trim() || null,
          originalCustomerMessage,
          originalCleverReply,
          originalNextAction,
          customerUnderstandingSnapshot,
          evidenceIds,
          model,
          promptVersion,
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error ?? 'feedback_failed');
      setStatus('Gespeichert – wird geprüft, ändert nichts automatisch.');
      setOpen(false);
    } catch (err) {
      setStatus(err?.message ?? 'Speichern fehlgeschlagen');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="clever-turn-feedback">
      <button type="button" className="clever-turn-feedback__toggle" onClick={() => setOpen((v) => !v)}>
        Feedback zu dieser Antwort
      </button>
      {open && (
        <div className="clever-turn-feedback__panel">
          <div className="clever-turn-feedback__buttons">
            {CATEGORY_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                disabled={busy}
                onClick={() => submit(opt.id)}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <label className="clever-turn-feedback__label">
            So hätte ich geantwortet
            <textarea
              value={correction}
              onChange={(e) => setCorrection(e.target.value)}
              rows={3}
              placeholder="Optional – gewünschtes Verhalten für Review"
            />
          </label>
        </div>
      )}
      {status && <p className="clever-turn-feedback__status">{status}</p>}
    </div>
  );
}
