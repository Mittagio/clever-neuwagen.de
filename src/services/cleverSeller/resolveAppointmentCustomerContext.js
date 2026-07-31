/**
 * Kundenauflösung für Terminvorschläge (Pronomen + Kontext).
 */
import { resolveWorkingLeadForTurn } from './resolveWorkingLeadForTurn.js';
import { extractNamedCustomerFromInput } from './resolveAssistantContext.js';

/**
 * @param {{
 *   sellerInput?: string,
 *   lead?: object,
 *   leadsSnapshot?: object[],
 *   pendingAction?: object|null,
 *   workingContextItems?: object[],
 * }} params
 */
export function resolveAppointmentCustomerContext(params = {}) {
  const sellerInput = String(params.sellerInput || '');
  const hasPronoun = /\b(ihm|ihr|ihm\/ihr|dem kunden)\b/i.test(sellerInput);
  const named = extractNamedCustomerFromInput(sellerInput);

  // 1) currentCustomer / offene Akte
  if (params.lead?.id) {
    return {
      ok: true,
      resolved: true,
      customer: params.lead,
      source: 'current_customer',
      usedPronoun: hasPronoun,
      ambiguous: false,
      question: null,
    };
  }

  // 2) Pending Action / vorheriger Turn
  const pendingCustomerId = params.pendingAction?.customerId
    || params.pendingAction?.preparedAppointment?.customerId
    || null;
  if (pendingCustomerId && Array.isArray(params.leadsSnapshot)) {
    const hit = params.leadsSnapshot.find((l) => l.id === pendingCustomerId);
    if (hit?.id) {
      return {
        ok: true,
        resolved: true,
        customer: hit,
        source: 'previous_turn',
        usedPronoun: hasPronoun,
        ambiguous: false,
        question: null,
      };
    }
  }

  // 3) Working Object mit customerId
  const fromWorking = (params.workingContextItems || []).find((item) => item?.customerId);
  if (fromWorking?.customerId && Array.isArray(params.leadsSnapshot)) {
    const hit = params.leadsSnapshot.find((l) => l.id === fromWorking.customerId);
    if (hit?.id) {
      return {
        ok: true,
        resolved: true,
        customer: hit,
        source: 'working_context',
        usedPronoun: hasPronoun,
        ambiguous: false,
        question: null,
      };
    }
  }

  // 4/5) Expliziter Name oder globale Suche
  const resolved = resolveWorkingLeadForTurn({
    lead: {},
    sellerInput,
    leadsSnapshot: params.leadsSnapshot || [],
  });

  if (resolved.ambiguous) {
    return {
      ok: false,
      resolved: false,
      customer: null,
      source: 'global_search',
      usedPronoun: hasPronoun,
      ambiguous: true,
      customerSearchResults: resolved.customerSearchResults,
      question: 'Für welchen Kunden soll ich den Termin vorschlagen?',
    };
  }

  if (resolved.resolved && resolved.workingLead?.id) {
    return {
      ok: true,
      resolved: true,
      customer: resolved.workingLead,
      source: named ? 'explicit_input' : 'global_search',
      usedPronoun: hasPronoun,
      ambiguous: false,
      question: null,
    };
  }

  // Pronomen ohne auflösbaren Kunden
  if (hasPronoun || /\bschlag(?:e|en)?\b/i.test(sellerInput)) {
    return {
      ok: false,
      resolved: false,
      customer: null,
      source: null,
      usedPronoun: hasPronoun,
      ambiguous: false,
      question: 'Für welchen Kunden soll ich den Termin vorschlagen?',
    };
  }

  return {
    ok: false,
    resolved: false,
    customer: null,
    source: null,
    usedPronoun: false,
    ambiguous: false,
    question: 'Für welchen Kunden soll ich den Termin vorschlagen?',
  };
}
