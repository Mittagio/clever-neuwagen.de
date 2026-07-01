/**
 * Kundenfrage zu Angebotslink beantworten – Lead-Patch + History
 */
import {
  answerCustomerQuestion,
  getCustomerOfferInteraction,
  mergeCustomerOfferInteractionPatch,
} from '../customerOfferInteraction.js';

/**
 * @param {object} params
 */
export function applyCustomerOfferQuestionAnswer({
  lead,
  offerId,
  questionId,
  answerText,
  answeredBy = null,
} = {}) {
  if (!lead?.id || !offerId || !questionId) {
    return { ok: false, error: 'missing_params' };
  }

  const trimmed = String(answerText ?? '').trim();
  if (!trimmed) {
    return { ok: false, error: 'answer_required' };
  }

  const interaction = getCustomerOfferInteraction(lead, offerId);
  if (!interaction) {
    return { ok: false, error: 'interaction_not_found' };
  }

  const question = (interaction.customerQuestions ?? []).find((q) => q.id === questionId);
  if (!question) {
    return { ok: false, error: 'question_not_found' };
  }

  const answeredInteraction = answerCustomerQuestion(interaction, questionId, {
    answerText: trimmed,
    answeredBy,
  });

  const customerOfferInteractions = mergeCustomerOfferInteractionPatch(
    lead,
    offerId,
    answeredInteraction,
  );

  return {
    ok: true,
    question,
    leadPatch: {
      crm: {
        ...(lead.crm ?? {}),
        customerOfferInteractions,
      },
    },
    historyText: `Kundenfrage beantwortet: „${question.text}“\nAntwort: „${trimmed}“`,
  };
}

/**
 * Einfacher lokaler Antwortvorschlag ohne OpenAI.
 * @param {string} questionText
 */
export function buildLocalOfferQuestionAnswerSuggestion(questionText = '') {
  const q = String(questionText).toLowerCase();
  if (/winterreifen|winter.?reifen/.test(q)) {
    return 'Winterreifen sind im aktuellen Angebot noch nicht enthalten. Ich kann diese gerne separat mit anbieten.';
  }
  if (/lieferzeit|wann.*(da|kommt|geliefert)/.test(q)) {
    return 'Zur Lieferzeit prüfe ich den aktuellen Bestand und melde mich mit einem verbindlichen Termin.';
  }
  if (/farbe|lack/.test(q)) {
    return 'Zur Wunschfarbe schaue ich in die Verfügbarkeit und melde mich mit passenden Optionen.';
  }
  return '';
}
