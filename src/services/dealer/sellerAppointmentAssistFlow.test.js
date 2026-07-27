/**
 * node src/services/dealer/sellerAppointmentAssistFlow.test.js
 */
import assert from 'node:assert/strict';
import {
  APPOINTMENT_STATUS,
  APPOINTMENT_TYPES,
  applyCustomerAppointmentReplyToLead,
  buildCrmPatchFromAppointment,
  detectAppointmentType,
  detectCustomerAppointmentReply,
  parseAppointmentDateTime,
  runSellerAppointmentAssist,
} from './sellerAppointmentAssistFlow.js';
import { detectSellerActionIntent, SELLER_ACTION_INTENTS } from './sellerActionIntent.js';
import { INLINE_RESULT_TYPES } from './sellerInlineComposerAssist.js';

assert.equal(
  detectSellerActionIntent('Probefahrt am 02.08.2026 um 15 Uhr vorschlagen.'),
  SELLER_ACTION_INTENTS.PROPOSE_APPOINTMENT,
);
assert.equal(
  detectSellerActionIntent('Ruf ihn morgen um 10 Uhr an.'),
  SELLER_ACTION_INTENTS.PREPARE_CALLBACK,
);

assert.equal(detectAppointmentType('Probefahrt anbieten'), APPOINTMENT_TYPES.TEST_DRIVE);
assert.equal(detectAppointmentType('Rückruf morgen'), APPOINTMENT_TYPES.CALLBACK);

const now = new Date(2026, 6, 22, 11, 0, 0);
const parsed = parseAppointmentDateTime('02.08.2026 um 15 Uhr', now);
assert.ok(parsed.startAt);
assert.equal(new Date(parsed.startAt).getHours(), 15);
assert.equal(new Date(parsed.startAt).getDate(), 2);
assert.equal(new Date(parsed.startAt).getMonth(), 7);

const missing = parseAppointmentDateTime('Probefahrt anbieten', now);
assert.equal(missing.missing, 'datetime');

const lead = {
  id: 'lead-notz',
  name: 'Herr Notz',
  vehicle: { model: 'EV3', trim: 'GT-Line' },
  crm: { needProfile: { selectedModelKey: 'ev3' } },
};

const askWhen = runSellerAppointmentAssist(lead, 'Probefahrt anbieten.');
assert.ok(askWhen?.ok);
assert.equal(askWhen.results[0].type, INLINE_RESULT_TYPES.APPOINTMENT_DRAFT);
assert.ok(/wann/i.test(askWhen.results[0].body));
assert.ok(askWhen.results[0].choices?.length >= 2);

const propose = runSellerAppointmentAssist(
  lead,
  'Herrn Notz am 02.08.2026 um 15 Uhr Probefahrt anbieten.',
);
assert.ok(propose?.ok);
assert.equal(propose.appointment.type, APPOINTMENT_TYPES.TEST_DRIVE);
assert.match(propose.results[0].messageBody || '', /Probefahrt/);
assert.match(propose.results[0].messageBody || '', /15/);
assert.equal(propose.results[0].primaryCta, 'Vorschlag senden');

const proposedAppt = {
  ...propose.appointment,
  status: APPOINTMENT_STATUS.PROPOSED,
};
const confirmReply = detectCustomerAppointmentReply('Ja, passt.', proposedAppt);
assert.equal(confirmReply.kind, 'confirm');

const withProposed = {
  ...lead,
  crm: { ...lead.crm, cleverAppointment: proposedAppt },
};
const applied = applyCustomerAppointmentReplyToLead(withProposed, 'Ja, passt.');
assert.equal(
  applied.lead.crm.cleverAppointment.status,
  APPOINTMENT_STATUS.CUSTOMER_CONFIRMED,
);

const proposePatch = buildCrmPatchFromAppointment(propose.appointment, { markProposed: true });
assert.equal(proposePatch.cleverAppointment.status, APPOINTMENT_STATUS.PROPOSED);
assert.equal(proposePatch.followUpAt, undefined);

const schedulePatch = buildCrmPatchFromAppointment(propose.appointment, { markScheduled: true });
assert.equal(schedulePatch.cleverAppointment.status, APPOINTMENT_STATUS.SCHEDULED);
assert.ok(schedulePatch.followUpAt);
assert.ok(schedulePatch.testDriveScheduledAt);

const callback = runSellerAppointmentAssist(lead, 'Ruf ihn morgen um 10 Uhr an.');
assert.ok(callback?.ok);
assert.equal(callback.appointment.type, APPOINTMENT_TYPES.CALLBACK);
assert.equal(callback.results[0].canScheduleNow, true);
assert.equal(callback.results[0].messageBody, null);

console.log('sellerAppointmentAssistFlow.test.js: ok');
