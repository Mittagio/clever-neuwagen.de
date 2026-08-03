/**
 * Availability-Check + optionaler Draft-Event-Hook.
 * Propose → Confirm → Action: Entwurf ≠ Buchung.
 */

const STATUSES = new Set(['available', 'busy', 'unknown', 'error']);

/**
 * @param {object|null|undefined} raw
 * @returns {{
 *   checked: boolean,
 *   available?: boolean,
 *   status: 'available'|'busy'|'unknown'|'error',
 *   source: string,
 *   error?: string|null,
 * }}
 */
export function normalizeCalendarAvailabilityResult(raw) {
  if (!raw || typeof raw !== 'object') {
    return {
      checked: true,
      status: 'unknown',
      available: undefined,
      source: 'calendar_provider',
    };
  }

  let status = typeof raw.status === 'string' ? raw.status.trim().toLowerCase() : '';
  if (!STATUSES.has(status)) {
    if (raw.checked === true && raw.available === true) status = 'available';
    else if (raw.checked === true && raw.available === false) status = 'busy';
    else if (raw.error) status = 'error';
    else status = 'unknown';
  }

  const available = status === 'available'
    ? true
    : (status === 'busy' || status === 'error' ? false : undefined);

  return {
    checked: true,
    available,
    status,
    source: raw.source || 'calendar_provider',
    error: raw.error != null ? String(raw.error) : null,
  };
}

/**
 * @param {{
 *   provider: object|null,
 *   startsAt: string,
 *   durationMinutes?: number,
 *   lead?: object,
 *   title?: string,
 *   alternativeSlots?: object[],
 * }} params
 */
export async function checkCalendarAvailability(params = {}) {
  const provider = params.provider;
  const checkFn = typeof provider?.checkAvailability === 'function'
    ? provider.checkAvailability
    : null;
  if (!checkFn) {
    return null;
  }
  if (!params.startsAt) {
    return normalizeCalendarAvailabilityResult({
      status: 'unknown',
      source: provider.id || 'calendar_provider',
    });
  }

  try {
    const raw = await checkFn({
      action: 'checkAvailability',
      startsAt: params.startsAt,
      durationMinutes: params.durationMinutes || 60,
      lead: params.lead || null,
      title: params.title || null,
      alternativeSlots: params.alternativeSlots || [],
    });
    return normalizeCalendarAvailabilityResult({
      ...raw,
      source: raw?.source || provider.id || 'calendar_provider',
    });
  } catch (err) {
    return normalizeCalendarAvailabilityResult({
      status: 'error',
      available: false,
      source: provider.id || 'calendar_provider',
      error: err?.message || String(err),
    });
  }
}

/**
 * Optionaler Draft nach Seller-Confirm – nie Auto-Booking.
 * @param {{
 *   provider: object|null,
 *   appointment?: object|null,
 *   lead?: object,
 * }} params
 */
export async function maybeCreateCalendarDraftEvent(params = {}) {
  const provider = params.provider;
  const createFn = typeof provider?.createDraftEvent === 'function'
    ? provider.createDraftEvent
    : null;
  const appt = params.appointment;
  if (!createFn || !appt?.startsAt) {
    return { ok: false, skipped: true, booked: false, draft: null };
  }

  try {
    const raw = await createFn({
      action: 'createDraftEvent',
      startsAt: appt.startsAt,
      durationMinutes: appt.durationMinutes || 60,
      title: [
        appt.appointmentTypeLabel || 'Termin',
        appt.customerName || params.lead?.contact?.name || params.lead?.name || null,
      ].filter(Boolean).join(' · '),
      lead: params.lead || null,
      appointment: appt,
      status: 'draft',
    });
    return {
      ok: Boolean(raw?.ok !== false && (raw?.draft || raw?.ok)),
      skipped: false,
      booked: false,
      draft: raw?.draft || null,
      error: raw?.error || null,
    };
  } catch (err) {
    return {
      ok: false,
      skipped: false,
      booked: false,
      draft: null,
      error: err?.message || String(err),
    };
  }
}

/**
 * DE-Label für Review / Feedback.
 * @param {string} status
 */
export function calendarAvailabilityLabel(status) {
  switch (String(status || '')) {
    case 'available': return 'Verfügbar';
    case 'busy': return 'Belegt';
    case 'unknown': return 'Unbekannt';
    case 'error': return 'Prüfung fehlgeschlagen';
    case 'seller_claimed': return 'Noch nicht geprüft (Seller-Angabe)';
    case 'not_checked':
    default: return 'Noch nicht geprüft';
  }
}
