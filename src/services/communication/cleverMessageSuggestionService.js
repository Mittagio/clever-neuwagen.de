/**
 * Clever Antwortvorschläge – Journey/Reminder → Text (nur vorbereiten, nicht senden).
 */
import { evaluateJourney } from '../journey/journeyEngine.js';
import { evaluateJourneyReminder } from '../journey/journeyReminderService.js';
import { JOURNEY_REMINDER_RULE_IDS } from '../journey/journeyReminderRules.js';
import { JOURNEY_PHASE } from '../journey/journeyTypes.js';
import { CLEVER_ACTION_IDS } from '../crm/cleverActionEngine.js';
import {
  buildOfferMailtoHref,
  buildOfferWhatsappHref,
} from '../vehicleOffer.js';
import { buildCleverMessageContext } from './cleverMessageContext.js';
import {
  MESSAGE_TEMPLATE_IDS,
  MESSAGE_TEMPLATE_LABELS,
  buildMessagePreview,
  renderCleverMessageTemplate,
} from './cleverMessageTemplates.js';

const REMINDER_TEMPLATE_MAP = {
  [JOURNEY_REMINDER_RULE_IDS.OFFER_SENT_2D]: MESSAGE_TEMPLATE_IDS.OFFER_FOLLOWUP,
  [JOURNEY_REMINDER_RULE_IDS.OFFER_OPENED_24H]: MESSAGE_TEMPLATE_IDS.OFFER_OPENED,
  [JOURNEY_REMINDER_RULE_IDS.DOCUMENTS_MISSING_3D]: MESSAGE_TEMPLATE_IDS.DOCUMENTS_MISSING,
  [JOURNEY_REMINDER_RULE_IDS.SELF_DISCLOSURE_OPEN]: MESSAGE_TEMPLATE_IDS.SELF_DISCLOSURE_REMINDER,
  [JOURNEY_REMINDER_RULE_IDS.TEST_DRIVE_NO_APPOINTMENT]: MESSAGE_TEMPLATE_IDS.TEST_DRIVE_PLAN,
  [JOURNEY_REMINDER_RULE_IDS.VEHICLE_ARRIVING]: MESSAGE_TEMPLATE_IDS.VEHICLE_AVAILABLE,
  [JOURNEY_REMINDER_RULE_IDS.LEASING_EXPIRES_6M]: MESSAGE_TEMPLATE_IDS.LEASING_EXPIRING,
  [JOURNEY_REMINDER_RULE_IDS.AFTERCARE_7D]: MESSAGE_TEMPLATE_IDS.AFTERCARE,
};

const ACTION_TEMPLATE_MAP = {
  [CLEVER_ACTION_IDS.OFFER_FOLLOWUP]: MESSAGE_TEMPLATE_IDS.OFFER_FOLLOWUP,
  [CLEVER_ACTION_IDS.OFFER_OPENED_CALL]: MESSAGE_TEMPLATE_IDS.OFFER_OPENED,
  [CLEVER_ACTION_IDS.OFFER_INTEREST_FOLLOWUP]: MESSAGE_TEMPLATE_IDS.OFFER_FOLLOWUP,
  [CLEVER_ACTION_IDS.PORTAL_VIEWED_FOLLOWUP]: MESSAGE_TEMPLATE_IDS.OFFER_OPENED,
  [CLEVER_ACTION_IDS.PORTAL_LINK_SEND]: MESSAGE_TEMPLATE_IDS.OFFER_FOLLOWUP,
  [CLEVER_ACTION_IDS.PORTAL_LINK_FOLLOWUP]: MESSAGE_TEMPLATE_IDS.OFFER_FOLLOWUP,
  [CLEVER_ACTION_IDS.PORTAL_CODE_REMIND]: MESSAGE_TEMPLATE_IDS.GENERAL_FOLLOWUP,
  [CLEVER_ACTION_IDS.DOCUMENTS_MISSING]: MESSAGE_TEMPLATE_IDS.DOCUMENTS_MISSING,
  [CLEVER_ACTION_IDS.SELF_DISCLOSURE_REQUEST]: MESSAGE_TEMPLATE_IDS.SELF_DISCLOSURE_REMINDER,
  [CLEVER_ACTION_IDS.SELF_DISCLOSURE_FOLLOWUP]: MESSAGE_TEMPLATE_IDS.SELF_DISCLOSURE_REMINDER,
  [CLEVER_ACTION_IDS.VEHICLE_ARRIVING]: MESSAGE_TEMPLATE_IDS.VEHICLE_AVAILABLE,
  [CLEVER_ACTION_IDS.DELIVERY_READY]: MESSAGE_TEMPLATE_IDS.VEHICLE_AVAILABLE,
  [CLEVER_ACTION_IDS.GENERAL_REMINDER]: MESSAGE_TEMPLATE_IDS.GENERAL_FOLLOWUP,
};

const PHASE_TEMPLATE_MAP = {
  [JOURNEY_PHASE.OFFER_SENT]: MESSAGE_TEMPLATE_IDS.OFFER_FOLLOWUP,
  [JOURNEY_PHASE.CUSTOMER_CONSIDERING]: MESSAGE_TEMPLATE_IDS.OFFER_OPENED,
  [JOURNEY_PHASE.DOCUMENTS]: MESSAGE_TEMPLATE_IDS.DOCUMENTS_MISSING,
  [JOURNEY_PHASE.TEST_DRIVE]: MESSAGE_TEMPLATE_IDS.TEST_DRIVE_PLAN,
  [JOURNEY_PHASE.DELIVERY]: MESSAGE_TEMPLATE_IDS.VEHICLE_AVAILABLE,
  [JOURNEY_PHASE.HANDOVER]: MESSAGE_TEMPLATE_IDS.VEHICLE_AVAILABLE,
  [JOURNEY_PHASE.AFTERCARE]: MESSAGE_TEMPLATE_IDS.AFTERCARE,
};

export function resolveMessageTemplateId({ reminder = null, journey = null } = {}) {
  if (reminder?.ruleId && REMINDER_TEMPLATE_MAP[reminder.ruleId]) {
    return REMINDER_TEMPLATE_MAP[reminder.ruleId];
  }

  const actionId = journey?.recommendation?.actionId;
  if (actionId && ACTION_TEMPLATE_MAP[actionId]) {
    return ACTION_TEMPLATE_MAP[actionId];
  }

  const phase = journey?.phase;
  if (phase && PHASE_TEMPLATE_MAP[phase]) {
    return PHASE_TEMPLATE_MAP[phase];
  }

  if (journey?.view?.headline?.toLowerCase().includes('anrufen')) {
    return MESSAGE_TEMPLATE_IDS.OFFER_OPENED;
  }

  return MESSAGE_TEMPLATE_IDS.GENERAL_FOLLOWUP;
}

export function buildMessageSubject(ctx = {}) {
  const vehicle = ctx.vehicleTitle ? ` – ${ctx.vehicleTitle}` : '';
  return `Ihr Fahrzeugangebot${vehicle}`;
}

/**
 * Textvorschlag aus Journey + Reminder + Kundendaten.
 */
export function buildCleverMessageSuggestion(lead = null, options = {}) {
  if (!lead?.id) return null;

  const journey = options.journey ?? evaluateJourney(lead, options);
  const reminder = options.reminder ?? evaluateJourneyReminder(lead, { ...options, journey });
  const ctx = buildCleverMessageContext({
    lead,
    journey,
    reminder,
    vehicleCards: options.vehicleCards,
    customerName: options.customerName,
    phone: options.phone,
    email: options.email,
    kundenhelferNotes: options.kundenhelferNotes,
    sellerName: options.sellerName,
    dealerName: options.dealerName,
    wishPaymentType: options.wishPaymentType,
  });

  const templateId = resolveMessageTemplateId({ reminder, journey });
  const text = renderCleverMessageTemplate(ctx, templateId);
  const subject = buildMessageSubject(ctx);

  return {
    templateId,
    label: MESSAGE_TEMPLATE_LABELS[templateId] ?? 'Textvorschlag',
    text,
    preview: buildMessagePreview(text),
    subject,
    source: reminder?.active ? 'reminder' : 'journey',
    ruleId: reminder?.ruleId ?? null,
    actionId: journey?.recommendation?.actionId ?? null,
    autoSend: false,
  };
}

/**
 * Kanäle vorbereiten – kein automatischer Versand.
 */
export function prepareMessageChannels(suggestion, { phone = '', email = '' } = {}) {
  if (!suggestion?.text) return null;

  return {
    text: suggestion.text,
    subject: suggestion.subject,
    whatsappHref: buildOfferWhatsappHref(phone, suggestion.text),
    mailtoHref: buildOfferMailtoHref(email, suggestion.subject, suggestion.text),
    autoSend: false,
  };
}

/**
 * Kopieren-Hilfe (Browser); in Tests ohne Clipboard nutzbar.
 */
export async function copyCleverMessageSuggestion(suggestion, { clipboard = null } = {}) {
  const text = suggestion?.text ?? '';
  if (!text) return { ok: false, reason: 'empty' };

  const writer = clipboard
    ?? (typeof navigator !== 'undefined' ? navigator.clipboard : null);

  if (!writer?.writeText) {
    return { ok: true, method: 'text_only', text };
  }

  await writer.writeText(text);
  return { ok: true, method: 'clipboard', text };
}

export {
  MESSAGE_TEMPLATE_IDS,
  MESSAGE_TEMPLATE_LABELS,
};
