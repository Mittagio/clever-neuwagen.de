/**
 * Tool: create_message – WRITE (Prepare, kein Send)
 */
import { prepareGroundedCustomerMessageSync } from '../../cleverSeller/prepareGroundedCustomerMessageSync.js';
import { deriveContactIdentity } from '../../dealer/customerContactIdentity.js';

export const createMessageToolDef = {
  name: 'create_message',
  kind: 'write',
  description:
    'Bereitet eine Kundennachricht vor (Composer-Draft). Sendet NICHT. '
    + '„schreib ihm …“ = nur Draft. „schick ihm …“ = Draft + suggested send (Confirmation nötig).',
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      instruction: {
        type: 'string',
        description: 'Was die Nachricht erreichen soll.',
      },
      channel: {
        type: ['string', 'null'],
        description: 'email | whatsapp | message',
      },
      tone: { type: ['string', 'null'] },
      intendSend: {
        type: ['boolean', 'null'],
        description: 'true nur bei klarer Sendeabsicht („schick …“). Löst KEINE automatische Sendung aus.',
      },
    },
    required: ['instruction'],
  },
};

export function executeCreateMessage(runtime = {}, args = {}) {
  const lead = runtime.lead || {};
  const instruction = String(args.instruction || '').trim();
  if (!instruction) {
    return { ok: false, error: 'missing_instruction', message: 'Worüber soll die Nachricht gehen?' };
  }

  const identity = deriveContactIdentity(lead?.contact || {}, lead?.name || '');
  const customerName = identity.salutation && identity.lastName
    ? `${identity.salutation} ${identity.lastName}`
    : ([identity.firstName, identity.lastName].filter(Boolean).join(' ') || lead?.contact?.name || null);

  const channelHint = args.channel === 'whatsapp'
    ? 'Schreib eine kurze freundliche WhatsApp-Nachricht. '
    : args.channel === 'email'
      ? 'Schreib eine freundliche E-Mail. '
      : '';

  const sellerInput = `${channelHint}${instruction}`.trim();
  const offerContext = runtime.currentOffer || runtime.workingContext || null;

  const prepared = prepareGroundedCustomerMessageSync({
    sellerInput,
    lead,
    customerName,
    workingContext: runtime.workingContext,
    offerContext: offerContext?.offerId
      ? offerContext
      : (offerContext
        ? {
          offerId: offerContext.offerId || offerContext.id || 'working',
          title: offerContext.title || offerContext.modelName || offerContext.modelLabel,
          monthlyRate: offerContext.monthlyRate,
          termMonths: offerContext.termMonths,
          mileagePerYear: offerContext.mileagePerYear,
          paymentType: offerContext.paymentType,
          summary: offerContext.summary || offerContext.shortLabel,
        }
        : null),
  });

  if (!prepared?.messageDraft) {
    return {
      ok: false,
      status: prepared?.status || 'failed',
      message: prepared?.uiHint?.message
        || 'Die Nachricht konnte noch nicht vorbereitet werden.',
      sendable: false,
    };
  }

  const intendSend = args.intendSend === true
    || /\bschick(?:e|en|t)?\b/i.test(instruction);

  return {
    ok: true,
    status: 'prepared',
    messageDraft: prepared.messageDraft,
    sendable: false,
    confirmationRequired: intendSend,
    channel: args.channel || 'message',
    intendSend,
    mutations: [
      {
        type: 'set_message_draft',
        messageDraft: prepared.messageDraft,
      },
    ],
    artifacts: [
      {
        type: 'message_draft',
        label: 'Nachricht im Composer',
        data: { body: prepared.messageDraft },
      },
    ],
    suggestedActions: intendSend
      ? [
        { action: 'edit_message', label: 'Bearbeiten' },
        { action: 'send_message', label: 'Jetzt senden' },
      ]
      : [
        { action: 'edit_message', label: 'Bearbeiten' },
        { action: 'send_message', label: 'Senden' },
      ],
    message: intendSend
      ? 'Nachricht vorbereitet – Senden erst nach deiner Bestätigung.'
      : 'Nachricht ist vorbereitet und liegt im Composer bereit (noch nicht gesendet).',
  };
}
