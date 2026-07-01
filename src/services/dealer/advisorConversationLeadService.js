/**
 * Lead aus geführtem Beratungsgespräch (Frag Clever Multi-Turn).
 */
import {
  buildAdvisorConversationSummary,
  buildAdvisorKundenhelferChips,
  suggestAdvisorNextStep,
} from '../clever/customerAdvisorSession.js';

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
export function createLeadFromAdvisorConversation({
  contact,
  advisorSession,
  dealerConditions,
  intentType = 'contact',
  learningRequestId = null,
}) {
  const summary = buildAdvisorConversationSummary(advisorSession ?? {});
  const chips = buildAdvisorKundenhelferChips(advisorSession ?? {});
  const nextStep = suggestAdvisorNextStep(advisorSession ?? {});
  const focusModel = advisorSession?.currentContext?.modelsInFocus?.slice(-1)[0] ?? null;
  const modelLabel = focusModel
    ? `Kia ${focusModel.toUpperCase()}`
    : 'Fahrzeugberatung';

  const intentLabels = {
    contact: 'Beratungskontakt',
    offer: 'Angebotsanfrage',
    profile: 'Fahrprofil klären',
  };

  return {
    id: uid(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'neu',
    source: 'advisorConversation',
    sourceMode: 'advisor_conversation',
    advisorStatus: intentLabels[intentType] ?? 'Beratung angefragt',
    dealerId: dealerConditions?.dealerId ?? dealerConditions?.slug ?? 'autohaus-trinkle',
    contact: {
      name: contact?.name?.trim() ?? '',
      phone: contact?.phone?.trim() ?? '',
      email: contact?.email?.trim() ?? '',
    },
    vehicle: {
      brand: 'Kia',
      model: focusModel?.replace(/^kia-?/i, '') ?? 'Beratung',
      trim: '',
      label: modelLabel,
    },
    advisorConversationSummary: summary,
    customerQuestion: contact?.question ?? advisorSession?.messages?.filter((m) => m.role === 'user').slice(-1)[0]?.text ?? summary,
    advisorSessionId: advisorSession?.id ?? null,
    customerWish: {
      modelKey: focusModel,
      modelLabel,
      priorities: chips,
      summaryLines: chips,
      nextStepHint: nextStep,
    },
    specialCustomerQuestion: {
      rawText: contact?.question ?? summary,
      queryType: 'advisor_conversation',
      category: 'Beratungsgespräch',
      status: 'needs_dealer_check',
      learningRequestId,
    },
    crm: {
      nextStepId: 'continue_advisor_conversation',
      nextStepLabel: nextStep,
      kundenhelfer: {
        notes: chips.join(' · '),
        chips,
      },
    },
    inquiryBrief: {
      customerName: contact?.name?.trim() ?? '',
      recommended: {
        title: modelLabel,
        modelKey: focusModel,
      },
      customerWishSummary: summary,
    },
    notes: [
      `Kunde: ${contact?.name?.trim() ?? '—'}`,
      `Quelle: Frag Clever Beratungsgespräch`,
      `Zusammenfassung: ${summary}`,
      `Signale: ${chips.join(', ')}`,
      `Nächster Schritt: ${nextStep}`,
    ].join('\n'),
    history: [
      historyEntry('Anfrage über geführtes Beratungsgespräch'),
      historyEntry(summary, 'note'),
      historyEntry(`Kundenhelfer: ${chips.join(' · ')}`, 'note'),
      historyEntry(`Nächster Schritt: ${nextStep}`, 'note'),
    ],
  };
}
