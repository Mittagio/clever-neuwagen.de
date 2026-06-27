/**
 * Showroom Modus – Service-Tests
 */
import assert from 'node:assert/strict';
import {
  applyShowroomCaptureToLead,
  buildShowroomCaptureSummary,
  hasShowroomCaptureContent,
  saveShowroomQuickCapture,
  SHOWROOM_CAPTURE_STATUS,
} from './showroomQuickCaptureService.js';
import { buildCleverActionRecommendation, CLEVER_ACTION_IDS } from '../crm/cleverActionEngine.js';

const capture = {
  autoChipIds: ['towbar', 'bike', 'type_suv'],
  paymentChipIds: ['pay_leasing', 'budget_400'],
  customerChipIds: ['cust_solo', 'cust_dog'],
  note: 'Kunde am Fahrzeug gesprochen, Rückruf gewünscht.',
};

assert.equal(hasShowroomCaptureContent(capture), true);
assert.equal(hasShowroomCaptureContent({}), false);

const summary = buildShowroomCaptureSummary(capture);
assert.ok(summary.some((line) => /Auto:/i.test(line)));
assert.ok(summary.some((line) => /Notiz:/i.test(line)));

const created = saveShowroomQuickCapture({
  capture,
  dealerConditions: { dealerId: 'demo', dealerName: 'Demo Autohaus' },
  getExistingCodes: () => [],
  leads: [],
});
assert.equal(created.ok, true);
assert.equal(created.isNew, true);
assert.equal(created.lead.crm.hasPendingShowroomCapture, true);
assert.equal(created.lead.crm.pendingShowroomCapture.status, SHOWROOM_CAPTURE_STATUS.PENDING);

const appended = saveShowroomQuickCapture({
  capture: { ...capture, note: 'Ergänzt am Hof' },
  existingLead: created.lead,
  dealerConditions: { dealerId: 'demo' },
  getExistingCodes: () => [],
  leads: [created.lead],
});
assert.equal(appended.isNew, false);
assert.ok(appended.leadPatch.crm.pendingShowroomCapture);

const leadWithCapture = {
  ...created.lead,
  crm: {
    ...created.lead.crm,
    hasPendingShowroomCapture: true,
    pendingShowroomCapture: created.capture,
  },
};

const reco = buildCleverActionRecommendation({ lead: leadWithCapture, vehicleCards: [] });
assert.equal(reco.actionId, CLEVER_ACTION_IDS.SHOWROOM_CAPTURE_REVIEW);

const applied = applyShowroomCaptureToLead(leadWithCapture);
assert.equal(applied.ok, true);
assert.equal(applied.leadPatch.crm.hasPendingShowroomCapture, false);
assert.equal(applied.leadPatch.crm.pendingShowroomCapture.status, SHOWROOM_CAPTURE_STATUS.APPLIED);

console.log('showroomQuickCaptureService.test.js: ok');
