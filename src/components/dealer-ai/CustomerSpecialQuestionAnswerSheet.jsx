import { useState } from 'react';
import LeadDetailPanel from './LeadDetailPanel.jsx';

export default function CustomerSpecialQuestionAnswerSheet({
  open,
  onClose,
  lead,
  onSave,
  saving = false,
}) {
  const special = lead?.specialCustomerQuestion;
  const [answerText, setAnswerText] = useState(lead?.specialQuestionAnswer?.answerText ?? '');
  const [sourceNote, setSourceNote] = useState(lead?.specialQuestionAnswer?.sourceNote ?? '');
  const [learnForClever, setLearnForClever] = useState(true);

  if (!special?.rawText) return null;

  function handleSave() {
    if (!answerText.trim()) return;
    onSave?.({
      answerText: answerText.trim(),
      sourceNote: sourceNote.trim(),
      learnForClever,
    });
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
          <button
            type="button"
            className="dai-btn dai-btn--primary"
            onClick={handleSave}
            disabled={saving || !answerText.trim()}
          >
            Antwort speichern & Clever lernen lassen
          </button>
        </>
      )}
    >
      <div className="cust-akte-special-q">
        <p className="cust-akte-special-q__label">Kundenfrage</p>
        <blockquote className="cust-akte-special-q__quote">
          „
          {special.rawText}
          “
        </blockquote>

        {special.modelLabel && (
          <p className="cust-akte-special-q__meta">
            Modell:
            {' '}
            <strong>{special.modelLabel}</strong>
          </p>
        )}
        {special.category && (
          <p className="cust-akte-special-q__meta">
            Kategorie:
            {' '}
            <strong>{special.category}</strong>
          </p>
        )}

        <label className="dai-lead-field" htmlFor="special-q-answer">
          <span className="dai-lead-field__label">Antwort</span>
          <textarea
            id="special-q-answer"
            className="dai-lead-field__input dai-lead-field__input--area"
            rows={4}
            value={answerText}
            onChange={(e) => setAnswerText(e.target.value)}
            placeholder="Antwort für den Kunden formulieren …"
          />
        </label>

        <label className="dai-lead-field" htmlFor="special-q-source">
          <span className="dai-lead-field__label">Quelle / Hinweis (optional)</span>
          <input
            id="special-q-source"
            type="text"
            className="dai-lead-field__input"
            value={sourceNote}
            onChange={(e) => setSourceNote(e.target.value)}
            placeholder="z. B. Hersteller-Freigabe, Zubehörkatalog"
          />
        </label>

        <label className="cust-akte-special-q__check">
          <input
            type="checkbox"
            checked={learnForClever}
            onChange={(e) => setLearnForClever(e.target.checked)}
          />
          <span>Clever darf diese Antwort als Lernwissen speichern</span>
        </label>

        <p className="cust-akte-special-q__hint">
          Verkäuferantworten werden intern geprüft, bevor Clever sie anderen Kunden sicher anzeigt.
        </p>
      </div>
    </LeadDetailPanel>
  );
}
