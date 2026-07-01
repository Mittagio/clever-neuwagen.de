/**
 * Einstieg „Vorschlag hinzufügen“ auf dem Tisch
 */
import { buildAddVehicleContextFromLead } from '../customerAddVehicleFlow.js';

export const PROPOSAL_INTENTS = {
  VEHICLE: 'vehicle',
  SELECTION_GROUP: 'create_selection_group',
  CASH: 'cash',
  LEASING: 'leasing',
  FINANCING: 'financing',
};

const INTENT_BANNER = {
  [PROPOSAL_INTENTS.VEHICLE]: 'Fahrzeugvorschlag vorbereiten',
  [PROPOSAL_INTENTS.SELECTION_GROUP]: 'Clever Auswahl vorbereiten',
  [PROPOSAL_INTENTS.CASH]: 'Barangebot vorbereiten – nutzt vorhandenen Kaufpreis-/Rabattpfad',
  [PROPOSAL_INTENTS.LEASING]: 'Leasingvorschlag vorbereiten',
  [PROPOSAL_INTENTS.FINANCING]: 'Finanzierungsvorschlag vorbereiten',
};

const INTENT_REVIEW_LABEL = {
  [PROPOSAL_INTENTS.VEHICLE]: 'Fahrzeug konfigurieren',
  [PROPOSAL_INTENTS.SELECTION_GROUP]: 'Clever Auswahl vorbereiten',
  [PROPOSAL_INTENTS.CASH]: 'Fahrzeug konfigurieren',
  [PROPOSAL_INTENTS.LEASING]: 'Fahrzeug konfigurieren',
  [PROPOSAL_INTENTS.FINANCING]: 'Fahrzeug konfigurieren',
};

/**
 * @param {object} lead
 * @param {object} options
 */
export function buildAddProposalNavigateContext(lead, options = {}) {
  const proposalIntent = options.proposalIntent ?? PROPOSAL_INTENTS.VEHICLE;
  const paymentType = options.paymentType
    ?? (proposalIntent === PROPOSAL_INTENTS.CASH ? 'cash' : null)
    ?? (proposalIntent === PROPOSAL_INTENTS.LEASING ? 'leasing' : null)
    ?? (proposalIntent === PROPOSAL_INTENTS.FINANCING ? 'financing' : null);

  return buildAddVehicleContextFromLead(lead, {
    returnPath: options.returnPath,
    proposalIntent,
    paymentType,
  });
}

export function getProposalIntentBanner(ctx) {
  if (!ctx?.proposalIntent) return null;
  return INTENT_BANNER[ctx.proposalIntent] ?? null;
}

export function getProposalReviewLabel(ctx) {
  if (!ctx?.proposalIntent) return null;
  return INTENT_REVIEW_LABEL[ctx.proposalIntent] ?? null;
}

export function resolveProposalPaymentType(intent) {
  if (intent === PROPOSAL_INTENTS.CASH) return 'cash';
  if (intent === PROPOSAL_INTENTS.LEASING) return 'leasing';
  if (intent === PROPOSAL_INTENTS.FINANCING) return 'financing';
  return null;
}

/** Einzel-Fahrzeug-Vorschlag – voller Configure-Pfad statt Shortcut. */
export function isSingleVehicleProposalIntent(proposalIntent) {
  return proposalIntent === PROPOSAL_INTENTS.VEHICLE
    || proposalIntent === PROPOSAL_INTENTS.CASH
    || proposalIntent === PROPOSAL_INTENTS.LEASING
    || proposalIntent === PROPOSAL_INTENTS.FINANCING;
}

export function shouldForceConfigureFlow(ctx) {
  if (!ctx?.customerId) return false;
  return isSingleVehicleProposalIntent(ctx.proposalIntent);
}
