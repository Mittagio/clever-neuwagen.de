/**
 * Lead aus spezieller Kundenfrage + Kontaktwunsch.
 */
import {
  buildKundenhelferNotesForSpecialQuestion,
  extractSpecialQuestionTopic,
} from './specialCustomerQuestionService.js';

function uid(prefix = 'lead') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function historyEntry(text, type = 'system') {
  return {
    id: uid('hist'),
    at: new Date().toISOString(),
    type,
    text,
  };
}

/**
 * @param {object} params
 */
export function createLeadFromSpecialQuestion({
  contact,
  specialCustomerQuestion,
  customerWish = null,
  dealerConditions,
  learningRequestId = null,
}) {
  const modelLabel = specialCustomerQuestion?.modelLabel
    ?? customerWish?.modelLabel
    ?? 'Fahrzeug';
  const topic = extractSpecialQuestionTopic(specialCustomerQuestion?.rawText);
  const kundenhelferNotes = buildKundenhelferNotesForSpecialQuestion(specialCustomerQuestion);

  const vehicleModel = modelLabel.replace(/^Kia\s+/i, '');

  return {
    id: uid(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'neu',
    source: 'specialCustomerQuestion',
    advisorStatus: topic ? `Frage / ${topic} prüfen` : 'Frage / prüfen',
    dealerId: dealerConditions?.dealerId ?? dealerConditions?.slug ?? 'autohaus-trinkle',
    contact: {
      name: contact?.name?.trim() ?? '',
      phone: contact?.phone?.trim() ?? '',
      email: contact?.email?.trim() ?? '',
    },
    vehicle: {
      brand: 'Kia',
      model: vehicleModel,
      trim: '',
      label: modelLabel,
    },
    customerWish: customerWish ?? {
      modelKey: specialCustomerQuestion?.modelKey ?? null,
      modelLabel,
    },
    specialCustomerQuestion: {
      ...specialCustomerQuestion,
      learningRequestId: learningRequestId ?? specialCustomerQuestion?.learningRequestId ?? null,
    },
    crm: {
      nextStepId: 'answer_customer_question',
      nextStepLabel: 'Kundenfrage beantworten',
      kundenhelfer: {
        notes: kundenhelferNotes,
      },
    },
    inquiryBrief: {
      customerName: contact?.name?.trim() ?? '',
      recommended: {
        title: modelLabel,
        modelKey: specialCustomerQuestion?.modelKey ?? customerWish?.modelKey ?? null,
      },
      customerWishSummary: specialCustomerQuestion?.rawText ?? '',
    },
    notes: [
      `Kunde: ${contact?.name?.trim() ?? '—'}`,
      `Modell: ${modelLabel}`,
      `Spezielle Frage: ${specialCustomerQuestion?.rawText ?? ''}`,
      `Kategorie: ${specialCustomerQuestion?.category ?? 'Sonstiges'}`,
      `Status: ${topic ? `${topic} prüfen` : 'Frage prüfen'}`,
      'Nächster Schritt: Kundenfrage beantworten',
    ].join('\n'),
    history: [
      historyEntry('Anfrage über spezielle Kundenfrage'),
      historyEntry('Kunde wünscht Verkäuferkontakt zur Prüffrage'),
      historyEntry(`Frage: „${specialCustomerQuestion?.rawText ?? ''}"`, 'note'),
      historyEntry(kundenhelferNotes, 'note'),
    ],
  };
}
