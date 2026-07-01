/**
 * Clever Antworten – Verkäufer-Situationen (answerIntent / textTemplateIntent)
 */

export const ANSWER_INTENT_GROUPS = [
  { id: 'angebot', label: 'Angebot' },
  { id: 'kundenfrage', label: 'Kundenfrage' },
  { id: 'kontakt', label: 'Kontakt' },
  { id: 'unterlagen', label: 'Unterlagen' },
  { id: 'frei', label: 'Frei' },
];

/** @type {Array<{ id: string, label: string, groupId: string, generatorId: string, shortLabel?: string }>} */
export const ANSWER_INTENTS = [
  { id: 'offer_send', label: 'Angebot senden', groupId: 'angebot', generatorId: 'angebot_senden' },
  { id: 'offer_followup', label: 'Angebot nachfassen', groupId: 'angebot', generatorId: 'nachfassen' },
  { id: 'offer_opened_followup', label: 'Kunde hat Angebot geöffnet', groupId: 'angebot', generatorId: 'offer_opened_followup' },
  { id: 'offer_interested_followup', label: 'Kunde interessiert sich', groupId: 'angebot', generatorId: 'offer_interested_followup' },
  { id: 'no_response_followup', label: 'Kunde hat nicht reagiert', groupId: 'angebot', generatorId: 'no_response_followup' },
  { id: 'explain_selection', label: 'Auswahl erklären', groupId: 'angebot', generatorId: 'auswahl_erklaeren' },
  { id: 'compare_cash_leasing', label: 'Bar / Leasing vergleichen', groupId: 'angebot', generatorId: 'bar_leasing_vergleichen' },
  { id: 'explain_rate', label: 'Preis / Rate erklären', groupId: 'angebot', generatorId: 'explain_rate' },
  { id: 'explain_cash_offer', label: 'Barangebot erklären', groupId: 'angebot', generatorId: 'explain_cash_offer' },
  { id: 'explain_leasing', label: 'Leasing erklären', groupId: 'angebot', generatorId: 'explain_leasing' },
  { id: 'explain_financing', label: 'Finanzierung erklären', groupId: 'angebot', generatorId: 'explain_financing' },
  { id: 'suggest_alternative', label: 'Alternative anbieten', groupId: 'angebot', generatorId: 'suggest_alternative' },
  { id: 'soft_close', label: 'Abschluss freundlich vorbereiten', groupId: 'angebot', generatorId: 'soft_close' },

  { id: 'answer_customer_question', label: 'Kundenfrage beantworten', groupId: 'kundenfrage', generatorId: 'kundenfrage' },
  { id: 'ask_followup_question', label: 'Rückfrage stellen', groupId: 'kundenfrage', generatorId: 'rueckfrage' },
  { id: 'clarify_technical_question', label: 'Technische Frage klären', groupId: 'kundenfrage', generatorId: 'technical_question' },

  { id: 'short_followup', label: 'Kurz nachfassen', groupId: 'kontakt', generatorId: 'short_followup' },
  { id: 'suggest_appointment', label: 'Termin vorschlagen', groupId: 'kontakt', generatorId: 'suggest_appointment' },
  { id: 'confirm_appointment', label: 'Termin bestätigen', groupId: 'kontakt', generatorId: 'confirm_appointment' },
  { id: 'offer_callback', label: 'Rückruf anbieten', groupId: 'kontakt', generatorId: 'offer_callback' },
  { id: 'suggest_test_drive', label: 'Probefahrt vorschlagen', groupId: 'kontakt', generatorId: 'probefahrt' },
  { id: 'thank_you', label: 'Danke schreiben', groupId: 'kontakt', generatorId: 'thank_you', shortLabel: 'Danke für die Rückmeldung' },

  { id: 'request_documents', label: 'Unterlagen anfordern', groupId: 'unterlagen', generatorId: 'unterlagen' },
  { id: 'missing_documents_reminder', label: 'Unterlagen fehlen noch', groupId: 'unterlagen', generatorId: 'missing_documents_reminder' },
  { id: 'documents_received_confirm', label: 'Unterlagen erhalten bestätigen', groupId: 'unterlagen', generatorId: 'documents_received_confirm' },
  { id: 'pickup_registration_explain', label: 'Zulassung / Abholung erklären', groupId: 'unterlagen', generatorId: 'pickup_registration_explain' },

  { id: 'free_dictation', label: 'Freier Text / Diktat', groupId: 'frei', generatorId: 'frei' },
];

const LEGACY_TYPE_TO_INTENT = {
  angebot_senden: 'offer_send',
  nachfassen: 'offer_followup',
  kundenfrage: 'answer_customer_question',
  auswahl_erklaeren: 'explain_selection',
  bar_leasing_vergleichen: 'compare_cash_leasing',
  unterlagen: 'request_documents',
  probefahrt: 'suggest_test_drive',
  frei: 'free_dictation',
  delivery: 'offer_send',
  angebot_angepasst: 'offer_send',
  danke: 'thank_you',
  rueckfrage: 'ask_followup_question',
  termin: 'suggest_appointment',
  nicht_erreicht: 'no_response_followup',
};

export function resolveAnswerIntent(initialTypeOrIntent = null) {
  if (!initialTypeOrIntent) return null;
  if (ANSWER_INTENTS.some((entry) => entry.id === initialTypeOrIntent)) {
    return initialTypeOrIntent;
  }
  return LEGACY_TYPE_TO_INTENT[initialTypeOrIntent] ?? null;
}

export function getAnswerIntent(intentId = '') {
  return ANSWER_INTENTS.find((entry) => entry.id === intentId) ?? null;
}

export function getAnswerIntentLabel(intentId = '') {
  return getAnswerIntent(intentId)?.label ?? 'Antwort';
}

export function resolveIntentGenerator(intentId = '') {
  return getAnswerIntent(intentId)?.generatorId ?? 'angebot_senden';
}

export function getIntentsForGroup(groupId = '') {
  return ANSWER_INTENTS.filter((entry) => entry.groupId === groupId);
}

export function isUnterlagenIntent(intentId = '') {
  const intent = getAnswerIntent(intentId);
  return intent?.groupId === 'unterlagen';
}
