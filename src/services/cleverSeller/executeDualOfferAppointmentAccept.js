/**
 * Slice 15: Dual-Accept für Angebot + Terminvorschlag.
 * Expliziter Seller-Klick – kein Auto-Send, kein Auto-Book.
 */

export const DUAL_PENDING_TYPE = 'offer_and_appointment';

/**
 * @param {object} [params]
 * @param {object} [params.lead]
 * @param {object} [params.turn]
 * @returns {{
 *   ok: boolean,
 *   reason?: string,
 *   autoSent: boolean,
 *   autoBooked: boolean,
 *   leadId: string|null,
 *   handoffWorkingContext: object|null,
 *   pendingAction: object|null,
 *   messageDraft: string|null,
 *   acceptedActions: string[],
 * }}
 */
export function executeDualOfferAppointmentAccept({ lead = null, turn = null } = {}) {
  const pending = turn?.pendingAction || null;
  const offerAction = turn?.preparedActions?.find((a) => (
    a.type === 'prepare_offer' && a.status === 'prepared' && !a.payload?.updateOnly
  ));
  const apptAction = turn?.preparedActions?.find((a) => (
    a.type === 'propose_appointment' && a.status === 'prepared'
  ));
  const preparedAppointment = pending?.preparedAppointment
    || apptAction?.payload?.preparedAppointment
    || turn?.preparedAppointment
    || null;
  const preparedOffer = pending?.preparedOffer
    || offerAction?.payload?.preparedOffer
    || null;

  const isDual = pending?.type === DUAL_PENDING_TYPE
    || Boolean(preparedOffer && preparedAppointment)
    || Boolean(offerAction && apptAction && preparedAppointment);

  if (!isDual) {
    return {
      ok: false,
      reason: 'not_dual_prepare',
      autoSent: false,
      autoBooked: false,
      leadId: null,
      handoffWorkingContext: null,
      pendingAction: pending,
      messageDraft: null,
      acceptedActions: [],
    };
  }

  const leadId = lead?.id
    || turn?.resolvedCustomer?.id
    || preparedAppointment?.customerId
    || preparedOffer?.customerId
    || null;

  const messageDraft = typeof turn?.messageDraft === 'string'
    ? turn.messageDraft
    : (turn?.messageDraft?.body
      || pending?.messageDraft
      || apptAction?.payload?.messageDraft
      || null);

  return {
    ok: true,
    autoSent: false,
    autoBooked: false,
    leadId,
    handoffWorkingContext: turn?.handoffWorkingContext || null,
    pendingAction: pending?.type === DUAL_PENDING_TYPE
      ? pending
      : {
        type: DUAL_PENDING_TYPE,
        customerId: leadId,
        preparedOffer,
        preparedAppointment,
        messageDraft,
        needsSellerConfirmation: true,
        createdAt: pending?.createdAt || new Date().toISOString(),
      },
    messageDraft,
    acceptedActions: ['prepare_offer', 'propose_appointment'],
  };
}
