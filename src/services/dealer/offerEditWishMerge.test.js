/**
 * Tests: Wish-Konditionen in Angebots-Bearbeiten übernehmen
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildOfferEditPendingFields,
  buildWishFieldsFromLead,
  cardNeedsConditionsConfigure,
  enrichOfferEditCardFromLead,
  hasCalculatedOfferOnCard,
  resolveEffectivePaymentType,
  shouldNavigateToOfferCalculator,
} from './offerEditWishMerge.js';
import { buildAddVehicleContextFromLead } from '../customerAddVehicleFlow.js';
import { buildVehicleOpportunityCards } from '../customerAkte.js';
import { BOARD_OFFER_STATUS, buildBoardOfferFromDraft } from './boardOfferModel.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const conditionsSource = readFileSync(
  join(__dirname, '../../components/dealer-ai/DealerAiConditionsStep.jsx'),
  'utf8',
);
const conditionsPreviewSource = readFileSync(
  join(__dirname, '../configuration/conditionsStepPreview.js'),
  'utf8',
);

assert.equal(resolveEffectivePaymentType('unknown', 'leasing', null), 'leasing');
assert.equal(resolveEffectivePaymentType('unknown', null, 'cash'), 'cash');
assert.equal(resolveEffectivePaymentType('cash', 'leasing', 'leasing'), 'cash');
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
assert.equal(enriched.wishBudgetRate, 350);
assert.equal(enriched.desiredRate, null);

const pending = buildOfferEditPendingFields(enriched, { deliveryNote: 'sofort' });
assert.ok(!pending.some((field) => field.id === 'termMonths'));
assert.ok(!pending.some((field) => field.id === 'mileagePerYear'));
assert.ok(pending.some((field) => field.id === 'desiredRate'));

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

// Kundenwunsch-Budget ≠ fertiges Angebot
assert.equal(cardNeedsConditionsConfigure({ paymentType: 'leasing', desiredRate: 399 }), true);
assert.equal(cardNeedsConditionsConfigure({ paymentType: 'leasing', desiredRate: null }), true);
assert.equal(hasCalculatedOfferOnCard({ id: 'vc-1', configurationId: 'vc-1' }, lead), false);

const offerDraft = {
  vehicle: { brand: 'Kia', model: 'EV3', modelKey: 'ev3', trimLabel: 'Earth', selectedPackages: [], selectedEquipmentFeatures: [] },
  payment: { type: 'leasing', termMonths: 48, mileagePerYear: 10000, downPayment: 0, calculatedRate: 359, listPrice: 51990 },
  customer: { name: 'Test' },
  timing: {},
  source: { parsedFields: {}, createdFrom: 'customer_akte', originalText: '' },
};

const createdLead = {
  id: 'lead-created',
  crm: {
    vehicleConfigurations: [{
      id: 'vc-ev3',
      modelKey: 'ev3',
      model: 'EV3',
      paymentType: 'leasing',
      leasingData: { termMonths: 48, mileagePerYear: 10000, downPayment: 0, calculatedRate: 359 },
      boardOffer: buildBoardOfferFromDraft(offerDraft, { configId: 'vc-ev3' }),
    }],
  },
};

const createdCards = buildVehicleOpportunityCards({ lead: createdLead });
assert.equal(hasCalculatedOfferOnCard(createdCards[0], createdLead), true);
assert.equal(shouldNavigateToOfferCalculator(createdCards[0], createdLead), true);
assert.equal(cardNeedsConditionsConfigure(createdCards[0], createdLead), true);

const draftLead = {
  id: 'lead-draft',
  paymentType: 'leasing',
  desiredRate: 386,
  wish: { termMonths: 48, mileagePerYear: 15000, downPayment: 0 },
  crm: {
    reservedModels: [{ id: 'ev6-draft', name: 'EV6', modelKey: 'ev6', trimLabel: 'Vision', isPrimary: true }],
  },
};
const draftCards = buildVehicleOpportunityCards({ lead: draftLead, wishFields: draftLead.wish, reservedModels: draftLead.crm.reservedModels });
assert.equal(shouldNavigateToOfferCalculator(draftCards[0], draftLead), true);
assert.equal(cardNeedsConditionsConfigure(draftCards[0], draftLead), true);

assert.ok(conditionsSource.includes('Kundenwunsch'));
assert.ok(conditionsSource.includes('CashOfferSection'), 'Barangebot-Maske sichtbar');
assert.ok(conditionsSource.includes('CompactVehicleCard'), 'kompakte Fahrzeugzeile');
assert.ok(conditionsSource.includes('PaymentTab'), 'Angebotsart-Tabs');
assert.ok(conditionsSource.includes('SellerHints'), 'Verkäufer-Hinweise');
assert.ok(conditionsSource.includes('FlowStickyFooter'), 'Sticky-Footer');
assert.ok(conditionsSource.includes('QuickPickRow'), 'Schnellwerte für Konditionen');
assert.ok(conditionsSource.includes('dai-cond-sticky-live'), 'Sticky Live-Ergebnis');
assert.ok(conditionsPreviewSource.includes('Barangebot'));
assert.ok(conditionsPreviewSource.includes('buildCompactVehicleSummary'));
assert.ok(conditionsPreviewSource.includes('buildConditionsSellerHints'));
assert.ok(conditionsSource.includes('buildConditionsFooterAction'));
assert.ok(conditionsPreviewSource.includes("label: 'Angebot speichern'"));

const dealerAiPageSource = readFileSync(
  join(__dirname, '../../pages/DealerAIPage.jsx'),
  'utf8',
);
assert.ok(dealerAiPageSource.includes('addVehicleBootstrapKeyRef'), 'Kein Re-Bootstrap bei leads-Sync');

console.log('offerEditWishMerge.test.js: ok');
