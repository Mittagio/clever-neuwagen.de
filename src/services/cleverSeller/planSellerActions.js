/**
 * Action Planner – verbindet Intents mit bestehenden Assist-/CRM-Tools.
 * EXECUTE passiert erst nach Seller-Bestätigung.
 */
import { SELLER_INPUT_MODE, SELLER_TURN_INTENTS } from './sellerFactTypes.js';
import { runSellerOfferAssist } from '../dealer/sellerOfferAssistFlow.js';
import { runSellerAppointmentAssist } from '../dealer/sellerAppointmentAssistFlow.js';
import { runSellerInlineAssist } from '../dealer/sellerInlineComposerAssist.js';
import { prepareSellerWorkspacePackage } from '../crm/sharedWorkspaceService.js';

/**
 * @param {object} params
 */
export function planSellerActions({
  lead = {},
  sellerInput = '',
  intents = [],
  inputMode = SELLER_INPUT_MODE.CLEVER_WORK_INPUT,
  facts = [],
  missingInformation = [],
} = {}) {
  const actions = [];
  const intentTypes = new Set(intents.map((i) => i.type));

  if (intentTypes.has(SELLER_TURN_INTENTS.UPDATE_CUSTOMER_CONTEXT)) {
    actions.push({
      id: 'update_customer_context',
      type: SELLER_TURN_INTENTS.UPDATE_CUSTOMER_CONTEXT,
      label: 'Kundendaten einsortieren',
      needsSellerConfirmation: false,
      status: 'prepared',
      payload: {
        factCount: facts.filter((f) => f.factClass !== 'offer_instruction').length,
      },
    });
  }

  if (intentTypes.has(SELLER_TURN_INTENTS.PREPARE_TRADE_IN)) {
    actions.push({
      id: 'prepare_trade_in',
      type: SELLER_TURN_INTENTS.PREPARE_TRADE_IN,
      label: 'Inzahlungnahme vorbereiten',
      needsSellerConfirmation: true,
      status: 'prepared',
      payload: {
        missing: missingInformation.filter((m) => m.forIntent === SELLER_TURN_INTENTS.PREPARE_TRADE_IN),
      },
    });
  }

  if (intentTypes.has(SELLER_TURN_INTENTS.PREPARE_OFFER)) {
    const offer = runSellerOfferAssist(lead, sellerInput, {});
    actions.push({
      id: 'prepare_offer',
      type: SELLER_TURN_INTENTS.PREPARE_OFFER,
      label: 'Angebot vorbereiten',
      needsSellerConfirmation: true,
      status: offer?.ok ? 'prepared' : 'blocked',
      legacy: offer ?? null,
      payload: {
        canCreateOffer: Boolean(offer?.results?.[0]?.magic?.canCreateOffer),
      },
    });
  }

  if (intentTypes.has(SELLER_TURN_INTENTS.SEND_PORTFOLIO)) {
    actions.push({
      id: 'send_portfolio',
      type: SELLER_TURN_INTENTS.SEND_PORTFOLIO,
      label: 'Kundenlink senden',
      needsSellerConfirmation: true,
      status: 'prepared',
      payload: {
        cta: 'Kundenlink senden',
      },
    });
  }

  if (intentTypes.has(SELLER_TURN_INTENTS.REQUEST_DOCUMENTS)) {
    const pkg = prepareSellerWorkspacePackage(lead, sellerInput);
    actions.push({
      id: 'request_documents',
      type: SELLER_TURN_INTENTS.REQUEST_DOCUMENTS,
      label: 'Unterlagen anfordern',
      needsSellerConfirmation: true,
      status: 'prepared',
      legacy: pkg,
      payload: {
        actionCount: pkg?.actions?.length ?? 0,
      },
    });
  }

  if (intentTypes.has(SELLER_TURN_INTENTS.PROPOSE_APPOINTMENT)
    || intentTypes.has(SELLER_TURN_INTENTS.PREPARE_CALLBACK)) {
    const appointment = runSellerAppointmentAssist(lead, sellerInput, {});
    actions.push({
      id: 'propose_appointment',
      type: SELLER_TURN_INTENTS.PROPOSE_APPOINTMENT,
      label: 'Termin vorbereiten',
      needsSellerConfirmation: true,
      status: appointment?.ok ? 'prepared' : 'blocked',
      legacy: appointment ?? null,
    });
  }

  if (intentTypes.has(SELLER_TURN_INTENTS.LOOKUP_VEHICLE_FACT)) {
    const inline = runSellerInlineAssist(lead, sellerInput);
    actions.push({
      id: 'lookup_vehicle_fact',
      type: SELLER_TURN_INTENTS.LOOKUP_VEHICLE_FACT,
      label: 'Fahrzeugfakt prüfen',
      needsSellerConfirmation: false,
      status: inline?.ok ? 'prepared' : 'blocked',
      legacy: inline ?? null,
    });
  }

  if (
    inputMode === SELLER_INPUT_MODE.CUSTOMER_MESSAGE
    || intentTypes.has(SELLER_TURN_INTENTS.DRAFT_MESSAGE)
  ) {
    const inline = runSellerInlineAssist(lead, sellerInput);
    actions.push({
      id: 'draft_message',
      type: SELLER_TURN_INTENTS.DRAFT_MESSAGE,
      label: 'Nachricht vorbereiten',
      needsSellerConfirmation: true,
      status: 'prepared',
      legacy: inline ?? null,
    });
  }

  return actions;
}

/**
 * Kompakte Assistenten-Antwort (kein JSON im UI).
 */
export function buildSellerAssistantReply({
  facts = [],
  missingInformation = [],
  preparedActions = [],
  inputMode,
} = {}) {
  if (!facts.length && !preparedActions.length) {
    return null;
  }

  const captured = facts
    .filter((f) => !f.needsConfirmation)
    .map((f) => f.label)
    .slice(0, 8);

  const lines = [];
  if (captured.length) {
    lines.push(`Alles klar. Ich habe die Angaben einsortiert: ${captured.join(' · ')}.`);
  } else {
    lines.push('Alles klar – ich habe den Input verstanden.');
  }

  if (missingInformation.length) {
    const labels = missingInformation.slice(0, 2).map((m) => m.label);
    lines.push(`Noch offen: ${labels.join('; ')}.`);
  }

  if (inputMode === SELLER_INPUT_MODE.AMBIGUOUS) {
    lines.push('Soll ich das dem Kunden senden oder nur intern speichern?');
  }

  const confirmActions = preparedActions.filter((a) => a.needsSellerConfirmation);
  if (confirmActions.length) {
    lines.push(`Vorbereitet: ${confirmActions.map((a) => a.label).join(', ')}.`);
  }

  return lines.join('\n\n');
}
