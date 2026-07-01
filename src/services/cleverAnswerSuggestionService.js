/**
 * Clever Antworten – intelligente Situations-Empfehlung
 */
import { ANSWER_INTENTS } from './cleverAnswerIntentCatalog.js';

function uniqueIntents(ids = []) {
  return [...new Set(ids.filter(Boolean))];
}

function intentMeta(intentId) {
  return ANSWER_INTENTS.find((entry) => entry.id === intentId) ?? null;
}

/**
 * @returns {{ recommended: string[], defaultIntent: string }}
 */
export function suggestAnswerIntents(context = {}) {
  const recommended = [];

  if (context.openCustomerQuestions?.length) {
    recommended.push('answer_customer_question');
  }

  if (context.reactions?.offerOpened) {
    recommended.push('offer_opened_followup');
  } else if (context.reactions?.customerInterested) {
    recommended.push('offer_interested_followup');
  } else if (context.reactions?.openedCount > 0 || context.legacy?.offerSent) {
    recommended.push('offer_followup');
  }

  if (context.board?.primarySelectionGroup?.variantCount > 0) {
    recommended.push('offer_send', 'explain_selection');
  } else if (context.legacy?.vehicleTitle) {
    recommended.push('offer_send');
  }

  if (context.unterlagen?.openCount > 0) {
    recommended.push('request_documents');
  }

  const knowledge = [
    ...(context.kundenwissen?.facts ?? []).map((fact) => fact.text),
    ...(context.legacy?.kundenhelferChips ?? []),
  ].join(' ').toLowerCase();

  if (/probefahrt/i.test(knowledge)) {
    recommended.push('suggest_test_drive');
  }

  if (context.board?.hasCashAndLeasing) {
    recommended.push('compare_cash_leasing');
  }

  let picks = uniqueIntents(recommended).slice(0, 4);

  if (!picks.length) {
    picks = uniqueIntents([
      'free_dictation',
      'offer_callback',
      'thank_you',
      'short_followup',
    ]).slice(0, 3);
  }

  return {
    recommended: picks,
    defaultIntent: picks[0] ?? 'free_dictation',
  };
}

export function buildRecommendedIntentCards(context = {}, recommendedIds = []) {
  return recommendedIds
    .map((intentId) => intentMeta(intentId))
    .filter(Boolean)
    .map((intent) => ({
      ...intent,
      magic: intent.id === 'offer_send' && context.board?.primarySelectionGroup?.variantCount > 0,
    }));
}
