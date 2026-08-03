/**
 * Seed-Text für Composer-Antworten (ersetzt CleverAntworten-Sheet).
 */

function shortVehicleLabel(label = '') {
  const raw = String(label ?? '').trim();
  if (!raw) return '';
  // „Kia XCeed · GT-Line“ → „XCeed“; „Kia XCeed“ → „XCeed“
  const primary = raw.split(/\s*[·|]\s*/)[0].trim();
  return primary.replace(/^kia\s+/i, '').trim() || primary;
}

/** Änderungswunsch aus Inbox-Message / Metadaten (ohne History-Prefix). */
export function extractChangeWishText(raw = '') {
  const text = String(raw ?? '').trim();
  if (!text) return '';
  const quoted = text.match(/[„"]([^"„”]+)[“"]/);
  if (quoted?.[1]) return quoted[1].trim();
  return text
    .replace(/^Kunde wünscht Änderung\s*\([^)]*\):\s*/i, '')
    .replace(/^[„"]|[“"]$/g, '')
    .trim();
}

/**
 * @param {string|null} intentId
 * @param {{ draft?: string|null, question?: string|null, vehicleLabel?: string|null }} [options]
 */
export function buildComposerReplySeed(intentId = null, options = {}) {
  const draft = String(options.draft ?? '').trim();
  if (draft) return draft;

  const question = String(options.question ?? '')
    .replace(/^[„"]|[“"]$/g, '')
    .trim();
  const vehicle = shortVehicleLabel(options.vehicleLabel);

  switch (intentId) {
    case 'nachfassen':
    case 'offer_opened_followup':
      return vehicle
        ? `Schreib ihm: Ich habe gesehen, Sie haben sich das ${vehicle}-Angebot angeschaut – `
        : 'Schreib ihm: Ich habe gesehen, Sie haben sich das Angebot angeschaut – ';
    case 'offer_interested_followup':
      return vehicle
        ? `Schreib ihm: Freut mich, dass das ${vehicle}-Angebot interessant ist – `
        : 'Schreib ihm: Freut mich, dass das Angebot interessant ist – ';
    case 'offer_change_request': {
      const wish = extractChangeWishText(question);
      const target = vehicle ? `${vehicle}-Angebot` : 'Angebot';
      return wish
        ? `Passe das ${target} an: ${wish.slice(0, 160)}`
        : `Passe das ${target} an – `;
    }
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
