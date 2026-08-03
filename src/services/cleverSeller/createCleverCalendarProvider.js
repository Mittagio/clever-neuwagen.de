/**
 * Lokaler Kalender-Stub + Provider-Normalisierung.
 * Kein Google/Microsoft-OAuth – echte Cloud nur über window.__cleverCalendarProvider.
 */

/**
 * @typedef {'available'|'busy'|'unknown'|'error'} CleverCalendarAvailabilityStatus
 */

/**
 * @param {{
 *   busySlots?: Array<{ startsAt?: string, start?: string, endsAt?: string, end?: string }>,
 *   id?: string,
 * }} [options]
 */
export function createLocalCleverCalendarStub(options = {}) {
  const busySlots = Array.isArray(options.busySlots) ? options.busySlots : [];
  const drafts = [];

  return {
    id: options.id || 'local_calendar_stub',
    /**
     * @param {{
     *   startsAt: string,
     *   durationMinutes?: number,
     *   lead?: object,
     *   title?: string,
     * }} ctx
     */
    async checkAvailability(ctx = {}) {
      const startsAt = ctx.startsAt;
      if (!startsAt) {
        return {
          checked: true,
          status: 'unknown',
          available: undefined,
          source: 'local_calendar_stub',
        };
      }
      const start = new Date(startsAt).getTime();
      if (Number.isNaN(start)) {
        return {
          checked: true,
          status: 'error',
          available: false,
          source: 'local_calendar_stub',
          error: 'invalid_startsAt',
        };
      }
      const durationMs = Math.max(1, Number(ctx.durationMinutes) || 60) * 60_000;
      const end = start + durationMs;
      const busy = busySlots.some((slot) => {
        const s = new Date(slot.startsAt || slot.start).getTime();
        if (Number.isNaN(s)) return false;
        const e = slot.endsAt || slot.end
          ? new Date(slot.endsAt || slot.end).getTime()
          : s + 60_000;
        return start < e && end > s;
      });
      return {
        checked: true,
        available: !busy,
        status: busy ? 'busy' : 'available',
        source: 'local_calendar_stub',
      };
    },
    /**
     * Entwurf – nie Auto-Booking.
     * @param {{
     *   startsAt: string,
     *   durationMinutes?: number,
     *   title?: string,
     *   lead?: object,
     * }} ctx
     */
    async createDraftEvent(ctx = {}) {
      const draft = {
        id: `cal_draft_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        startsAt: ctx.startsAt || null,
        durationMinutes: ctx.durationMinutes || 60,
        title: ctx.title || 'Terminentwurf',
        status: 'draft',
        booked: false,
        source: 'local_calendar_stub',
        customerId: ctx.lead?.id || null,
      };
      drafts.push(draft);
      return { ok: true, booked: false, draft };
    },
    /** @internal Test-Helfer */
    _drafts: drafts,
  };
}

/**
 * Function- oder Object-Hook → einheitliches Provider-Objekt.
 * @param {Function|object} raw
 */
export function normalizeCleverCalendarProvider(raw) {
  if (!raw) return null;
  if (typeof raw === 'function') {
    return {
      id: 'window_hook',
      async checkAvailability(ctx = {}) {
        return raw({ ...ctx, action: 'checkAvailability' });
      },
      async createDraftEvent(ctx = {}) {
        return raw({ ...ctx, action: 'createDraftEvent' });
      },
    };
  }
  if (typeof raw === 'object') {
    return {
      id: raw.id || 'window_hook',
      checkAvailability: typeof raw.checkAvailability === 'function'
        ? raw.checkAvailability.bind(raw)
        : null,
      createDraftEvent: typeof raw.createDraftEvent === 'function'
        ? raw.createDraftEvent.bind(raw)
        : null,
    };
  }
  return null;
}
