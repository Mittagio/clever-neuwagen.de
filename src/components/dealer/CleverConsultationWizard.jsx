import { useMemo } from 'react';
import {
  answerConsultationQuestion,
  getConsultationProgress,
  getNextConsultationQuestion,
  hasEnoughForRecommendation,
} from '../../services/dealer/cleverSalesAdvisor.js';
import './clever-consultation.css';

/**
 * Clever Beratung – genau eine Frage pro Schritt.
 */
export default function CleverConsultationWizard({
  profile,
  searchProfile = null,
  searchFilters = null,
  primaryModelKey = null,
  onProfileChange,
  onComplete,
}) {
  const ctx = useMemo(() => ({
    searchProfile,
    searchFilters,
    primaryModelKey,
    answers: profile?.answers,
  }), [searchProfile, searchFilters, primaryModelKey, profile?.answers]);

  const question = useMemo(
    () => getNextConsultationQuestion(profile, ctx),
    [profile, ctx],
  );

  const progress = useMemo(
    () => getConsultationProgress(profile, ctx),
    [profile, ctx],
  );

  const canFinish = hasEnoughForRecommendation(profile, { ...ctx, primaryModelKey });

  function handleAnswer(answerId) {
    if (!question) return;
    const next = answerConsultationQuestion(profile, question.id, answerId);
    onProfileChange?.(next);
    const nextCtx = { ...ctx, answers: next.answers };
    if (!getNextConsultationQuestion(next, nextCtx)
      || hasEnoughForRecommendation(next, { ...nextCtx, primaryModelKey })) {
      onComplete?.(next);
    }
  }

  function handleSkipToRecommendation() {
    if (!canFinish) return;
    onComplete?.(profile);
  }

  if (!question) {
    return (
      <section className="dl-clever-consult dl-clever-consult--done" aria-live="polite">
        <p className="dl-clever-consult__done">Clever hat genug Informationen – Empfehlung wird erstellt …</p>
      </section>
    );
  }

  return (
    <section className="dl-clever-consult" aria-labelledby="dl-clever-consult-title">
      <header className="dl-clever-consult__head">
        <p className="dl-clever-consult__eyebrow">🚀 Frag Clever</p>
        <div className="dl-clever-consult__progress" aria-hidden>
          <span
            className="dl-clever-consult__progress-bar"
            style={{ width: `${Math.max(8, progress.percent)}%` }}
          />
        </div>
        <p className="dl-clever-consult__step">
          Frage
          {' '}
          {progress.answered + 1}
        </p>
      </header>

      <h2 id="dl-clever-consult-title" className="dl-clever-consult__question">
        {question.prompt}
      </h2>
      {question.hint && (
        <p className="dl-clever-consult__hint">{question.hint}</p>
      )}

      <div className="dl-clever-consult__options" role="list">
        {question.options.map((option) => (
          <button
            key={option.id}
            type="button"
            className="dl-clever-consult__option"
            role="listitem"
            onClick={() => handleAnswer(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>

      {canFinish && (
        <button
          type="button"
          className="dl-clever-consult__skip"
          onClick={handleSkipToRecommendation}
        >
          Empfehlung jetzt anzeigen
        </button>
      )}
    </section>
  );
}
