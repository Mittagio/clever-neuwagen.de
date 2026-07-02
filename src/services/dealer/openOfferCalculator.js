/**
 * Einheitlicher Einstieg zum Angebotskalkulator (DealerAiConditionsStep /verkaufsassistent).
 */
import { buildKundenaktePath } from '../leadAkteEntry.js';
import { buildAddProposalNavigateContext } from './customerAddProposalFlow.js';
import {
  enrichOfferEditCardFromLead,
  resolveEffectivePaymentType,
} from './offerEditWishMerge.js';
import {
  BOARD_OFFER_STATUS,
  resolveBoardOfferStatus,
} from './boardOfferModel.js';

export const OFFER_ENTRY_TARGET = {
  CALCULATOR: 'calculator',
  PROPOSAL: 'proposal',
  ANSWER_QUESTION: 'answer_question',
};

/**
 * Zielansicht für einen Angebots-Einstieg.
 */
export function resolveOfferEntryTarget(card = {}, lead = null) {
  const status = resolveBoardOfferStatus(card, lead);
  if (status === BOARD_OFFER_STATUS.QUESTION_OPEN) {
    return OFFER_ENTRY_TARGET.ANSWER_QUESTION;
  }
  if (
    status === BOARD_OFFER_STATUS.OFFER_SENT
    || status === BOARD_OFFER_STATUS.INTERESTED
    || status === BOARD_OFFER_STATUS.DECLINED
  ) {
    return OFFER_ENTRY_TARGET.PROPOSAL;
  }
  return OFFER_ENTRY_TARGET.CALCULATOR;
}

export function shouldOpenOfferProposalView(card = {}, lead = null) {
  return resolveOfferEntryTarget(card, lead) === OFFER_ENTRY_TARGET.PROPOSAL;
}

export function shouldOpenOfferCalculator(card = {}, lead = null) {
  return resolveOfferEntryTarget(card, lead) === OFFER_ENTRY_TARGET.CALCULATOR;
}

/**
 * Navigation-State für /verkaufsassistent.
 */
export function buildOfferCalculatorNavigateState(lead, card = null, options = {}) {
  if (!lead?.id) return null;

  const enriched = card ? enrichOfferEditCardFromLead(card, lead) : null;
  const vehicleCardId = options.vehicleCardId
    ?? options.configurationId
    ?? options.offerId
    ?? enriched?.configurationId
    ?? enriched?.id
    ?? null;

  const returnPath = options.returnPath ?? buildKundenaktePath(lead.id);
  const paymentType = resolveEffectivePaymentType(
    options.paymentType,
    enriched?.paymentType,
    lead.paymentType,
  );

  const addVehicleContext = buildAddProposalNavigateContext(lead, {
    returnPath,
    proposalIntent: options.proposalIntent ?? 'vehicle',
    paymentType: paymentType !== 'unknown' ? paymentType : null,
    openConditions: true,
    focusModelKey: options.focusModelKey ?? enriched?.modelKey ?? card?.modelKey ?? null,
    vehicleCardId,
  });

  addVehicleContext.openConditions = true;
  addVehicleContext.openCalculator = true;
  if (vehicleCardId) {
    addVehicleContext.vehicleCardId = vehicleCardId;
  }
  const focusModelKey = options.focusModelKey ?? enriched?.modelKey ?? card?.modelKey ?? null;
  if (focusModelKey) {
    addVehicleContext.focusModelKey = focusModelKey;
  }
  if (options.fromProposal) {
    addVehicleContext.fromProposal = true;
  }

  return { addVehicleContext };
}

/** Bearbeitung im Angebotskalkulator (nicht nur Vorschau). */
export function canEditOfferInCalculator(card = {}, lead = null) {
  return resolveOfferEntryTarget(card, lead) !== OFFER_ENTRY_TARGET.ANSWER_QUESTION;
}

/**
 * Zentraler Einstieg: immer zum Angebotskalkulator navigieren.
 */
export function openOfferCalculator(navigate, lead, card = null, options = {}) {
  const state = buildOfferCalculatorNavigateState(lead, card, options);
  if (!state || !navigate) return false;
  navigate('/verkaufsassistent', { state });
  return true;
}

/**
 * @deprecated Alias – bitte openOfferCalculator nutzen.
 */
export function buildOpenOfferCalculatorContext(lead, card, options) {
  return buildOfferCalculatorNavigateState(lead, card, options)?.addVehicleContext ?? null;
}
