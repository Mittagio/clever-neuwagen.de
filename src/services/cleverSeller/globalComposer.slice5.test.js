/**
 * Slice 5: Kontextbezogene Terminvorschläge + Kundennachricht
 * node --test src/services/cleverSeller/globalComposer.slice5.test.js
 */
import assert from 'node:assert/strict';
import { runCleverSellerTurn } from './runCleverSellerTurn.js';
import { interpretSellerInput } from './interpretSellerInput.js';
import { SELLER_TURN_INTENTS } from './sellerFactTypes.js';
import {
  buildUniversalReviewModel,
  shouldShowUniversalReview,
} from './buildUniversalReviewModel.js';
import { resolveRelativeDateTime } from './resolveRelativeDateTime.js';
import { resolveAppointmentCustomerContext } from './resolveAppointmentCustomerContext.js';
import { prepareContextualAppointmentProposal } from './prepareContextualAppointmentProposal.js';
import { APPOINTMENT_TYPES, detectAppointmentType } from '../dealer/sellerAppointmentAssistFlow.js';
import { COMPOSER_MODES } from '../crm/composerMode.js';
import { containsSellerCommandInMessage } from './validateSellerCommandMessage.js';

const NOW = new Date('2026-07-31T10:00:00+02:00'); // Freitag
const GOLDEN = 'Schlag ihm Montag um 15 Uhr einen Termin vor.';

function createGarritanoLead(overrides = {}) {
  return {
    id: 'lead-demo-garritano',
    name: 'Herr Garritano',
    contact: { name: 'Herr Garritano' },
    vehicle: { model: 'Picanto', trim: 'GT-Line' },
    crm: { needProfile: { labels: [] } },
    ...overrides,
  };
}

const garritano = createGarritanoLead();
const picantoWorking = [{
  id: 'wc-picanto',
  kind: 'vehicle',
  label: 'Kia Picanto GT-Line',
  shortLabel: 'Picanto GT-Line',
  model: 'Picanto',
  trim: 'GT-Line',
  customerId: garritano.id,
}];

// --- Relative Date Resolution ---
{
  const dt = resolveRelativeDateTime('Montag um 15 Uhr', { now: NOW });
  assert.equal(dt.ok, true);
  const d = new Date(dt.startsAt);
  assert.equal(d.getFullYear(), 2026);
  assert.equal(d.getMonth(), 7); // August
  assert.equal(d.getDate(), 3);
  assert.equal(d.getHours(), 15);
  assert.equal(d.getMinutes(), 0);
  assert.equal(dt.timeZone, 'Europe/Berlin');
  assert.equal(dt.source, 'deterministic_datetime_resolver');
}

// --- Pronoun / Customer Resolution ---
{
  const withLead = resolveAppointmentCustomerContext({
    sellerInput: GOLDEN,
    lead: garritano,
  });
  assert.equal(withLead.resolved, true);
  assert.equal(withLead.source, 'current_customer');
  assert.equal(withLead.usedPronoun, true);

  const none = resolveAppointmentCustomerContext({
    sellerInput: GOLDEN,
    lead: {},
    leadsSnapshot: [],
  });
  assert.equal(none.resolved, false);
  assert.match(none.question, /welchen Kunden/i);
}

// --- Appointment type: no invented test drive ---
{
  assert.equal(detectAppointmentType(GOLDEN), APPOINTMENT_TYPES.SHOWROOM_VISIT);
  assert.equal(
    detectAppointmentType('Biete ihm Montag um 15 Uhr eine Probefahrt mit dem XCeed an.'),
    APPOINTMENT_TYPES.TEST_DRIVE,
  );
}

// --- Intents ---
{
  const interpreted = interpretSellerInput(GOLDEN);
  const types = interpreted.intents.map((i) => i.type);
  assert.ok(types.includes(SELLER_TURN_INTENTS.PROPOSE_APPOINTMENT));
  assert.ok(types.includes(SELLER_TURN_INTENTS.RESOLVE_CUSTOMER_CONTEXT));
  assert.ok(types.includes(SELLER_TURN_INTENTS.RESOLVE_RELATIVE_DATETIME));
  assert.ok(types.includes(SELLER_TURN_INTENTS.DRAFT_MESSAGE));
}

// --- Gegenprobe A: kein Kunde ---
{
  const turn = runCleverSellerTurn({
    lead: {},
    sellerInput: GOLDEN,
    leadsSnapshot: [],
    now: NOW,
    scopeHint: 'dashboard',
  });
  assert.ok((turn.missingInformation || []).some((m) => (
    m.id === 'clarify_customer_for_appointment' || m.id === 'clarify_customer'
  )));
  assert.ok(!turn.preparedActions.some((a) => (
    a.type === SELLER_TURN_INTENTS.PROPOSE_APPOINTMENT && a.status === 'prepared'
  )));
  assert.equal(turn.autoSent, false);
  assert.equal(turn.autoBooked, false);
}

// --- Gegenprobe B: Kunde ohne Fahrzeug → Showroom, keine Probefahrt ---
{
  const turn = runCleverSellerTurn({
    lead: createGarritanoLead({ vehicle: null }),
    sellerInput: 'Schlag ihm Montag 15 Uhr vor.',
    now: NOW,
  });
  const appt = turn.preparedAppointment || turn.preparedActions
    .find((a) => a.type === SELLER_TURN_INTENTS.PROPOSE_APPOINTMENT)?.payload?.preparedAppointment;
  assert.ok(appt);
  assert.equal(appt.appointmentType, APPOINTMENT_TYPES.SHOWROOM_VISIT);
  assert.equal(appt.availabilityStatus, 'not_checked');
  const body = typeof turn.messageDraft === 'string' ? turn.messageDraft : turn.messageDraft?.body;
  assert.ok(body);
  assert.doesNotMatch(body, /Probefahrt/i);
  assert.doesNotMatch(body, /bestätigt|eingetragen|reserviert/i);
}

// --- Golden Turn mit Working Context ---
{
  const before = JSON.stringify(garritano);
  const turn = runCleverSellerTurn({
    lead: garritano,
    sellerInput: GOLDEN,
    workingContextItems: picantoWorking,
    now: NOW,
    scopeHint: 'customer',
  });
  assert.equal(JSON.stringify(garritano), before);
  assert.equal(turn.proposedUpdates?.length || 0, 0);
  assert.equal(turn.autoSent, false);
  assert.equal(turn.autoBooked, false);
  assert.ok(turn.resolvedCustomer?.id === garritano.id);
  assert.ok(turn.resolvedDateTime?.ok);
  assert.equal(new Date(turn.resolvedDateTime.startsAt).getDate(), 3);
  assert.equal(new Date(turn.resolvedDateTime.startsAt).getHours(), 15);

  const appt = turn.preparedAppointment;
  assert.ok(appt);
  assert.equal(appt.status, 'proposed');
  assert.equal(appt.needsSellerConfirmation, true);
  assert.equal(appt.availabilityStatus, 'not_checked');
  assert.equal(appt.appointmentType, APPOINTMENT_TYPES.SHOWROOM_VISIT);
  assert.match(String(appt.vehicleContext?.label || ''), /Picanto/i);

  const body = typeof turn.messageDraft === 'string' ? turn.messageDraft : turn.messageDraft?.body;
  assert.ok(body);
  assert.match(body, /Garritano/i);
  assert.match(body, /15:00|15 Uhr/i);
  assert.match(body, /August|03\.08|3\. August/i);
  assert.match(body, /Picanto/i);
  assert.doesNotMatch(body, /bestätigt|eingetragen|reserviert/i);
  assert.equal(containsSellerCommandInMessage(body), false);

  assert.ok(shouldShowUniversalReview(turn));
  const review = buildUniversalReviewModel(turn);
  assert.equal(review.reviewType, 'appointment_and_message_review');
  assert.ok(review.actionSections.some((s) => s.kind === 'appointment_and_message_review'));
  assert.ok(turn.uiEffects?.progressLines?.some((l) => /Kalender noch nicht geprüft/i.test(l)));
  assert.ok(turn.pendingAction?.preparedAppointment);
  assert.equal(turn.handoffWorkingContext?.composerMode, COMPOSER_MODES.CUSTOMER_MESSAGE_EDIT);
}

// --- Gegenprobe C: Probefahrt XCeed ---
{
  const turn = runCleverSellerTurn({
    lead: garritano,
    sellerInput: 'Biete ihm Montag um 15 Uhr eine Probefahrt mit dem XCeed an.',
    now: NOW,
  });
  const appt = turn.preparedAppointment;
  assert.equal(appt.appointmentType, APPOINTMENT_TYPES.TEST_DRIVE);
  assert.match(String(appt.vehicleContext?.label || ''), /XCeed|xceed/i);
  assert.equal(appt.availabilityStatus, 'not_checked');
  const body = typeof turn.messageDraft === 'string' ? turn.messageDraft : turn.messageDraft?.body;
  assert.match(body, /Probefahrt/i);
  assert.doesNotMatch(body, /frei|reserviert|eingetragen/i);
}

// --- Gegenprobe D: Seller sagt frei ≠ Kalenderprüfung ---
{
  const prepared = prepareContextualAppointmentProposal({
    sellerInput: 'Montag 15 Uhr ist frei. Schlag ihm den Termin vor.',
    lead: garritano,
    now: NOW,
    sellerClaimsAvailable: true,
  });
  assert.equal(prepared.availabilityStatus, 'seller_claimed');
  assert.ok(prepared.warnings.some((w) => /seller_claim/i.test(w)));
  assert.notEqual(prepared.availabilityStatus, 'available');
}

// --- Gegenprobe E: direkt eintragen ohne Zusage ---
{
  const turn = runCleverSellerTurn({
    lead: garritano,
    sellerInput: 'Trag Montag 15 Uhr direkt ein.',
    now: NOW,
  });
  assert.ok(
    turn.preparedActions.some((a) => a.payload?.status === 'needs_customer_confirmation_first')
    || (turn.warnings || []).some((w) => /acceptance|zusage|nicht blind/i.test(String(w))),
  );
  assert.equal(turn.autoBooked, false);
}

// --- Follow-up: lieber 16 Uhr ---
{
  const first = runCleverSellerTurn({
    lead: garritano,
    sellerInput: GOLDEN,
    workingContextItems: picantoWorking,
    now: NOW,
  });
  const second = runCleverSellerTurn({
    lead: garritano,
    sellerInput: 'Lieber 16 Uhr.',
    workingContextItems: picantoWorking,
    pendingAction: first.pendingAction,
    now: NOW,
  });
  const appt = second.preparedAppointment;
  assert.ok(appt);
  assert.equal(new Date(appt.startsAt).getHours(), 16);
  assert.equal(new Date(appt.startsAt).getDate(), 3);
  const body = typeof second.messageDraft === 'string' ? second.messageDraft : second.messageDraft?.body;
  assert.match(body, /16:00|16 Uhr/i);
}

// --- Follow-up: dann Dienstag (Uhrzeit behalten) ---
{
  const pending = {
    type: SELLER_TURN_INTENTS.PROPOSE_APPOINTMENT,
    preparedAppointment: {
      startsAt: new Date('2026-08-03T16:00:00+02:00').toISOString(),
      appointmentType: APPOINTMENT_TYPES.SHOWROOM_VISIT,
      availabilityStatus: 'not_checked',
      vehicleContext: { model: 'Picanto', trim: 'GT-Line', label: 'Kia Picanto GT-Line' },
      messageDraft: 'Hallo',
    },
  };
  const turn = runCleverSellerTurn({
    lead: garritano,
    sellerInput: 'Dann Dienstag.',
    pendingAction: pending,
    now: NOW,
  });
  const appt = turn.preparedAppointment;
  assert.ok(appt);
  assert.equal(new Date(appt.startsAt).getDay(), 2); // Dienstag
  assert.equal(new Date(appt.startsAt).getHours(), 16);
}

// --- Zwei Vorschläge ---
{
  const prepared = prepareContextualAppointmentProposal({
    sellerInput: 'Biete Montag und Dienstag um 15 Uhr an.',
    lead: garritano,
    now: NOW,
  });
  assert.ok((prepared.resolvedDateTimes || []).length >= 2);
  assert.match(prepared.messageDraft, /Montag|Dienstag/i);
  assert.equal(prepared.preparedAppointment.bookable, false);
}

// --- Message Edit Handoff / kein Doppel-Composer Guard ---
{
  const turn = runCleverSellerTurn({
    lead: garritano,
    sellerInput: GOLDEN,
    workingContextItems: picantoWorking,
    now: NOW,
  });
  assert.equal(turn.handoffWorkingContext.composerMode, COMPOSER_MODES.CUSTOMER_MESSAGE_EDIT);
  function shouldShowGlobal(pathname) {
    const path = String(pathname).split('?')[0];
    return path === '/backend' || path === '/backend/';
  }
  assert.equal(shouldShowGlobal('/backend'), true);
  assert.equal(shouldShowGlobal('/backend/kundenakte/lead-demo-garritano'), false);
}

// --- Globale Suche: Schlag Garritano … ---
{
  const turn = runCleverSellerTurn({
    lead: {},
    sellerInput: 'Schlag Garritano Montag um 15 Uhr einen Termin zum Picanto an.',
    leadsSnapshot: [garritano],
    workingContextItems: picantoWorking,
    now: NOW,
    scopeHint: 'dashboard',
  });
  assert.ok(turn.resolvedCustomer?.id === garritano.id);
  assert.ok(turn.preparedAppointment?.startsAt);
  assert.equal(turn.autoSent, false);
}

// --- Echte Availability-Abfrage ---
{
  const prepared = prepareContextualAppointmentProposal({
    sellerInput: GOLDEN,
    lead: garritano,
    now: NOW,
    calendarAvailability: { checked: true, available: true, source: 'calendar_check' },
  });
  assert.equal(prepared.availabilityStatus, 'available');
}

console.log('globalComposer.slice5.test.js: ok');
