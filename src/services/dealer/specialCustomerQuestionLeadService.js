/**
 * Lead aus spezieller Kundenfrage + Kontaktwunsch.
 */
import {
  buildOperationalSpecialQuestionHistoryNote,
  collectSellerInsightTextsFromSpecialQuestion,
  extractSpecialQuestionTopic,
} from './specialCustomerQuestionService.js';
import { appendSellerInsightsFromTexts } from './sellerInsights.js';

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
  const isAdvice = specialCustomerQuestion?.queryType === 'advice_question';
  const topic = extractSpecialQuestionTopic(specialCustomerQuestion?.rawText);
  const operationalNote = buildOperationalSpecialQuestionHistoryNote(specialCustomerQuestion);
  const insightTexts = collectSellerInsightTextsFromSpecialQuestion(specialCustomerQuestion);
  const sellerInsights = insightTexts.length
    ? appendSellerInsightsFromTexts({ crm: {} }, insightTexts).crm.sellerInsights
    : [];

  const vehicleModel = modelLabel.replace(/^Kia\s+/i, '');

  return {
    id: uid(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'neu',
    source: isAdvice ? 'adviceQuestion' : 'specialCustomerQuestion',
    advisorStatus: isAdvice
      ? 'Beratungsfrage beantworten'
      : (topic ? `Frage / ${topic} prüfen` : 'Frage / prüfen'),
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
      nextStepId: isAdvice ? 'answer_advice_question' : 'answer_customer_question',
      nextStepLabel: isAdvice ? 'Beratungsfrage beantworten' : 'Kundenfrage beantworten',
      ...(sellerInsights.length ? { sellerInsights } : {}),
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
      `Status: ${isAdvice ? 'Beratungsfrage' : (topic ? `${topic} prüfen` : 'Frage prüfen')}`,
      `Nächster Schritt: ${isAdvice ? 'Beratungsfrage beantworten' : 'Kundenfrage beantworten'}`,
    ].join('\n'),
    history: [
      historyEntry('Anfrage über spezielle Kundenfrage'),
      historyEntry('Kunde wünscht Verkäuferkontakt zur Prüffrage'),
      historyEntry(`Frage: „${specialCustomerQuestion?.rawText ?? ''}"`, 'note'),
      historyEntry(operationalNote, 'note'),
    ],
  };
}
