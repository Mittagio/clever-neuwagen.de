/**
 * Tests: Dealer AI – Angebot aus Clever Empfehlung erstellen
 */
import assert from 'node:assert/strict';
import { parseDealerAiInput } from './dealerAiParser.js';
import { getDealerSeed } from '../data/dealers/index.js';
import { buildConfigureDraft } from './dealerAiVehicleConfigureFlow.js';
import {
  buildKundenakteEnrichmentFromOfferDraft,
  buildKundenhelferChipsFromOfferDraft,
  buildOfferDraft,
  buildOfferSavedActivityText,
  executeSaveOfferDraft,
  finalizeLeadWithOfferDraft,
  offerDraftToParserFields,
  offerDraftToVehicleCard,
  resolveOfferCustomerContext,
  resolveOfferSaveMode,
} from './dealerAiOfferCreate.js';
import { VEHICLE_OFFER_STATUS } from './vehicleOffer.js';

const sampleText = 'Kia EV4 Earth 81 kWh, Leasing, 48 Monate, 15.000 km, Budget bis 790 €';
const parsed = parseDealerAiInput(sampleText);
const conditions = getDealerSeed('autohaus-trinkle');
const baseDraft = buildConfigureDraft(parsed, conditions);

assert.ok(parsed.ok);
assert.equal(baseDraft.termMonths, 48);
assert.equal(baseDraft.mileagePerYear, 15000);

const changedTermDraft = { ...baseDraft, termMonths: 36 };
const termOfferDraft = buildOfferDraft({
  configureDraft: changedTermDraft,
  parsed,
  conditions,
});
assert.equal(termOfferDraft.payment.termMonths, 36, 'Geänderte Laufzeit wird übernommen');

const changedMileageDraft = { ...baseDraft, mileagePerYear: 20000 };
const mileageOfferDraft = buildOfferDraft({
  configureDraft: changedMileageDraft,
  parsed,
  conditions,
});
assert.equal(mileageOfferDraft.payment.mileagePerYear, 20000, 'Geänderte Kilometer werden übernommen');

const alternativeDraft = {
  ...baseDraft,
  mileagePerYear: 20000,
  downPayment: 3000,
  termMonths: 36,
};
const altOfferDraft = buildOfferDraft({
  configureDraft: alternativeDraft,
  parsed,
  conditions,
});
assert.ok(altOfferDraft.vehicleConfiguration, 'vehicleConfiguration getrennt im Offer-Draft');
assert.ok(altOfferDraft.offerPreview, 'offerPreview getrennt im Offer-Draft');
assert.ok(altOfferDraft.offerCalculation != null || altOfferDraft.offerPreview.monthlyRate != null, 'Berechnung in offerPreview');
assert.equal(
  altOfferDraft.vehicle.uvpConfigurationPrice,
  altOfferDraft.vehicleConfiguration.uvpConfigurationPrice,
  'UVP aus Konfiguration im Fahrzeug-Block',
);
assert.equal(altOfferDraft.payment.mileagePerYear, 20000);
assert.equal(altOfferDraft.payment.downPayment, 3000);
assert.equal(altOfferDraft.payment.termMonths, 36, 'Alternative-Werte werden übernommen');

const previewRate = altOfferDraft.payment.calculatedRate;
assert.ok(previewRate != null, 'Rate soll berechnet werden');
assert.equal(
  offerDraftToVehicleCard(altOfferDraft).desiredRate,
  previewRate,
  'calculatedRate entspricht sichtbarer Rate auf der Karte',
);

assert.ok(altOfferDraft.timing);
assert.equal(altOfferDraft.timing.desiredDeliveryDate, baseDraft.desiredDeliveryDate);
assert.ok(altOfferDraft.source.originalText.includes('EV4'));
assert.equal(altOfferDraft.source.parsedFields.termMonths, 36);
assert.equal(altOfferDraft.source.parsedFields.mileagePerYear, 20000);
assert.equal(altOfferDraft.source.createdFrom, 'dealer_ai_mail');

const existingCustomerCtx = resolveOfferCustomerContext({
  addVehicleContext: { customerId: 'cust-existing', opportunityId: 'lead-existing' },
});
assert.equal(existingCustomerCtx.customerId, 'cust-existing');
assert.equal(existingCustomerCtx.opportunityId, 'lead-existing');
assert.equal(
  resolveOfferSaveMode({ customerId: 'cust-existing', opportunityId: 'lead-existing' }),
  'attach_to_opportunity',
);

const customerOnlyCtx = resolveOfferCustomerContext({
  carryCustomer: { customerId: 'cust-only' },
});
assert.equal(customerOnlyCtx.customerId, 'cust-only');
assert.equal(customerOnlyCtx.needsNewOpportunity, true);
assert.equal(
  resolveOfferSaveMode({ customerId: 'cust-only', opportunityId: null }),
  'new_opportunity_for_customer',
);

const sampleLead = {
  id: 'lead-existing',
  customerId: 'cust-existing',
  contact: { name: 'Max Mustermann', phone: '0170', email: 'max@test.de' },
  crm: { vehicleConfigurations: [], reservedModels: [] },
};

const attachOfferDraft = buildOfferDraft({
  configureDraft: alternativeDraft,
  parsed,
  conditions,
  carryCustomer: { customerId: 'cust-existing', contact: sampleLead.contact },
  addVehicleContext: { customerId: 'cust-existing', opportunityId: 'lead-existing' },
  lead: sampleLead,
});
assert.equal(attachOfferDraft.customerId, 'cust-existing');
assert.equal(attachOfferDraft.opportunityId, 'lead-existing');

let attachUpdated = null;
let attachAddLeadCalled = false;
const attachResult = executeSaveOfferDraft(attachOfferDraft, {
  parsed,
  conditions,
  leads: [sampleLead],
  updateLead: (id, patch) => {
    attachUpdated = { id, patch };
  },
  addLead: () => { attachAddLeadCalled = true; },
  getExistingCodes: () => [],
  selectedModelIds: ['ev4'],
});
assert.equal(attachResult.type, 'offer_saved');
assert.equal(attachResult.mode, 'attached_to_opportunity');
assert.equal(attachResult.customerId, 'cust-existing');
assert.equal(attachUpdated.id, 'lead-existing');
assert.equal(attachAddLeadCalled, false, 'opportunityId hängt Angebot an bestehende Chance ohne addLead');
assert.equal(attachUpdated.patch.desiredRate, attachOfferDraft.payment.calculatedRate);
assert.equal(attachUpdated.patch.wish.termMonths, 36);
assert.equal(attachUpdated.patch.crm.pipelineStatusId, 'angebot_erstellt');
assert.equal(attachUpdated.patch.crm.nextStepId, 'send_offer');
assert.equal(attachUpdated.patch.crm.nextStepLabel, 'Angebot senden');
assert.ok(attachUpdated.patch.crm.vehicleConfigurations.length >= 1);
assert.ok(attachUpdated.patch.crm.reservedModels.some((m) => m.badge === 'Clever Empfehlung'));
assert.equal(
  attachUpdated.patch.crm.vehicleOffers[attachResult.card.id].status,
  VEHICLE_OFFER_STATUS.DRAFT,
);
assert.ok(attachUpdated.patch.crm.kundenhelfer.notes.length > 0);
assert.ok(attachResult.activityText.includes('Clever Empfehlung gespeichert'));

let newOppLead = null;
const newOppDraft = buildOfferDraft({
  configureDraft: changedTermDraft,
  parsed,
  conditions,
  carryCustomer: { customerId: 'cust-existing', contact: sampleLead.contact },
});
assert.equal(newOppDraft.customerId, 'cust-existing');
assert.equal(newOppDraft.opportunityId, null);

const newOppResult = executeSaveOfferDraft(newOppDraft, {
  parsed,
  conditions,
  leads: [sampleLead],
  updateLead: () => { throw new Error('updateLead darf nicht aufgerufen werden'); },
  addLead: (lead) => { newOppLead = lead; },
  getExistingCodes: () => [],
  selectedModelIds: ['ev4'],
});
assert.equal(newOppResult.mode, 'new_opportunity_for_customer');
assert.equal(newOppLead.customerId, 'cust-existing', 'customerId verhindert neuen Kunden');

let captureLead = null;
const freshDraft = buildOfferDraft({
  configureDraft: baseDraft,
  parsed,
  conditions,
});
assert.equal(freshDraft.customerId, null);
const captureResult = executeSaveOfferDraft(freshDraft, {
  parsed,
  conditions,
  leads: [],
  updateLead: () => {},
  addLead: (lead) => { captureLead = lead; },
  getExistingCodes: () => [],
  selectedModelIds: ['ev4'],
});
assert.equal(captureResult.mode, 'needs_customer_selection');
assert.ok(captureResult.needsCapture);
assert.ok(captureLead?.customerId);
assert.equal(captureLead.wish.termMonths, 48);

const parserFields = offerDraftToParserFields(altOfferDraft);
assert.equal(parserFields.termMonths, 36);
assert.equal(parserFields.calculatedRate, previewRate);
assert.equal(parserFields.rawText, altOfferDraft.source.originalText);

const urgentDraft = buildOfferDraft({
  configureDraft: {
    ...baseDraft,
    immediateAvailability: true,
    vehicleChangeIntent: true,
    leasingEndDate: 'August 2026',
    extras: { ...baseDraft.extras, ahk: true, wartung: true },
  },
  parsed,
  conditions,
});
const { chips, extras } = buildKundenhelferChipsFromOfferDraft(urgentDraft);
assert.ok(chips.includes('braucht Auto sofort'));
assert.ok(chips.includes('Leasing läuft aus'));
assert.ok(extras.includes('AHK gewünscht'));
assert.ok(extras.includes('Wartungspaket'));

const enrichment = buildKundenakteEnrichmentFromOfferDraft(altOfferDraft, {
  configId: 'vc-test-1',
});
assert.equal(enrichment.crmPatch.pipelineStatusId, 'angebot_erstellt');
assert.equal(enrichment.crmPatch.nextStepId, 'send_offer');
assert.equal(enrichment.crmPatch.offers[0].status, 'draft');
assert.equal(enrichment.crmPatch.vehicleOffers['vc-test-1'].status, VEHICLE_OFFER_STATUS.DRAFT);
assert.ok(enrichment.historyEntry.text.includes('EV4'));

const finalized = finalizeLeadWithOfferDraft(sampleLead, attachOfferDraft, {
  config: { id: attachResult.card.id, modelKey: 'ev4', brand: 'Kia', model: 'EV4', type: 'vehicle_configuration' },
  card: attachResult.card,
  enrichedParsed: { ok: true, fields: offerDraftToParserFields(attachOfferDraft), suggestedModels: [] },
  selectedModelIds: ['ev4'],
});
assert.equal(finalized.crm.pipelineStatusId, 'angebot_erstellt');
assert.ok(finalized.crm.reservedModels[0].isPrimary);
assert.ok(buildOfferSavedActivityText(altOfferDraft).includes('Monate'));

console.log('dealerAiOfferCreate tests OK');
