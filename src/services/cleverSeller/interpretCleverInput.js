/**
 * Clever Agent V1 – zentraler Input-Interpreter (dünner Adapter).
 *
 * LLM/Deterministik verstehen → strukturiertes Ergebnis.
 * Schreiben passiert nur über applyInterpretedCleverCapture /
 * applyStructuredFactsToLead (kein direktes LLM→CRM).
 *
 * Keine parallele AI-Datenbank. Kein Working-Draft-Core-Rewrite.
 */

import { interpretSellerInput } from './interpretSellerInput.js';
import { applyStructuredFactsToLead } from './applyAcceptedSellerTurn.js';
import { ensureConceptOfferDraftFromCapture } from './ensureConceptOfferDraftFromCapture.js';
import { getOfferDraftById } from './cleverWorkingDraft.js';
import { SELLER_TURN_INTENTS } from './sellerFactTypes.js';
import { buildSellerWorkBriefing } from './buildSellerWorkBriefing.js';

export { ensureConceptOfferDraftFromCapture } from './ensureConceptOfferDraftFromCapture.js';
export { buildSellerWorkBriefing } from './buildSellerWorkBriefing.js';

/**
 * @param {{
 *   text?: string,
 *   sellerInput?: string,
 *   lead?: object,
 *   crmContext?: object,
 *   attachments?: object[],
 *   workingMemory?: object,
 *   currentOfferContext?: object|null,
 *   intentConstraint?: string|null,
 * }} input
 */
export function interpretCleverInput(input = {}) {
  const text = String(input.text ?? input.sellerInput ?? '').trim();
  const lead = input.lead || {};
  const interpreted = interpretSellerInput(text, {
    lead,
    attachments: input.attachments || [],
    currentOfferContext: input.currentOfferContext ?? null,
    workingMemory: input.workingMemory || null,
    intentConstraint: input.intentConstraint || null,
    now: input.now ?? null,
    ...(input.crmContext && typeof input.crmContext === 'object' ? input.crmContext : {}),
  });

  const facts = interpreted.facts || [];
  const intents = interpreted.intents || [];
  const primaryIntent = intents[0]?.type
    || SELLER_TURN_INTENTS.UPDATE_CUSTOMER_CONTEXT;

  const extractedData = {
    vehicle: pickVehicle(facts),
    leasing: pickLeasing(facts),
    customer: pickCustomer(facts),
    tradeIn: pickTradeIn(facts),
    extras: pickExtras(facts),
    notes: pickNotes(facts, interpreted),
    facts,
  };

  const conflicts = facts
    .filter((f) => f?.needsConfirmation || f?.field === 'vehicleTrimConflict')
    .map((f) => ({
      field: f.field,
      label: f.label,
      value: f.value,
    }));

  const confidence = {};
  for (const fact of facts) {
    if (fact?.field) confidence[fact.field] = fact.confidence;
  }

  return {
    intent: mapCaptureIntent(primaryIntent, facts),
    extractedData,
    confidence,
    conflicts,
    proposedActions: buildProposedActions(facts, primaryIntent),
    /** Roh-Interpret für bestehende Orchestrator-Pfade */
    interpreted,
  };
}

function mapCaptureIntent(primaryIntent, facts = []) {
  if (primaryIntent === SELLER_TURN_INTENTS.PREPARE_OFFER) {
    return 'prepare_offer_concept';
  }
  if (facts.some((f) => (
    f.field === 'vehicleInterest'
    || f.field === 'termMonths'
    || f.field === 'annualMileage'
    || f.field === 'colorPreference'
  ))) {
    return 'capture_customer_information';
  }
  return 'capture_customer_information';
}

function pickVehicle(facts = []) {
  const interest = facts.find((f) => f.field === 'vehicleInterest');
  const color = facts.find((f) => f.field === 'colorPreference');
  const motor = facts.find((f) => f.field === 'motorPreference' || f.field === 'batteryPreference');
  const trim = facts.find((f) => f.field === 'trimPreference');
  const trimFromInterest = interest?.value?.trim || null;
  const trimFromPref = Array.isArray(trim?.value)
    ? trim.value[0]
    : (trim?.value?.trim || trim?.label || null);
  return {
    modelKey: interest?.value?.modelKey || null,
    model: interest?.value?.model || interest?.label || null,
    variant: motor?.label || motor?.value?.label || null,
    battery: motor?.field === 'batteryPreference' ? (motor.label || null) : null,
    color: color?.value?.color || color?.label || null,
    trim: trimFromPref || trimFromInterest || null,
  };
}

function pickLeasing(facts = []) {
  const term = facts.find((f) => f.field === 'termMonths' || f.field === 'durationMonths');
  const km = facts.find((f) => f.field === 'annualMileage' || f.field === 'mileagePerYear');
  const payment = facts.find((f) => f.field === 'paymentType');
  const budget = facts.find((f) => f.field === 'monthlyBudget' || f.field === 'desiredRate');
  const down = facts.find((f) => f.field === 'downPayment');
  return {
    durationMonths: term?.value != null ? Number(term.value) : null,
    annualMileage: km?.value != null ? Number(km.value) : null,
    paymentType: payment?.value || null,
    /** Kundenwunsch – nie als Angebotsrate behandeln */
    desiredRate: budget?.value?.amount ?? budget?.value ?? null,
    downPayment: down?.value != null ? Number(down.value) : null,
    rate: null,
  };
}

function pickCustomer(facts = []) {
  const name = facts.find((f) => f.field === 'customerName' || f.field === 'contactName');
  const phone = facts.find((f) => f.field === 'phone' || f.field === 'customerPhone');
  const email = facts.find((f) => f.field === 'email' || f.field === 'customerEmail');
  const customerType = facts.find((f) => f.field === 'customerType');
  return {
    name: name?.value || name?.label || null,
    phone: phone?.value || null,
    email: email?.value || null,
    /** Bestehend: COMMERCIAL_CUSTOMER_TYPE (private|business) */
    customerType: customerType?.value || null,
  };
}

function pickTradeIn(facts = []) {
  const requested = facts.find((f) => f.field === 'tradeInRequested');
  const vehicle = facts.find((f) => (
    (f.field === 'tradeInVehicle' || f.field === 'existingVehicle')
    && !f.needsConfirmation
  ));
  const status = requested?.value?.status
    || (requested ? 'requested' : null)
    || (vehicle ? 'possible' : null);
  return {
    status,
    vehicle: vehicle?.value?.model
      ? [vehicle.value.make, vehicle.value.model].filter(Boolean).join(' ')
      : (vehicle?.label || vehicle?.value || null),
    year: vehicle?.value?.year ?? null,
    mileageKm: vehicle?.value?.mileageKm ?? null,
    mileageApproximate: Boolean(vehicle?.value?.mileageApproximate),
  };
}

function pickExtras(facts = []) {
  const equipmentFacts = facts.filter((f) => f.field === 'equipmentWish');
  const equipment = equipmentFacts
    .map((f) => f.label || f.value?.label)
    .filter(Boolean);
  const packages = equipmentFacts.map((f) => ({
    label: f.label || f.value?.label || null,
    id: f.value?.id || null,
    needsReview: Boolean(f.needsConfirmation || f.value?.validationStatus === 'needs_review'),
  }));
  return { equipment, packages };
}

function pickNotes(facts = [], interpreted = {}) {
  const unresolved = facts
    .filter((f) => f.field === 'unresolvedNote' || f.preserveAsNote)
    .map((f) => f.label || f.value)
    .filter(Boolean);
  const zeroLossNotes = interpreted?.zeroLossIntake?.unresolvedNotes || [];
  return [...new Set([...unresolved, ...zeroLossNotes].map((n) => String(n).trim()).filter(Boolean))];
}

function buildProposedActions(facts = [], primaryIntent) {
  const actions = [{ type: 'apply_structured_facts' }];
  const hasVehicle = facts.some((f) => f.field === 'vehicleInterest');
  const hasCommercial = facts.some((f) => (
    f.field === 'termMonths'
    || f.field === 'annualMileage'
    || f.field === 'colorPreference'
    || f.field === 'motorPreference'
  ));
  if (hasVehicle && hasCommercial) {
    actions.push({ type: 'prepare_offer_concept_draft', rate: null });
  }
  if (primaryIntent === SELLER_TURN_INTENTS.PREPARE_OFFER) {
    actions.push({ type: 'prepare_offer_review' });
  }
  return actions;
}

/**
 * Validierte Anwendung: Facts → Lead, optional Concept-Offer-Draft (rate immer null).
 * Keine erfundenen Werte. Kein LLM-Schreiben.
 *
 * @param {object} lead
 * @param {ReturnType<typeof interpretCleverInput>} interpretation
 * @param {{ sellerInput?: string, prepareOfferDraft?: boolean }} [options]
 */
export function applyInterpretedCleverCapture(lead = {}, interpretation = {}, options = {}) {
  const facts = interpretation?.extractedData?.facts
    || interpretation?.interpreted?.facts
    || [];
  const sellerInput = String(options.sellerInput || '').trim();
  let next = applyStructuredFactsToLead(lead, facts.filter((f) => !f?.needsConfirmation));

  const shouldPrepareDraft = options.prepareOfferDraft !== false
    && (interpretation?.proposedActions || []).some((a) => a.type === 'prepare_offer_concept_draft');

  let offerDraftId = null;
  if (shouldPrepareDraft) {
    const ensured = ensureConceptOfferDraftFromCapture(next, facts, {
      sellerInput,
      modelKey: interpretation?.extractedData?.vehicle?.modelKey || null,
      createNewAlternative: true,
      force: true,
    });
    next = ensured.lead;
    offerDraftId = ensured.offerDraftId;
  }

  const draft = offerDraftId ? getOfferDraftById(next, offerDraftId) : null;
  const labels = [];
  const vehicle = interpretation?.extractedData?.vehicle || {};
  if (vehicle.model) labels.push(String(vehicle.model).replace(/^Kia\s+/i, ''));
  if (vehicle.variant) labels.push(vehicle.variant);
  if (vehicle.color) labels.push(vehicle.color);
  const leasing = interpretation?.extractedData?.leasing || {};
  if (leasing.durationMonths) labels.push(`${leasing.durationMonths} Monate`);
  if (leasing.annualMileage) {
    labels.push(`${Number(leasing.annualMileage).toLocaleString('de-DE')} km`);
  }

  const workBriefing = buildSellerWorkBriefing({
    facts,
    draft,
    lead: next,
  });

  return {
    lead: next,
    offerDraftId,
    offerDraft: draft,
    workBriefing,
    microConfirm: labels.length
      ? `${labels.join(' · ')} ergänzt · Rückgängig`
      : null,
  };
}
