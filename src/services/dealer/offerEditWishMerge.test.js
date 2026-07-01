/**
 * Tests: Wish-Konditionen in Angebots-Bearbeiten übernehmen
 */
import assert from 'node:assert/strict';
import {
  buildOfferEditPendingFields,
  buildWishFieldsFromLead,
  cardNeedsConditionsConfigure,
  enrichOfferEditCardFromLead,
  resolveEffectivePaymentType,
} from './offerEditWishMerge.js';
import { buildAddVehicleContextFromLead } from '../customerAddVehicleFlow.js';
import { buildVehicleOpportunityCards } from '../customerAkte.js';

assert.equal(resolveEffectivePaymentType('unknown', 'leasing', null), 'leasing');
assert.equal(resolveEffectivePaymentType('unknown', null, 'cash'), 'cash');
assert.equal(resolveEffectivePaymentType(null, null), 'unknown');

const lead = {
  id: 'lead-1',
  paymentType: 'leasing',
  desiredRate: 350,
  wish: {
    termMonths: 48,
    mileagePerYear: 50000,
    downPayment: 0,
    paymentType: 'leasing',
  },
  crm: {
    vehicleConfigurations: [{
      id: 'vc-1',
      modelKey: 'sportage',
      paymentType: 'unknown',
      leasingData: {},
    }],
  },
};

const wishFields = buildWishFieldsFromLead(lead);
assert.equal(wishFields.termMonths, 48);
assert.equal(wishFields.mileagePerYear, 50000);
assert.equal(wishFields.desiredRate, 350);

const enriched = enrichOfferEditCardFromLead({
  id: 'vc-1',
  modelKey: 'sportage',
  paymentType: 'unknown',
  configurationId: 'vc-1',
}, lead);
assert.equal(enriched.paymentType, 'leasing');
assert.equal(enriched.termMonths, 48);
assert.equal(enriched.mileagePerYear, 50000);
assert.equal(enriched.desiredRate, 350);

const pending = buildOfferEditPendingFields(enriched, { deliveryNote: 'sofort' });
assert.ok(!pending.some((field) => field.id === 'termMonths'));
assert.ok(!pending.some((field) => field.id === 'mileagePerYear'));
assert.ok(!pending.some((field) => field.id === 'desiredRate'));

const cards = buildVehicleOpportunityCards({
  lead,
  wishFields,
});
assert.equal(cards[0].paymentType, 'leasing');
assert.equal(cards[0].termMonths, 48);

const ctx = buildAddVehicleContextFromLead(lead, { paymentType: 'cash' });
assert.equal(ctx.paymentType, 'cash');
assert.equal(ctx.wishFields.paymentType, 'cash');
assert.equal(ctx.wishFields.termMonths, 48);

assert.equal(cardNeedsConditionsConfigure({ paymentType: 'leasing', desiredRate: null }), true);
assert.equal(cardNeedsConditionsConfigure({ paymentType: 'leasing', desiredRate: 399 }), false);
assert.equal(cardNeedsConditionsConfigure({ paymentType: 'cash', desiredPrice: 25000 }), false);

console.log('offerEditWishMerge.test.js: ok');
