/**
 * Review-CTA „Kalender prüfen“: Turn mit Availability neu aufbauen.
 * Ohne Provider → null (UI zeigt Stub-Feedback).
 */
import { runCleverSellerTurn } from './runCleverSellerTurn.js';
import { resolveCleverCalendarProvider } from './resolveCleverCalendarProvider.js';
import {
  calendarAvailabilityLabel,
  checkCalendarAvailability,
} from './checkCalendarAvailability.js';
import { getAppointmentDurationMinutes } from '../dealer/sellerAppointmentAssistFlow.js';
import { SELLER_TURN_INTENTS } from './sellerFactTypes.js';

/**
 * @param {{
 *   turn: object,
 *   turnParams: object,
 *   env?: object,
 *   windowRef?: object|null,
 *   calendarProvider?: object|null,
 * }} params
 * @returns {Promise<{
 *   ok: boolean,
 *   providerMissing?: boolean,
 *   turn?: object,
 *   availability?: object|null,
 *   label?: string,
 * }>}
 */
export async function refreshSellerTurnCalendarCheck(params = {}) {
  const previous = params.turn || null;
  const turnParams = params.turnParams || {};
  const provider = params.calendarProvider !== undefined
    ? params.calendarProvider
    : resolveCleverCalendarProvider({
      env: params.env ?? turnParams.env,
      windowRef: params.windowRef,
    });

  if (!provider) {
    return { ok: false, providerMissing: true };
  }

  const appt = previous?.preparedAppointment
    || (previous?.preparedActions || []).find((a) => (
      a.type === SELLER_TURN_INTENTS.PROPOSE_APPOINTMENT
    ))?.payload?.preparedAppointment
    || null;

  if (!appt?.startsAt) {
    return { ok: false, providerMissing: false, availability: null, label: 'Kein Terminvorschlag' };
  }

  const availability = await checkCalendarAvailability({
    provider,
    startsAt: appt.startsAt,
    durationMinutes: appt.durationMinutes
      || getAppointmentDurationMinutes(appt.appointmentType),
    lead: previous?.resolvedCustomer || turnParams.lead || null,
    title: appt.appointmentTypeLabel || null,
    alternativeSlots: appt.alternativeSlots || [],
  });

  const sellerInput = turnParams.sellerInput
    || previous?.interpretedInput?.raw
    || previous?.interpretedInput?.normalized
    || '';

  const turn = runCleverSellerTurn({
    ...turnParams,
    sellerInput,
    calendarAvailability: availability,
    pendingAction: previous?.pendingAction || turnParams.pendingAction || null,
  });

  return {
    ok: true,
    providerMissing: false,
    turn,
    availability,
    label: calendarAvailabilityLabel(availability?.status),
  };
}
