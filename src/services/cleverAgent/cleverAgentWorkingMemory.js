/**
 * Minimaler Agent-Arbeitskontext für Folgeaufträge („das gleiche“, „doch ohne WP“).
 * Kein Full-Chat – nur strukturierte Entities.
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
    rememberedAt: null,
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
  const lastMessage = [...toolCalls].reverse().find((t) => t.name === 'create_message' || t.name === 'draft_customer_message');
  const lastRemember = [...toolCalls].reverse().find((t) => t.name === 'remember_customer_information');

  const offerArtifact = (agentResult.artifacts || []).find((a) => a.type === 'offer' || a.type === 'offer_prepare');
  const prepared = agentResult.previousOfferPreparation || base.previousOfferPreparation;

  let lastIntent = base.lastIntent;
  if (lastRemember) lastIntent = 'remember_customer_information';
  else if (lastWrite) lastIntent = lastWrite.name === 'modify_offer' ? 'modify_offer' : 'prepare_offer';
  else if (lastMessage) lastIntent = 'draft_customer_message';
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

  const pendingAction = agentResult.pendingAction
    || (agentResult.confirmationRequired
      ? {
        type: lastIntent || 'prepare_offer',
        status: 'needs_confirmation',
        mutations: agentResult.mutations || [],
        messageDraft: agentResult.mutations?.find((m) => m.type === 'set_message_draft')?.messageDraft || null,
      }
      : base.pendingAction);

  const recentEntities = [
    ...(resolvedVehicle ? [{ type: 'vehicle', value: resolvedVehicle }] : []),
    ...(offerArtifact ? [{ type: 'offer', value: offerArtifact }] : []),
  ].slice(0, 6);

  return {
    ...base,
    lastIntent,
    resolvedCustomer: agentResult.resolvedCustomer || base.resolvedCustomer,
    resolvedVehicle,
    currentOffer: agentResult.offerSummary || offerArtifact?.data?.offer || base.currentOffer,
    pendingAction,
    recentEntities: recentEntities.length ? recentEntities : base.recentEntities,
    lastRequestedChanges: extractRequestedChanges(sellerMessage) || base.lastRequestedChanges,
    previousOfferPreparation: prepared,
    rememberedAt: new Date().toISOString(),
    lastSellerMessage: String(sellerMessage || '').slice(0, 240),
  };
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
  if (/\b(weiss|weiß|white)\b/i.test(t)) changes.color = 'weiß';
  return Object.keys(changes).length ? changes : null;
}

/** Kompakter Prompt-Block für den Agent. */
export function formatWorkingMemoryForPrompt(memory = null) {
  if (!memory || typeof memory !== 'object') return null;
  return {
    lastIntent: memory.lastIntent,
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
  };
}
