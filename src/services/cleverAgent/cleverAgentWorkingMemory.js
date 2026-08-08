/**
 * Minimaler Agent-Arbeitskontext für Folgeaufträge („das gleiche“, „doch ohne WP“).
 * Clever 2.0: + Conversation Turns + last drafts (kein Full-Chat-Dump).
 */

export function createEmptyAgentWorkingMemory() {
  return {
    lastIntent: null,
    resolvedCustomer: null,
    resolvedVehicle: null,
    currentOffer: null,
    pendingAction: null,
    recentEntities: [],
    lastRequestedChanges: null,
    previousOfferPreparation: null,
    lastMessageDraft: null,
    /** Vorherige Draft-Versionen für Rewrite-Chain („kürzer“) */
    messageDraftHistory: [],
    lastCustomerSearchResults: [],
    lastAppointmentProposal: null,
    lastKnowledgeAnswer: null,
    conversationTurns: [],
    rememberedAt: null,
  };
}

const MAX_TURNS = 12;

/**
 * @param {object|null} prev
 * @param {{ role: 'user'|'assistant', text: string, kind?: string, refs?: object }} turn
 */
export function appendConversationTurn(prev = null, turn = {}) {
  const base = prev && typeof prev === 'object'
    ? { ...createEmptyAgentWorkingMemory(), ...prev }
    : createEmptyAgentWorkingMemory();
  const text = String(turn.text || '').trim();
  if (!text) return base;
  const entry = {
    role: turn.role === 'assistant' ? 'assistant' : 'user',
    text: text.slice(0, 2000),
    kind: turn.kind || null,
    at: new Date().toISOString(),
    refs: turn.refs || null,
  };
  const conversationTurns = [...(base.conversationTurns || []), entry].slice(-MAX_TURNS);
  return { ...base, conversationTurns, rememberedAt: entry.at };
}

/**
 * Für Agent API: [{ role, text }]
 * @param {object|null} memory
 */
export function getConversationHistoryForAgent(memory = null) {
  return (memory?.conversationTurns || [])
    .map((t) => ({
      role: t.role === 'assistant' ? 'assistant' : 'user',
      text: String(t.text || '').slice(0, 2000),
    }))
    .filter((t) => t.text);
}

/**
 * @param {object|null} prev
 * @param {object} agentResult
 * @param {string} sellerMessage
 */
export function updateAgentWorkingMemory(prev = null, agentResult = {}, sellerMessage = '') {
  const base = prev && typeof prev === 'object'
    ? { ...createEmptyAgentWorkingMemory(), ...prev }
    : createEmptyAgentWorkingMemory();

  const toolCalls = agentResult.toolCalls || [];
  const lastWrite = [...toolCalls].reverse().find((t) => (
    t.name === 'prepare_offer'
    || t.name === 'create_offer'
    || t.name === 'modify_offer'
  ));
  const lastMessage = [...toolCalls].reverse().find((t) => (
    t.name === 'create_message'
    || t.name === 'draft_customer_message'
    || t.name === 'rewrite_message'
    || t.name === 'intend_send'
  ));
  const lastRemember = [...toolCalls].reverse().find((t) => t.name === 'remember_customer_information');
  const lastCustomerTool = [...toolCalls].reverse().find((t) => (
    t.name === 'open_customer' || t.name === 'find_customer'
  ));
  const lastAppointment = [...toolCalls].reverse().find((t) => (
    t.name === 'propose_appointment' || t.name === 'modify_appointment'
  ));

  const offerArtifact = (agentResult.artifacts || []).find((a) => a.type === 'offer' || a.type === 'offer_prepare');
  const prepared = agentResult.previousOfferPreparation || base.previousOfferPreparation;

  let lastIntent = base.lastIntent;
  if (lastRemember) lastIntent = 'remember_customer_information';
  else if (lastWrite) lastIntent = lastWrite.name === 'modify_offer' ? 'modify_offer' : 'prepare_offer';
  else if (lastAppointment) lastIntent = lastAppointment.name;
  else if (lastMessage?.name === 'rewrite_message') lastIntent = 'rewrite_message';
  else if (lastMessage?.name === 'intend_send') lastIntent = 'intend_send';
  else if (lastMessage) lastIntent = 'draft_customer_message';
  else if (lastCustomerTool) lastIntent = lastCustomerTool.name;
  else if (toolCalls[0]?.name) lastIntent = toolCalls[0].name;

  const resolvedVehicle = agentResult.resolvedVehicle
    || offerArtifact?.data?.vehicle
    || (prepared?.grounded
      ? {
        make: 'Kia',
        model: prepared.grounded.model || prepared.grounded.modelKey,
        modelKey: prepared.grounded.modelKey,
        trim: prepared.grounded.trimLabel || prepared.grounded.trimId,
        color: prepared.grounded.colorLabel || prepared.intent?.vehicleRequest?.colorHint || null,
        equipment: prepared.resolvedEquipment || [],
      }
      : base.resolvedVehicle);

  const messageDraft = agentResult.messageDraft
    || agentResult.mutations?.find((m) => m.type === 'set_message_draft')?.messageDraft
    || lastMessage?.result?.messageDraft
    || lastMessage?.output?.messageDraft
    || null;

  let pendingAction = base.pendingAction;
  if (agentResult.pendingAction) {
    pendingAction = agentResult.pendingAction;
  } else if (agentResult.confirmationRequired) {
    pendingAction = {
      type: lastIntent || 'prepare_offer',
      status: 'needs_confirmation',
      mutations: agentResult.mutations || [],
      intendSend: Boolean(agentResult.intendSend || lastMessage?.name === 'intend_send'),
      messageDraft: messageDraft
        || agentResult.mutations?.find((m) => m.type === 'set_message_draft')?.messageDraft
        || null,
    };
  }

  const recentEntities = [
    ...(resolvedVehicle ? [{ type: 'vehicle', value: resolvedVehicle }] : []),
    ...(offerArtifact ? [{ type: 'offer', value: offerArtifact }] : []),
    ...(agentResult.resolvedCustomer
      ? [{
        type: 'customer',
        value: {
          id: agentResult.resolvedCustomer.id,
          name: agentResult.resolvedCustomer.name || agentResult.resolvedCustomer.contact?.name,
        },
      }]
      : []),
  ].slice(0, 6);

  let messageDraftHistory = Array.isArray(base.messageDraftHistory) ? [...base.messageDraftHistory] : [];
  let lastMessageDraft = base.lastMessageDraft;
  if (messageDraft) {
    const prevBody = base.lastMessageDraft?.body || null;
    const nextBody = String(messageDraft).slice(0, 4000);
    if (prevBody && prevBody !== nextBody) {
      messageDraftHistory = [...messageDraftHistory, base.lastMessageDraft].slice(-6);
    }
    lastMessageDraft = { body: nextBody, at: new Date().toISOString() };
  }

  const searchResults = Array.isArray(agentResult.customerSearchResults)
    ? agentResult.customerSearchResults
    : null;

  // Termin-Follow-ups („lieber Montag“) brauchen lastAppointmentProposal auch im Agent-Pfad
  const preparedAppointment = agentResult.preparedAppointment
    || lastAppointment?.result?.preparedAppointment
    || lastAppointment?.output?.preparedAppointment
    || pendingAction?.payload?.appointment
    || pendingAction?.payload?.preparedAppointment
    || null;

  const knowledgeRaw = agentResult.knowledgeAnswer || agentResult.knowledgeResult || null;
  const lastKnowledgeAnswer = knowledgeRaw
    ? {
      text: typeof knowledgeRaw === 'string'
        ? knowledgeRaw
        : (knowledgeRaw.answerText || knowledgeRaw.text || knowledgeRaw.lead || null),
      at: new Date().toISOString(),
      ...(typeof knowledgeRaw === 'object' && knowledgeRaw ? { raw: knowledgeRaw } : {}),
    }
    : base.lastKnowledgeAnswer;

  let next = {
    ...base,
    lastIntent,
    resolvedCustomer: agentResult.resolvedCustomer || base.resolvedCustomer,
    resolvedVehicle,
    currentOffer: agentResult.offerSummary || offerArtifact?.data?.offer || base.currentOffer,
    pendingAction,
    recentEntities: recentEntities.length ? recentEntities : base.recentEntities,
    lastRequestedChanges: extractRequestedChanges(sellerMessage) || base.lastRequestedChanges,
    previousOfferPreparation: prepared,
    lastMessageDraft,
    messageDraftHistory,
    lastCustomerSearchResults: searchResults?.length
      ? searchResults
      : base.lastCustomerSearchResults,
    lastAppointmentProposal: preparedAppointment || base.lastAppointmentProposal,
    lastKnowledgeAnswer,
    rememberedAt: new Date().toISOString(),
    lastSellerMessage: String(sellerMessage || '').slice(0, 240),
  };

  if (sellerMessage) {
    next = appendConversationTurn(next, { role: 'user', text: sellerMessage, kind: 'seller_input' });
  }
  if (agentResult.message) {
    next = appendConversationTurn(next, {
      role: 'assistant',
      text: agentResult.message,
      kind: agentResult.confirmationRequired
        ? 'prepared_action'
        : (lastMessage?.name === 'rewrite_message' ? 'compact_confirmation' : 'assistant'),
      refs: agentResult.resolvedCustomer
        ? { customerId: agentResult.resolvedCustomer.id }
        : null,
    });
  }

  return next;
}

/**
 * Nach deterministischem Seller-Turn Memory aktualisieren (Follow-ups auch ohne Agent).
 * @param {object|null} prev
 * @param {object} turn
 * @param {string} sellerMessage
 * @param {object} [policy]
 */
export function updateMemoryFromSellerTurn(prev = null, turn = {}, sellerMessage = '', policy = null) {
  let next = prev && typeof prev === 'object'
    ? { ...createEmptyAgentWorkingMemory(), ...prev }
    : createEmptyAgentWorkingMemory();

  const primary = turn.intents?.[0]?.type || turn.intent || null;
  if (primary) next.lastIntent = primary;

  const offerAction = (turn.preparedActions || []).find((a) => a.type === 'prepare_offer');
  if (offerAction?.payload || turn.pendingAction?.type === 'prepare_offer') {
    next.previousOfferPreparation = turn.pendingAction || offerAction?.payload || next.previousOfferPreparation;
    next.pendingAction = turn.pendingAction || {
      type: 'prepare_offer',
      status: offerAction?.status || 'prepared',
    };
  }

  const draft = turn.messageDraft
    || (turn.preparedActions || []).find((a) => a.type === 'draft_message')?.payload?.messageDraft;
  if (draft) {
    next.lastMessageDraft = { body: String(draft).slice(0, 4000), at: new Date().toISOString() };
  }

  const appt = turn.preparedAppointment
    || (turn.preparedActions || []).find((a) => a.type === 'propose_appointment')
      ?.payload?.preparedAppointment;
  if (appt) {
    next.lastAppointmentProposal = appt;
    next.pendingAction = turn.pendingAction || { type: 'propose_appointment', status: 'prepared' };
  }

  if (turn.knowledgeResult) {
    next.lastKnowledgeAnswer = {
      text: turn.knowledgeResult.answerText || turn.knowledgeResult.text || turn.knowledgeResult.lead,
      at: new Date().toISOString(),
    };
  }

  if (turn.resolvedCustomer) {
    next.resolvedCustomer = turn.resolvedCustomer;
  }

  next.lastRequestedChanges = extractRequestedChanges(sellerMessage) || next.lastRequestedChanges;

  if (sellerMessage) {
    next = appendConversationTurn(next, { role: 'user', text: sellerMessage, kind: 'seller_input' });
  }
  const reply = policy?.message || turn.assistantReply;
  if (reply) {
    next = appendConversationTurn(next, {
      role: 'assistant',
      text: reply,
      kind: policy?.kind || 'assistant',
    });
  }

  next.rememberedAt = new Date().toISOString();
  next.lastSellerMessage = String(sellerMessage || '').slice(0, 240);
  return next;
}

function extractRequestedChanges(text = '') {
  const t = String(text || '').toLowerCase();
  const changes = {};
  const km = t.match(/(\d{1,3}(?:[.\s]\d{3})*)\s*(?:km|kilometer)/i);
  if (km) {
    changes.mileagePerYear = Number(String(km[1]).replace(/\./g, '').replace(/\s/g, ''));
  }
  const term = t.match(/(\d{2})\s*monate?/i);
  if (term) changes.durationMonths = Number(term[1]);
  if (/ohne\s*wp|ohne\s*w(?:ä|ae)rmepumpe/i.test(t)) changes.removeEquipment = ['heat_pump'];
  if (/\b(weiss|weiß|white|rot|blau|schwarz|grau)\b/i.test(t)) {
    const color = t.match(/\b(weiss|weiß|white|rot|blau|schwarz|grau)\b/i)?.[1];
    if (color) changes.color = color;
  }
  return Object.keys(changes).length ? changes : null;
}

/** Kompakter Prompt-Block für den Agent. */
export function formatWorkingMemoryForPrompt(memory = null) {
  if (!memory || typeof memory !== 'object') return null;
  return {
    lastIntent: memory.lastIntent,
    resolvedCustomer: memory.resolvedCustomer
      ? { id: memory.resolvedCustomer.id, name: memory.resolvedCustomer.name }
      : null,
    resolvedVehicle: memory.resolvedVehicle,
    currentOffer: memory.currentOffer
      ? {
        offerId: memory.currentOffer.offerId || memory.currentOffer.id,
        modelName: memory.currentOffer.modelName,
        termMonths: memory.currentOffer.termMonths,
        mileagePerYear: memory.currentOffer.mileagePerYear,
        monthlyRate: memory.currentOffer.monthlyRate,
        paymentType: memory.currentOffer.paymentType,
      }
      : null,
    pendingAction: memory.pendingAction
      ? { type: memory.pendingAction.type, status: memory.pendingAction.status }
      : null,
    lastRequestedChanges: memory.lastRequestedChanges,
    lastMessageDraft: memory.lastMessageDraft
      ? { preview: String(memory.lastMessageDraft.body || '').slice(0, 280) }
      : null,
    messageDraftHistoryCount: Array.isArray(memory.messageDraftHistory)
      ? memory.messageDraftHistory.length
      : 0,
    lastAppointmentProposal: memory.lastAppointmentProposal
      ? {
        when: memory.lastAppointmentProposal.whenLabel
          || memory.lastAppointmentProposal.startsAt
          || memory.lastAppointmentProposal.startAt
          || null,
      }
      : null,
    lastKnowledgeAnswer: memory.lastKnowledgeAnswer?.text
      ? { preview: String(memory.lastKnowledgeAnswer.text).slice(0, 200) }
      : null,
    lastMessageDraftFollowUpReady: Boolean(memory.lastMessageDraft?.body),
  };
}
