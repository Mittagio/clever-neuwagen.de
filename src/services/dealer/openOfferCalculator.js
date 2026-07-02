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
import { VEHICLE_OFFER_STATUS } from '../vehicleOffer.js';

export const OFFER_ENTRY_TARGET = {
  CALCULATOR: 'calculator',
  PROPOSAL: 'proposal',
  ANSWER_QUESTION: 'answer_question',
};

function readStoredVehicleOffer(card = {}, lead = null) {
  return card?.vehicleOffer
    ?? lead?.crm?.vehicleOffers?.[card?.id]
    ?? lead?.crm?.vehicleOffers?.[card?.configurationId]
    ?? null;
}

/** Angebot wurde dem Kunden zugestellt (nicht nur intern vorbereitet). */
export function isCustomerVisibleOfferState(card = {}, lead = null) {
  const stored = readStoredVehicleOffer(card, lead);
  if (!stored) return false;
  return [
    VEHICLE_OFFER_STATUS.SENT,
    VEHICLE_OFFER_STATUS.OPENED,
    VEHICLE_OFFER_STATUS.ACCEPTED,
    VEHICLE_OFFER_STATUS.REJECTED,
  ].includes(stored.status);
}

/**
 * Zielansicht für einen Angebots-Einstieg.
 * Entwurf, offer_created und vorbereitete Links → immer Kalkulator.
 * Vorschlag nur bei tatsächlich gesendetem Kundenangebot.
 */
export function resolveOfferEntryTarget(card = {}, lead = null) {
  const status = resolveBoardOfferStatus(card, lead);
  const sentToCustomer = isCustomerVisibleOfferState(card, lead);

  if (!sentToCustomer) {
    if (status === BOARD_OFFER_STATUS.QUESTION_OPEN) {
      return OFFER_ENTRY_TARGET.ANSWER_QUESTION;
    }
    return OFFER_ENTRY_TARGET.CALCULATOR;
  }

  if (status === BOARD_OFFER_STATUS.QUESTION_OPEN) {
    return OFFER_ENTRY_TARGET.ANSWER_QUESTION;
  }

  return OFFER_ENTRY_TARGET.PROPOSAL;
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

  if (!addVehicleContext) return null;

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
 * Einheitlicher Board-Einstieg: Kalkulator oder Vorschlag (nur gesendet).
 */
export function openBoardOfferEntry(card, lead, { onOpenProposal, onOpenCalculator } = {}, options = {}) {
  if (!card) return null;
  if (shouldOpenOfferProposalView(card, lead)) {
    onOpenProposal?.(card);
    return OFFER_ENTRY_TARGET.PROPOSAL;
  }
  onOpenCalculator?.(card, options);
  return OFFER_ENTRY_TARGET.CALCULATOR;
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
