/**
 * Facts → proposedUpdates (keine blinde Persistenz).
 * Mapping auf bestehende Truth-Targets.
 */
import { SELLER_FACT_CLASS } from './sellerFactTypes.js';
import { createProposedUpdate } from './cleverSellerTurnResultSchema.js';
import { buildUnderstoodLabels, getNeedProfileFromLead } from '../consultation/needProfileService.js';

const AUTO_APPLY_MIN = 0.92;

/**
 * @param {object[]} facts
 */
export function buildProposedUpdatesFromFacts(facts = []) {
  const updates = [];

  for (const fact of facts) {
    if (!fact || fact.needsConfirmation) {
      if (fact?.needsConfirmation) {
        updates.push(createProposedUpdate({
          target: 'needs_confirmation',
          field: fact.field,
          value: fact.value,
          confidence: fact.confidence,
          factClass: fact.factClass,
          autoApply: false,
          source: fact.source,
        }));
      }
      continue;
    }

    switch (fact.factClass) {
      case SELLER_FACT_CLASS.CUSTOMER_FACT:
        updates.push(createProposedUpdate({
          target: 'sellerInsights',
          field: fact.field,
          value: fact.label,
          confidence: fact.confidence,
          factClass: fact.factClass,
          autoApply: fact.confidence >= AUTO_APPLY_MIN,
          source: fact.source,
        }));
        break;
      case SELLER_FACT_CLASS.SELF_DISCLOSURE_FACT:
        updates.push(createProposedUpdate({
          target: 'selfDisclosure',
          field: fact.field,
          value: fact.value,
          confidence: fact.confidence,
          factClass: fact.factClass,
          autoApply: false,
          source: fact.source,
        }));
        break;
      case SELLER_FACT_CLASS.COMMERCIAL_PREFERENCE:
        updates.push(createProposedUpdate({
          target: 'needProfile',
          field: fact.field === 'monthlyBudget' ? 'budgetMonthly' : fact.field,
          value: fact.value,
          confidence: fact.confidence,
          factClass: fact.factClass,
          autoApply: fact.confidence >= AUTO_APPLY_MIN && fact.field === 'annualMileage',
          source: fact.source,
        }));
        break;
      case SELLER_FACT_CLASS.VEHICLE_INTEREST:
        updates.push(createProposedUpdate({
          target: 'needProfile',
          field: fact.field,
          value: fact.value,
          confidence: fact.confidence,
          factClass: fact.factClass,
          autoApply: false,
          source: fact.source,
        }));
        break;
      case SELLER_FACT_CLASS.VEHICLE_REQUIREMENT:
        updates.push(createProposedUpdate({
          target: 'needProfile',
          field: fact.field,
          value: fact.value ?? fact.label,
          confidence: fact.confidence,
          factClass: fact.factClass,
          autoApply: fact.confidence >= AUTO_APPLY_MIN,
          source: fact.source,
        }));
        break;
      case SELLER_FACT_CLASS.EXISTING_VEHICLE:
        updates.push(createProposedUpdate({
          target: 'tradeIn',
          field: 'existingVehicle',
          value: fact.value,
          confidence: fact.confidence,
          factClass: fact.factClass,
          autoApply: false,
          source: fact.source,
        }));
        break;
      case SELLER_FACT_CLASS.TRADE_IN_FACT:
        updates.push(createProposedUpdate({
          target: 'tradeIn',
          field: 'requested',
          value: true,
          confidence: fact.confidence,
          factClass: fact.factClass,
          autoApply: false,
          source: fact.source,
        }));
        break;
      case SELLER_FACT_CLASS.CONTRACT_FACT:
        updates.push(createProposedUpdate({
          target: 'crm',
          field: 'existingContract',
          value: fact.value,
          confidence: fact.confidence,
          factClass: fact.factClass,
          autoApply: false,
          source: fact.source,
        }));
        break;
      case SELLER_FACT_CLASS.OFFER_INSTRUCTION:
        updates.push(createProposedUpdate({
          target: 'pendingAction',
          field: fact.field,
          value: fact.value,
          confidence: fact.confidence,
          factClass: fact.factClass,
          autoApply: false,
          source: fact.source,
        }));
        break;
      default:
        updates.push(createProposedUpdate({
          target: 'sellerInsights',
          field: fact.field || 'note',
          value: fact.label,
          confidence: fact.confidence,
          factClass: fact.factClass,
          autoApply: false,
          source: fact.source,
        }));
    }
  }

  return updates;
}

/**
 * Deduplizierung gegen bekannte Labels.
 * @param {object[]} facts
 * @param {object} lead
 */
export function filterDuplicateFacts(facts = [], lead = {}) {
  const profile = getNeedProfileFromLead(lead) || {};
  const known = new Set(
    [
      ...buildUnderstoodLabels(profile),
      ...(profile.understoodLabels ?? []),
    ].map((l) => String(l).toLowerCase().trim()),
  );
  const sellerNotes = String(lead?.crm?.kundenhelfer?.notes ?? '').toLowerCase();

  const normalize = (s) => String(s ?? '')
    .toLowerCase()
    .replace(/\bzwei\b/g, '2')
    .replace(/\bdrei\b/g, '3')
    .replace(/\s+/g, ' ')
    .trim();

  const knownNorm = new Set([...known].map(normalize));

  return facts.filter((fact) => {
    const label = normalize(fact.label);
    if (!label) return false;
    if (knownNorm.has(label)) return false;
    if ([...knownNorm].some((k) => k.includes(label) || label.includes(k))) {
      // nur bei klaren Overlaps wie "2 kinder"
      if (/kinder|verheiratet|ledig|wunschrate|netto/.test(label)) return false;
    }
    if (sellerNotes.includes(label)) return false;
    return true;
  });
}
