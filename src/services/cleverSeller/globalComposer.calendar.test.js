/**
 * Kalender Availability / Draft-Hook (schlank)
 * node --test src/services/cleverSeller/globalComposer.calendar.test.js
 */
import assert from 'node:assert/strict';
import {
  runCleverSellerTurn,
  runCleverSellerTurnWithCalendar,
} from './runCleverSellerTurn.js';
import {
  isCleverCalendarEnabled,
  resolveCleverCalendarProvider,
} from './resolveCleverCalendarProvider.js';
import { createLocalCleverCalendarStub } from './createCleverCalendarProvider.js';
import {
  calendarAvailabilityLabel,
  checkCalendarAvailability,
  maybeCreateCalendarDraftEvent,
  normalizeCalendarAvailabilityResult,
} from './checkCalendarAvailability.js';
import { refreshSellerTurnCalendarCheck } from './refreshSellerTurnCalendarCheck.js';
import { buildUniversalReviewModel } from './buildUniversalReviewModel.js';
import { createBrandesGoldenCaseLead } from '../crm/brandesGoldenCase.js';
import { applyAcceptedSellerTurn } from './applyAcceptedSellerTurn.js';

const NOW = new Date('2026-07-31T10:00:00+02:00'); // Freitag → Montag 03.08.2026
const GOLDEN = 'Schlag ihm Montag um 15 Uhr einen Termin vor.';

const brandes = createBrandesGoldenCaseLead({ phase: 'golden' });

// --- Feature flag ---
{
  assert.equal(isCleverCalendarEnabled({ VITE_CLEVER_CALENDAR: 'true' }), true);
  assert.equal(isCleverCalendarEnabled({ CLEVER_CALENDAR: '1' }), true);
  assert.equal(isCleverCalendarEnabled({ VITE_CLEVER_CALENDAR: 'false' }), false);
  assert.equal(isCleverCalendarEnabled({}), false);
}

// --- Flag aus → null Provider → not_checked (Brandes Montag 15 Uhr) ---
{
  const provider = resolveCleverCalendarProvider({
    env: { VITE_CLEVER_CALENDAR: 'false' },
    windowRef: {},
  });
  assert.equal(provider, null);

  const turn = await runCleverSellerTurnWithCalendar({
    lead: brandes,
    sellerInput: GOLDEN,
    now: NOW,
    env: { VITE_CLEVER_CALENDAR: 'false' },
    windowRef: {},
  });
  assert.ok(turn.preparedAppointment?.startsAt);
  assert.equal(turn.preparedAppointment.availabilityStatus, 'not_checked');
  assert.equal(turn.preparedAppointment.bookable, false);
  assert.equal(Boolean(turn.autoBooked), false);
  const review = turn.reviewModel || buildUniversalReviewModel(turn);
  const apptSec = (review?.actionSections || []).find((s) => (
    s.kind === 'appointment_and_message_review'
  ));
  const calendarText = String(
    apptSec?.appointmentReview?.calendarLabel || apptSec?.body || '',
  );
  assert.match(calendarText, /noch nicht gepr/i);
}

// --- window.__cleverCalendarProvider hat Vorrang (auch ohne Flag) ---
{
  const mock = {
    id: 'mock_outlook',
    async checkAvailability() {
      return { status: 'available', checked: true, available: true, source: 'mock_outlook' };
    },
    async createDraftEvent({ startsAt }) {
      return {
        ok: true,
        booked: false,
        draft: { id: 'draft-1', startsAt, status: 'draft' },
      };
    },
  };
  const provider = resolveCleverCalendarProvider({
    env: { VITE_CLEVER_CALENDAR: 'false' },
    windowRef: { __cleverCalendarProvider: mock },
  });
  assert.equal(provider.id, 'mock_outlook');

  const turn = await runCleverSellerTurnWithCalendar({
    lead: brandes,
    sellerInput: GOLDEN,
    now: NOW,
    env: { VITE_CLEVER_CALENDAR: 'false' },
    calendarProvider: provider,
  });
  assert.equal(turn.preparedAppointment.availabilityStatus, 'available');
  assert.equal(turn.preparedAppointment.bookable, false);
  const review = turn.reviewModel || buildUniversalReviewModel(turn);
  const apptSec = (review?.actionSections || []).find((s) => (
    s.kind === 'appointment_and_message_review'
  ));
  const calendarText = String(
    apptSec?.appointmentReview?.calendarLabel || apptSec?.body || '',
  );
  assert.match(calendarText, /Verf[uü]gbar/i);
  assert.ok((turn.uiEffects?.progressLines || []).some((l) => /Kalender:\s*verfügbar/i.test(l)));
}

// --- Mock busy ---
{
  const busyProvider = {
    async checkAvailability() {
      return { status: 'busy', available: false, source: 'mock' };
    },
  };
  const turn = await runCleverSellerTurnWithCalendar({
    lead: brandes,
    sellerInput: GOLDEN,
    now: NOW,
    calendarProvider: busyProvider,
  });
  assert.equal(turn.preparedAppointment.availabilityStatus, 'busy');
  assert.ok((turn.preparedAppointment.warnings || turn.preparedActions
    ?.find((a) => a.id === 'propose_appointment')?.payload?.warnings || [])
    .some?.((w) => w === 'calendar_slot_busy')
    || (turn.preparedActions || []).some((a) => (
      a.payload?.warnings?.includes('calendar_slot_busy')
    )));
}

// --- Local stub mit busySlots ---
{
  const monday15 = new Date('2026-08-03T15:00:00+02:00').toISOString();
  const stub = createLocalCleverCalendarStub({
    busySlots: [{ startsAt: monday15, endsAt: new Date('2026-08-03T16:00:00+02:00').toISOString() }],
  });
  const hit = await checkCalendarAvailability({
    provider: stub,
    startsAt: monday15,
    durationMinutes: 60,
  });
  assert.equal(hit.status, 'busy');

  const free = await checkCalendarAvailability({
    provider: stub,
    startsAt: new Date('2026-08-03T17:00:00+02:00').toISOString(),
    durationMinutes: 60,
  });
  assert.equal(free.status, 'available');
}

// --- Flag an ohne Hook → Local-Stub (available) ---
{
  const turn = await runCleverSellerTurnWithCalendar({
    lead: brandes,
    sellerInput: GOLDEN,
    now: NOW,
    env: { VITE_CLEVER_CALENDAR: 'true' },
    windowRef: {},
  });
  assert.equal(turn.preparedAppointment.availabilityStatus, 'available');
}

// --- Function-Hook + error/unknown normalize ---
{
  assert.equal(normalizeCalendarAvailabilityResult({ checked: true, available: true }).status, 'available');
  assert.equal(normalizeCalendarAvailabilityResult({ status: 'unknown' }).status, 'unknown');
  assert.equal(normalizeCalendarAvailabilityResult({ error: 'boom' }).status, 'error');
  assert.equal(calendarAvailabilityLabel('error'), 'Prüfung fehlgeschlagen');

  const fnProvider = async ({ action }) => {
    if (action === 'checkAvailability') return { status: 'unknown' };
    return { ok: true, booked: false, draft: { id: 'd2', status: 'draft' } };
  };
  const provider = resolveCleverCalendarProvider({
    windowRef: { __cleverCalendarProvider: fnProvider },
    env: {},
  });
  const avail = await checkCalendarAvailability({
    provider,
    startsAt: new Date('2026-08-03T15:00:00+02:00').toISOString(),
  });
  assert.equal(avail.status, 'unknown');
}

// --- Review-CTA refresh ---
{
  const first = runCleverSellerTurn({
    lead: brandes,
    sellerInput: GOLDEN,
    now: NOW,
  });
  assert.equal(first.preparedAppointment.availabilityStatus, 'not_checked');

  const refreshed = await refreshSellerTurnCalendarCheck({
    turn: first,
    turnParams: { lead: brandes, now: NOW },
    calendarProvider: {
      async checkAvailability() {
        return { status: 'available', source: 'cta_mock' };
      },
    },
  });
  assert.equal(refreshed.ok, true);
  assert.equal(refreshed.turn.preparedAppointment.availabilityStatus, 'available');
  assert.equal(refreshed.label, 'Verfügbar');
}

// --- Confirm: Persist wie bisher + Draft ≠ Booking ---
{
  const provider = createLocalCleverCalendarStub();
  const turn = await runCleverSellerTurnWithCalendar({
    lead: brandes,
    sellerInput: GOLDEN,
    now: NOW,
    calendarProvider: provider,
  });
  assert.equal(turn.preparedAppointment.bookable, false);

  const applied = applyAcceptedSellerTurn(brandes, turn, { postFeedCard: true });
  assert.equal(applied.ok, true);
  assert.ok(applied.lead?.crm?.cleverAppointment || applied.ok);

  const draft = await maybeCreateCalendarDraftEvent({
    provider,
    appointment: turn.preparedAppointment,
    lead: applied.lead,
  });
  assert.equal(draft.ok, true);
  assert.equal(draft.booked, false);
  assert.equal(draft.draft.status, 'draft');
  assert.notEqual(draft.draft.status, 'scheduled');
}

console.log('globalComposer.calendar.test.js: ok');
