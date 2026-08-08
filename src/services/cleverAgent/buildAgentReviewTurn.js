/**
 * Mappt Agent-Ergebnisse mit confirmationRequired auf ein Turn-Shape
 * für buildUniversalReviewModel / SellerUniversalReviewCard.
 */
import { SELLER_TURN_INTENTS } from '../cleverSeller/sellerFactTypes.js';

const PENDING_TO_PREPARED = {
  prepare_offer: SELLER_TURN_INTENTS.PREPARE_OFFER,
  modify_offer: SELLER_TURN_INTENTS.PREPARE_OFFER,
  propose_appointment: SELLER_TURN_INTENTS.PROPOSE_APPOINTMENT,
  modify_appointment: SELLER_TURN_INTENTS.PROPOSE_APPOINTMENT,
  create_follow_up: SELLER_TURN_INTENTS.PROPOSE_APPOINTMENT,
  import_customer_contract: SELLER_TURN_INTENTS.IMPORT_CUSTOMER_CONTRACT,
  import_contract: SELLER_TURN_INTENTS.IMPORT_CUSTOMER_CONTRACT,
  compare_contract_offer: SELLER_TURN_INTENTS.COMPARE_CONTRACT_WITH_OFFER,
  compare_contract_with_offer: SELLER_TURN_INTENTS.COMPARE_CONTRACT_WITH_OFFER,
  prepare_trade_in: SELLER_TURN_INTENTS.PREPARE_TRADE_IN,
  create_message: SELLER_TURN_INTENTS.DRAFT_MESSAGE,
  rewrite_message: SELLER_TURN_INTENTS.DRAFT_MESSAGE,
  intend_send: SELLER_TURN_INTENTS.DRAFT_MESSAGE,
  import_offer_pdf: SELLER_TURN_INTENTS.PREPARE_OFFER,
};

/**
 * @param {object} agentResult
 * @returns {object|null} Turn-ähnlich für Universal Review, oder null wenn kein Review nötig
 */
export function buildAgentReviewTurn(agentResult = {}) {
  if (!agentResult?.confirmationRequired && agentResult?.pendingAction?.status !== 'needs_confirmation') {
    return null;
  }

  const pending = agentResult.pendingAction || {};
  const pendingType = String(pending.type || '').trim();
  const preparedType = PENDING_TO_PREPARED[pendingType] || pendingType || 'prepared_action';
  const payload = (pending.payload || pending.offerDraft)
    ? {
      ...(pending.payload || {}),
      ...(pending.offerDraft ? { offerDraft: pending.offerDraft } : {}),
      ...(pending.preparation ? { preparation: pending.preparation } : {}),
    }
    : (agentResult.offerSummary ? { offer: agentResult.offerSummary } : {});

  const messageDraft = extractMessageDraft(agentResult);
  const preparedAppointment = extractAppointment(agentResult, pending);
  const contractDraft = pending.payload?.contractDraft || agentResult.contractDraft || null;
  const contractOfferCompareResult = pending.payload?.contractOfferCompareResult
    || agentResult.contractOfferCompareResult
    || null;

  const preparedActions = [{
    id: `agent_${preparedType}`,
    type: preparedType,
    label: reviewLabel(preparedType),
    needsSellerConfirmation: true,
    status: 'prepared',
    payload: {
      ...payload,
      fromAgent: true,
      offerSummary: agentResult.offerSummary || payload.offer || null,
      intendSend: Boolean(agentResult.intendSend || pending.intendSend),
      messageDraft: messageDraft || undefined,
    },
  }];

  const extractedFacts = Array.isArray(agentResult.extractedFacts) && agentResult.extractedFacts.length
    ? agentResult.extractedFacts
    : (Array.isArray(payload.facts) ? payload.facts : []);

  return {
    ok: true,
    assistantReply: String(agentResult.message || 'Bitte prüfen und freigeben.').trim(),
    extractedFacts,
    preparedActions,
    pendingAction: {
      ...pending,
      type: pendingType || preparedType,
      status: 'needs_confirmation',
    },
    messageDraft: messageDraft || null,
    preparedAppointment: preparedAppointment || null,
    contractDraft,
    contractOfferCompareResult,
    offerSummary: agentResult.offerSummary || null,
    agentSource: agentResult.agentSource || 'openai',
    fromCleverAgent: true,
    confirmationRequired: true,
  };
}

function extractMessageDraft(agentResult = {}) {
  if (agentResult.messageDraft) return String(agentResult.messageDraft);
  const mut = (agentResult.mutations || []).find((m) => m.type === 'set_message_draft');
  if (mut?.messageDraft) return String(mut.messageDraft);
  const art = (agentResult.artifacts || []).find((a) => a.type === 'message_draft');
  if (art?.data?.body) return String(art.data.body);
  return null;
}

function extractAppointment(agentResult = {}, pending = {}) {
  return pending.payload?.appointment
    || pending.appointment
    || agentResult.preparedAppointment
    || agentResult.appointment
    || null;
}

function reviewLabel(type) {
  switch (type) {
    case SELLER_TURN_INTENTS.PREPARE_OFFER: return 'Angebot prüfen';
    case SELLER_TURN_INTENTS.PROPOSE_APPOINTMENT: return 'Termin prüfen';
    case SELLER_TURN_INTENTS.IMPORT_CUSTOMER_CONTRACT: return 'Vertrag prüfen';
    case SELLER_TURN_INTENTS.COMPARE_CONTRACT_WITH_OFFER: return 'Vergleich prüfen';
    case SELLER_TURN_INTENTS.PREPARE_TRADE_IN: return 'Inzahlungnahme prüfen';
    case SELLER_TURN_INTENTS.DRAFT_MESSAGE: return 'Nachricht prüfen';
    default: return 'Aktion prüfen';
  }
}
