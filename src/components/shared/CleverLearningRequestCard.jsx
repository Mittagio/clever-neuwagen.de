import { useState } from 'react';
import {
  createLearningRequest,
  findExistingLearningRequest,
} from '../../services/admin/cleverLearningRequestService.js';
import './CleverLearningRequestCard.css';

export default function CleverLearningRequestCard({
  query,
  modelKey = null,
  modelLabel = null,
  sourceArea,
  pageContext,
  detectedIntent = null,
  detectedFeatureId = null,
  dealerId = null,
  dealerName = null,
  userId = null,
  userName = null,
  leadId = null,
  customerId = null,
  className = '',
  onSubmitted,
}) {
  const [submitState, setSubmitState] = useState(() => {
    const existing = query
      ? findExistingLearningRequest({ query, modelKey, sourceArea })
      : null;
    return existing
      ? { done: true, duplicate: true, message: 'Zur Prüfung vorgemerkt' }
      : null;
  });

  function handleLearnClick() {
    if (submitState?.done) return;

    const result = createLearningRequest({
      query,
      modelKey,
      modelLabel,
      sourceArea,
      pageContext,
      detectedIntent,
      detectedFeatureId,
      dealerId,
      dealerName,
      userId,
      userName,
      leadId,
      customerId,
    });

    setSubmitState({
      done: true,
      duplicate: result.duplicate,
      message: result.duplicate
        ? 'Zur Prüfung vorgemerkt'
        : (result.message ?? 'Danke – Clever lernt daraus.'),
      feedback: result.message,
    });
    onSubmitted?.(result);
  }

  const isDone = Boolean(submitState?.done);

  return (
    <aside
      className={`clever-learn-card${className ? ` ${className}` : ''}`}
      aria-live="polite"
    >
      <p className="clever-learn-card__headline">Noch nicht sicher beantwortet</p>
      <p className="clever-learn-card__text">
        Clever hat dazu aktuell keine bestätigte Antwort.
      </p>
      <p className="clever-learn-card__hint">
        Wir prüfen die Anfrage und verbessern die Daten.
      </p>

      {!isDone ? (
        <button
          type="button"
          className="clever-learn-card__btn"
          onClick={handleLearnClick}
        >
          Clever soll das lernen
        </button>
      ) : (
        <p className="clever-learn-card__success" role="status">
          {submitState.feedback ?? submitState.message}
        </p>
      )}

      {isDone && (
        <span className="clever-learn-card__done-badge" aria-hidden="true">
          {submitState.message}
        </span>
      )}
    </aside>
  );
}
