/**
 * Clever 2.0 Sprint 3 – Chat-native Feed-Helfer (bestehende Clever-Card-Patterns).
 */
import { postCleverAssistFeedCard } from '../crm/sharedWorkspaceService.js';
import { CLEVER_RESPONSE_KIND } from './cleverAssistantResponse.js';

/**
 * Normalisiert Kundensuche-Treffer für Picker / Context-Switch.
 * @param {object[]} cards
 */
export function normalizeCustomerSearchResults(cards = []) {
  return (Array.isArray(cards) ? cards : [])
    .map((c) => {
      const lead = c?.lead || null;
      const leadId = c?.leadId || c?.customerId || lead?.id || c?.id || null;
      if (!leadId) return null;
      return {
        leadId,
        customerId: c?.customerId || leadId,
        customerName: c?.customerName
          || c?.card?.customerName
          || c?.card?.name
          || lead?.contact?.name
          || lead?.name
          || 'Kunde',
        email: c?.email || lead?.contact?.email || null,
        phone: c?.phone || lead?.contact?.phone || null,
        vehicleLabel: c?.vehicleLabel || c?.card?.favoriteLine || null,
        referenceCode: c?.referenceCode || lead?.referenceCode || null,
        matchReasons: Array.isArray(c?.matchReasons) ? c.matchReasons : [],
        matchReason: c?.matchReason || null,
        lastActivityLabel: c?.lastActivityLabel || null,
        lead,
      };
    })
    .filter(Boolean);
}

/**
 * Context-Switch aus Agent-Ergebnis („Mach zuerst Brandes“).
 * @param {object} agentResult
 */
export function resolveContextSwitchFromAgent(agentResult = {}) {
  const toolNames = (agentResult.toolCalls || []).map((t) => t.name);
  const touched = toolNames.some((n) => n === 'find_customer' || n === 'open_customer');
  const results = normalizeCustomerSearchResults(agentResult.customerSearchResults || []);
  const resolved = agentResult.resolvedCustomer || null;
  if (!touched && !results.length && !resolved) return null;

  const leadId = resolved?.id
    || (results.length === 1 ? results[0].leadId : null)
    || null;
  const name = resolved?.contact?.name
    || resolved?.name
    || (leadId ? results.find((r) => r.leadId === leadId)?.customerName : null)
    || results[0]?.customerName
    || null;

  let kind = 'none';
  if (results.length > 1 && !resolved?.id) kind = 'ambiguous';
  else if (leadId) kind = 'unique';

  return {
    kind,
    leadId,
    name,
    customerSearchResults: results,
    autoOpen: kind === 'unique' && Boolean(leadId),
    hint: kind === 'unique' && name
      ? `Weiter mit ${name}.`
      : kind === 'ambiguous'
        ? 'Mehrere Kunden – bitte Akte wählen.'
        : null,
  };
}

/**
 * Frischer Undo-Token für Remember / Partial-Save (Feed-Card ↔ State).
 */
export function createRememberUndoToken() {
  return `undo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Payload für Clever Feed-Karte aus Response Policy (+ optional Context-Switch-CTA).
 * @param {{ policy?: object, agentResult?: object, contextSwitch?: object|null, undoToken?: string|null }} opts
 */
export function buildAssistantFeedCardOptions({
  policy = null,
  agentResult = null,
  contextSwitch = null,
  undoToken = null,
} = {}) {
  const kind = policy?.kind || CLEVER_RESPONSE_KIND.DIRECT_ANSWER;
  const chips = Array.isArray(policy?.chips) ? policy.chips.filter(Boolean).slice(0, 8) : [];
  const text = String(policy?.message || agentResult?.message || '').trim();
  if (!text) return null;

  const openLeadId = contextSwitch?.leadId
    || (agentResult?.suggestedActions || []).find((a) => a.action === 'open_customer' && a.leadId)?.leadId
    || null;
  const openLabel = (agentResult?.suggestedActions || []).find((a) => a.action === 'open_customer')?.label
    || (contextSwitch?.name ? `${contextSwitch.name} öffnen` : null);

  const title = kind === CLEVER_RESPONSE_KIND.CLARIFICATION
    ? '✨ Clever · Rückfrage'
    : '✨ Clever';

  const undoAvailable = Boolean(policy?.undoAvailable);
  return {
    title,
    text,
    responseKind: kind,
    chips,
    undoAvailable,
    undoToken: undoAvailable ? (undoToken || null) : null,
    ctaLabel: openLeadId ? (openLabel || 'Akte öffnen') : null,
    ctaAction: openLeadId ? 'open_customer' : null,
    leadId: openLeadId,
  };
}

/**
 * Postet Assistant-Antwort als Clever Feed-Karte (Akte / Lead-Feed).
 * @returns {{ lead: object, message: object|null }|null}
 */
export function postAssistantConversationFeedCard({
  lead,
  policy = null,
  agentResult = null,
  contextSwitch = null,
  undoToken = null,
} = {}) {
  const options = buildAssistantFeedCardOptions({
    policy,
    agentResult,
    contextSwitch,
    undoToken,
  });
  if (!lead?.id || !options?.text) return null;
  return postCleverAssistFeedCard({
    lead,
    title: options.title,
    text: options.text,
    ctaLabel: options.ctaLabel,
    ctaAction: options.ctaAction,
    leadId: options.leadId,
    responseKind: options.responseKind,
    chips: options.chips,
    undoAvailable: options.undoAvailable,
    undoToken: options.undoToken,
  });
}
