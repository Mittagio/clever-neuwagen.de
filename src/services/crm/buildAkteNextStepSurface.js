/**
 * Kundenakte Next-Step Surface – 1 Primär-CTA aus realem Status.
 * Nie generisch: immer reasonSource aus Empfehlungs-/Lead-Zustand.
 */

import { CLEVER_ACTION_IDS } from './cleverActionEngine.js';

const SOURCE_BY_ACTION = {
  [CLEVER_ACTION_IDS.OFFER_DRAFT_CREATE]: 'missing_offer_data',
  [CLEVER_ACTION_IDS.OFFER_CREATED_SEND]: 'offer_ready',
  [CLEVER_ACTION_IDS.OFFER_SEND]: 'offer_ready',
  [CLEVER_ACTION_IDS.OFFER_OPENED_CALL]: 'customer_reaction',
  [CLEVER_ACTION_IDS.OFFER_FOLLOWUP]: 'last_contact',
  [CLEVER_ACTION_IDS.OFFER_QUESTION_ANSWER]: 'customer_reaction',
  [CLEVER_ACTION_IDS.OFFER_INTEREST_FOLLOWUP]: 'customer_reaction',
  [CLEVER_ACTION_IDS.SELECTION_FOLLOWUP]: 'customer_reaction',
  [CLEVER_ACTION_IDS.SELECTION_SEND]: 'open_task',
  [CLEVER_ACTION_IDS.ANSWER_CUSTOMER_QUESTION]: 'customer_reaction',
  [CLEVER_ACTION_IDS.SEND_CUSTOMER_ANSWER]: 'customer_reaction',
  [CLEVER_ACTION_IDS.GENERAL_REMINDER]: 'open_task',
  [CLEVER_ACTION_IDS.DOCUMENTS_MISSING]: 'open_task',
  [CLEVER_ACTION_IDS.DOCUMENTS_INBOX_CHECK]: 'open_task',
  [CLEVER_ACTION_IDS.SELF_DISCLOSURE_REVIEW]: 'customer_reaction',
  [CLEVER_ACTION_IDS.SELF_DISCLOSURE_REQUEST]: 'open_task',
  [CLEVER_ACTION_IDS.SELF_DISCLOSURE_FOLLOWUP]: 'deadline',
  [CLEVER_ACTION_IDS.SELF_DISCLOSURE_CORRECTION_FOLLOWUP]: 'open_task',
  [CLEVER_ACTION_IDS.APPLICATION_PREPARE]: 'open_task',
  [CLEVER_ACTION_IDS.PORTAL_LINK_FOLLOWUP]: 'last_contact',
  [CLEVER_ACTION_IDS.PORTAL_VIEWED_FOLLOWUP]: 'customer_reaction',
  [CLEVER_ACTION_IDS.DELIVERY_READY]: 'deadline',
  [CLEVER_ACTION_IDS.VEHICLE_ARRIVING]: 'deadline',
};

/**
 * @param {object} params
 * @param {object|null} params.recommendation – aus recommendCleverAction
 * @param {object[]} [params.actions] – kontaktfähige Actions (call/offer/…)
 * @param {boolean} [params.canSend]
 * @param {boolean} [params.canCall]
 * @param {string|null} [params.telHref]
 */
export function buildAkteNextStepSurface({
  recommendation = null,
  actions = [],
  canSend = false,
  canCall = false,
  telHref = null,
} = {}) {
  if (!recommendation?.ctaLabel && !recommendation?.title) return null;

  const primaryFromActions = actions.find((a) => a.primary) || actions[0] || null;
  const handlerType = recommendation.handlerType || primaryFromActions?.type || null;
  const isCall = handlerType === 'call' || primaryFromActions?.type === 'call';

  const primary = {
    id: recommendation.actionId || primaryFromActions?.id || 'primary',
    label: recommendation.ctaLabel || recommendation.title || 'Weiter',
    type: isCall ? 'call' : (primaryFromActions?.type || handlerType || 'action'),
    href: isCall ? (primaryFromActions?.href || telHref || null) : null,
    handlerType,
  };

  let secondary = null;
  if (isCall) {
    if (canSend) {
      secondary = { id: 'send', label: 'An Kunden senden', type: 'send' };
    }
  } else if (canCall) {
    secondary = {
      id: 'call',
      label: 'Anrufen',
      type: 'call',
      href: telHref || actions.find((a) => a.type === 'call')?.href || null,
    };
  } else if (canSend) {
    secondary = { id: 'send', label: 'An Kunden senden', type: 'send' };
  }

  // Nie zwei gleich starke Primärs: secondary niemals denselben Typ/Label wie primary
  if (secondary && (
    secondary.label === primary.label
    || (secondary.type === primary.type && secondary.type !== 'send')
  )) {
    secondary = secondary.type === 'send' && !isCall
      ? secondary
      : (canSend && !isCall ? { id: 'send', label: 'An Kunden senden', type: 'send' } : null);
    if (secondary?.label === primary.label) secondary = null;
  }

  const kind = SOURCE_BY_ACTION[recommendation.actionId] || 'open_task';
  const detail = String(
    recommendation.reason
    || recommendation.whyClever
    || recommendation.explanation
    || '',
  ).trim();

  return {
    recommendLabel: 'Clever empfiehlt',
    primary,
    secondary,
    reasonSource: {
      kind,
      detail: detail || null,
      actionId: recommendation.actionId || null,
    },
    // Keine Erklärbox – detail nur für Audit/title, nicht als Fließtext
    showExplanation: false,
  };
}

/**
 * Schlanke Kontextzeile für den Akte-Kopf: nur Fahrzeug/Modell.
 * Deal-Konditionen (Leasing, Laufzeit, km, AZ) gehören ins Konditionen-Band.
 * Extra-Args (paymentType, termMonths, …) werden ignoriert (API-Kompatibilität).
 */
export function buildAkteLeanContextLine({
  vehicleLabel = '',
} = {}) {
  return String(vehicleLabel || '').replace(/^Kia\s+/i, '').trim();
}
