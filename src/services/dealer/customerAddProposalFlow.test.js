/**
 * Tests: Einstieg „Vorschlag hinzufügen“ auf dem Tisch
 */
import assert from 'node:assert/strict';
import {
  PROPOSAL_INTENTS,
  buildAddProposalNavigateContext,
  getProposalIntentBanner,
  getProposalReviewLabel,
  resolveProposalPaymentType,
  shouldForceConfigureFlow,
} from './customerAddProposalFlow.js';
import {
  ADD_VEHICLE_SOURCE,
  isCustomerRecordAddVehicleContext,
} from '../customerAddVehicleFlow.js';

const sampleLead = {
  id: 'lead-1',
  customerId: 'cust-1',
  contact: { name: 'Max Mustermann' },
};

const vehicleCtx = buildAddProposalNavigateContext(sampleLead, {
  proposalIntent: PROPOSAL_INTENTS.VEHICLE,
});
assert.ok(isCustomerRecordAddVehicleContext(vehicleCtx));
assert.equal(vehicleCtx.source, ADD_VEHICLE_SOURCE);
assert.equal(vehicleCtx.proposalIntent, PROPOSAL_INTENTS.VEHICLE);
assert.equal(vehicleCtx.paymentType, null);
assert.equal(getProposalIntentBanner(vehicleCtx), 'Fahrzeugvorschlag vorbereiten');
assert.equal(getProposalReviewLabel(vehicleCtx), 'Fahrzeug konfigurieren');

const selectionCtx = buildAddProposalNavigateContext(sampleLead, {
  proposalIntent: PROPOSAL_INTENTS.SELECTION_GROUP,
});
assert.equal(selectionCtx.proposalIntent, PROPOSAL_INTENTS.SELECTION_GROUP);
assert.equal(getProposalIntentBanner(selectionCtx), 'Clever Auswahl vorbereiten');

const cashCtx = buildAddProposalNavigateContext(sampleLead, {
  proposalIntent: PROPOSAL_INTENTS.CASH,
});
assert.equal(cashCtx.paymentType, 'cash');
assert.equal(getProposalIntentBanner(cashCtx), 'Barangebot vorbereiten – nutzt vorhandenen Kaufpreis-/Rabattpfad');
assert.equal(getProposalReviewLabel(cashCtx), 'Fahrzeug konfigurieren');

assert.equal(shouldForceConfigureFlow({ customerId: 'x', proposalIntent: PROPOSAL_INTENTS.VEHICLE }), true);
assert.equal(shouldForceConfigureFlow({ customerId: 'x', proposalIntent: PROPOSAL_INTENTS.SELECTION_GROUP }), false);
assert.equal(shouldForceConfigureFlow(null), false);

const leasingCtx = buildAddProposalNavigateContext(sampleLead, {
  proposalIntent: PROPOSAL_INTENTS.LEASING,
});
assert.equal(leasingCtx.paymentType, 'leasing');
assert.equal(resolveProposalPaymentType('leasing'), 'leasing');
assert.equal(resolveProposalPaymentType('financing'), 'financing');
assert.equal(resolveProposalPaymentType('cash'), 'cash');
assert.equal(resolveProposalPaymentType('vehicle'), null);

console.log('customerAddProposalFlow.test.js: ok');
