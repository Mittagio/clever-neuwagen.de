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
    currentOfferDraft: null,
    currentOfferDraftId: null,
    currentMessageDraftId: null,
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
 * Offer-/Identity-Kontext aus Session-Memory (Follow-ups ohne frische Offer-Card).
 * @param {object|null} memory
 * @param {object|null} [previousOfferPreparation]
 * @returns {object|null}
 */
export function resolveCurrentOfferContextFromMemory(memory = null, previousOfferPreparation = null) {
  const prep = previousOfferPreparation || memory?.previousOfferPreparation || null;
  const offer = memory?.currentOffer || null;
  const vehicle = memory?.resolvedVehicle || null;
  const pending = memory?.pendingAction || null;
  const pendingOffer = pending?.type === 'prepare_offer' || pending?.type === 'modify_offer'
    ? pending
    : null;

  const vehicleTrackId = offer?.vehicleTrackId
    || prep?.vehicleTrackId
    || prep?.grounded?.vehicleTrackId
    || prep?.payload?.vehicleTrackId
    || pendingOffer?.payload?.vehicleTrackId
    || null;
  const modelKey = vehicle?.modelKey
    || offer?.modelKey
    || offer?.modelName
    || prep?.grounded?.modelKey
    || prep?.payload?.vehicle?.modelKey
    || pendingOffer?.payload?.vehicle?.modelKey
    || null;
  const offerId = offer?.offerId || offer?.id || prep?.offerId || null;

  if (!vehicleTrackId && !modelKey && !offerId && !prep && !pendingOffer) {
    return null;
  }

  return {
    offerId: offerId || (prep || pendingOffer ? 'session-offer' : null),
    title: offer?.title || prep?.title || 'Angebot',
    summary: offer?.summary
      || prep?.grounded?.summary
      || (modelKey ? `Kia ${String(modelKey).toUpperCase()}` : null),
    modelKey: modelKey ? String(modelKey).toLowerCase() : null,
    vehicleTrackId,
    monthlyRate: offer?.monthlyRate ?? prep?.payload?.monthlyRate ?? null,
    fromWorkingMemory: true,
  };
}

/**
 * Params für runCleverSellerTurn / Agent aus Shared Memory.
 * @param {object|null} memory
 */
export function hydrateWorkingMemoryFromLead(memory = null, lead = null) {
  let mem = memory || null;
  // Hydrate aus Lead-Persistenz (Reload)
  if (lead?.crm?.cleverWorkingState?.currentOfferDraftId && !mem?.currentOfferDraft?.offerDraftId) {
    const state = lead.crm.cleverWorkingState;
    const od = state.offerDrafts?.[state.currentOfferDraftId];
    if (od) {
      const identity = state.vehicleIdentityDrafts?.[od.vehicleIdentityDraftId] || null;
      mem = {
        ...(mem || createEmptyAgentWorkingMemory()),
        currentOfferDraftId: od.offerDraftId,
        currentOfferDraft: {
          ...od,
          vehicleIdentityDraft: identity,
        },
        pendingAction: mem?.pendingAction || { type: 'prepare_offer', status: 'prepared' },
        previousOfferPreparation: mem?.previousOfferPreparation || {
          offerDraftId: od.offerDraftId,
          vehicleIdentityDraft: identity,
          vehicle: identity
            ? {
              modelKey: identity.modelKey,
              model: identity.model?.canonical,
              trim: identity.trim?.canonical,
              color: identity.color?.raw,
            }
            : null,
        },
        currentOffer: {
          ...(mem?.currentOffer || {}),
          offerId: od.offerDraftId,
          offerDraftId: od.offerDraftId,
          modelKey: identity?.modelKey || od.focusModelKey,
          vehicleTrackId: od.vehicleTrackId,
        },
      };
    }
  }
  if (lead?.crm?.cleverWorkingState?.currentMessageDraftId && !mem?.lastMessageDraft?.messageDraftId) {
    const md = lead.crm.cleverWorkingState.messageDrafts?.[lead.crm.cleverWorkingState.currentMessageDraftId];
    if (md?.body) {
      mem = {
        ...(mem || createEmptyAgentWorkingMemory()),
        currentMessageDraftId: md.messageDraftId,
        lastMessageDraft: {
          messageDraftId: md.messageDraftId,
          body: md.body,
          at: md.updatedAt || new Date().toISOString(),
        },
      };
    }
  }
  return mem;
}

export function buildSellerTurnMemoryParams(memory = null, lead = null) {
  const mem = hydrateWorkingMemoryFromLead(memory, lead);
  return {
    conversationHistory: getConversationHistoryForAgent(mem),
    workingMemory: mem || null,
    previousOfferPreparation: mem?.previousOfferPreparation || null,
    currentOfferContextFromMemory: resolveCurrentOfferContextFromMemory(mem),
  };
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

  // Working Draft IDs aus Agent prepare/modify übernehmen (gleiche Continuity wie Deterministik)
  const prepPayload = agentResult.pendingAction?.payload
    || (agentResult.pendingAction?.offerDraftId ? agentResult.pendingAction : null)
    || lastWrite?.result?.payload
    || lastWrite?.output?.payload
    || agentResult.previousOfferPreparation
    || null;
  if (prepPayload?.offerDraftId) {
    next.currentOfferDraftId = prepPayload.offerDraftId;
    next.currentOfferDraft = {
      ...(next.currentOfferDraft || {}),
      offerDraftId: prepPayload.offerDraftId,
      customerId: prepPayload.customerId || next.currentOfferDraft?.customerId || null,
      vehicleTrackId: prepPayload.vehicleTrackId || next.currentOfferDraft?.vehicleTrackId || null,
      vehicleIdentityDraftId: prepPayload.vehicleIdentityDraftId
        || prepPayload.vehicleIdentityDraft?.id
        || next.currentOfferDraft?.vehicleIdentityDraftId
        || null,
      commercialScenarioId: prepPayload.commercialScenarioId
        || prepPayload.commercialScenario?.id
        || next.currentOfferDraft?.commercialScenarioId
        || null,
      status: prepPayload.status || 'draft',
      updatedAt: new Date().toISOString(),
      vehicleIdentityDraft: prepPayload.vehicleIdentityDraft
        || next.currentOfferDraft?.vehicleIdentityDraft
        || null,
      commercialScenario: prepPayload.commercialScenario
        || next.currentOfferDraft?.commercialScenario
        || null,
      rate: prepPayload.monthlyRate ?? prepPayload.rate ?? next.currentOfferDraft?.rate ?? null,
      invalidateVehicleRate: prepPayload.invalidateVehicleRate !== false,
      vehicleLabel: prepPayload.vehicleLabel || next.currentOfferDraft?.vehicleLabel || null,
      focusModelKey: prepPayload.focusModelKey
        || prepPayload.vehicle?.modelKey
        || next.currentOfferDraft?.focusModelKey
        || null,
      vehicle: prepPayload.vehicle || next.currentOfferDraft?.vehicle || null,
      lastChangedFields: prepPayload.lastChangedFields || [],
    };
    next.previousOfferPreparation = prepPayload;
  }

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

  const offerAction = (turn.preparedActions || []).find((a) => (
    a.type === 'prepare_offer' || a.type === 'modify_offer'
  ));
  if (offerAction?.payload || turn.pendingAction?.type === 'prepare_offer') {
    const prepPayload = turn.pendingAction?.payload
      || offerAction?.payload
      || turn.pendingAction
      || null;
    next.previousOfferPreparation = prepPayload || next.previousOfferPreparation;
    next.pendingAction = turn.pendingAction || {
      type: offerAction?.type || 'prepare_offer',
      status: offerAction?.status || 'prepared',
      payload: offerAction?.payload || null,
    };
    const vehicle = offerAction?.payload?.vehicle || prepPayload?.vehicle || null;
    if (prepPayload?.offerDraftId || vehicle || offerAction?.payload?.vehicleTrackId) {
      // Persistent Working Draft – IDs halten
      if (prepPayload?.offerDraftId) {
        next.currentOfferDraftId = prepPayload.offerDraftId;
        next.currentOfferDraft = {
          offerDraftId: prepPayload.offerDraftId,
          customerId: prepPayload.customerId || null,
          vehicleTrackId: prepPayload.vehicleTrackId || null,
          vehicleIdentityDraftId: prepPayload.vehicleIdentityDraftId
            || prepPayload.vehicleIdentityDraft?.id
            || null,
          commercialScenarioId: prepPayload.commercialScenarioId
            || prepPayload.commercialScenario?.id
            || null,
          status: prepPayload.status || 'draft',
          updatedAt: new Date().toISOString(),
          vehicleIdentityDraft: prepPayload.vehicleIdentityDraft || null,
          commercialScenario: prepPayload.commercialScenario || null,
          rate: prepPayload.monthlyRate ?? prepPayload.rate ?? null,
          invalidateVehicleRate: prepPayload.invalidateVehicleRate !== false,
          createNewAlternative: Boolean(prepPayload.createNewAlternative),
          vehicleLabel: prepPayload.vehicleLabel || null,
          focusModelKey: prepPayload.focusModelKey || vehicle?.modelKey || null,
          vehicle: vehicle || prepPayload.vehicle || null,
          lastChangedFields: prepPayload.lastChangedFields || [],
        };
      }
      next.resolvedVehicle = {
        make: vehicle?.make || 'Kia',
        model: vehicle?.model || vehicle?.modelKey || null,
        modelKey: vehicle?.modelKey || null,
        trim: vehicle?.trim
          || offerAction?.payload?.identityPatch?.trim
          || prepPayload?.vehicleIdentityDraft?.trim?.canonical
          || null,
        color: vehicle?.color
          || offerAction?.payload?.identityPatch?.color
          || prepPayload?.vehicleIdentityDraft?.color?.raw
          || null,
        vehicleTrackId: offerAction?.payload?.vehicleTrackId || null,
      };
      next.currentOffer = {
        ...(next.currentOffer || {}),
        offerId: prepPayload?.offerDraftId
          || offerAction?.payload?.offerId
          || next.currentOffer?.offerId
          || 'session-offer',
        offerDraftId: prepPayload?.offerDraftId || next.currentOfferDraftId || null,
        modelKey: vehicle?.modelKey || next.resolvedVehicle.modelKey,
        modelName: vehicle?.model || next.resolvedVehicle.model,
        vehicleTrackId: offerAction?.payload?.vehicleTrackId || null,
        monthlyRate: offerAction?.payload?.monthlyRate ?? next.currentOffer?.monthlyRate ?? null,
        title: offerAction?.label || next.currentOffer?.title || 'Angebot',
      };
    }
  }

  const draftAction = (turn.preparedActions || []).find((a) => a.type === 'draft_message');
  const draft = turn.messageDraft
    || draftAction?.payload?.messageDraft;
  if (draft) {
    const messageDraftId = draftAction?.payload?.messageDraftId
      || next.currentMessageDraftId
      || next.lastMessageDraft?.messageDraftId
      || `msg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const prevBody = next.lastMessageDraft?.body || null;
    const nextBody = String(draft).slice(0, 4000);
    if (prevBody && prevBody !== nextBody) {
      next.messageDraftHistory = [...(next.messageDraftHistory || []), next.lastMessageDraft].slice(-6);
    }
    next.currentMessageDraftId = messageDraftId;
    next.lastMessageDraft = {
      messageDraftId,
      body: nextBody,
      at: new Date().toISOString(),
      intendSend: Boolean(draftAction?.payload?.intendSend),
    };
    if (draftAction?.payload?.intendSend) {
      next.pendingAction = {
        type: 'intend_send',
        status: 'needs_confirmation',
        messageDraftId,
        messageDraft: nextBody,
        payload: draftAction.payload,
      };
    }
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
