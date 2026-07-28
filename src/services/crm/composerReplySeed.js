/**
 * Seed-Text für Composer-Antworten (ersetzt CleverAntworten-Sheet).
 */

/**
 * @param {string|null} intentId
 * @param {{ draft?: string|null, question?: string|null }} [options]
 */
export function buildComposerReplySeed(intentId = null, options = {}) {
  const draft = String(options.draft ?? '').trim();
  if (draft) return draft;

  const question = String(options.question ?? '')
    .replace(/^[„"]|[“"]$/g, '')
    .trim();

  switch (intentId) {
    case 'nachfassen':
    case 'offer_opened_followup':
      return 'Schreib ihm: Ich habe gesehen, Sie haben sich das Angebot angeschaut – ';
    case 'offer_interested_followup':
      return 'Schreib ihm: Freut mich, dass das Angebot interessant ist – ';
    case 'delivery':
    case 'delivery_handover':
      return 'Schreib ihm zur Übergabe: ';
    case 'answer_stock_vehicle_request':
      return 'Schreib ihm zum Bestandsfahrzeug: ';
    case 'offer_callback':
      return 'Schreib ihm: Ich rufe Sie gerne zurück – ';
    case 'suggest_alternative':
      return 'Schreib ihm eine Alternative: ';
    case 'documents_received_confirm':
      return 'Schreib ihm: Ihre Unterlagen sind angekommen – ';
    case 'answer_customer_question':
      return question
        ? `Schreib ihm zur Frage „${question.slice(0, 140)}“: `
        : 'Schreib ihm: ';
    case 'frei':
    case 'free_reply':
    default:
      return question
        ? `Schreib ihm zur Frage „${question.slice(0, 140)}“: `
        : 'Schreib ihm: ';
  }
}
