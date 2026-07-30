/**
 * commercialScenarios – Customer Truth + Chip-Gruppierung + Offer-Binding
 */
import assert from 'node:assert/strict';
import {
  areAllScenarioOffersReady,
  buildCustomerTruthNotepadGroups,
  formatCommercialScenarioChip,
  getCommercialScenarioById,
  listCommercialScenarios,
  normalizeCommercialScenario,
  setCommercialScenariosOnLead,
} from './commercialScenarios.js';
import {
  createSportageDualScenarioLead,
  SPORTAGE_DUAL_LEAD_ID,
  SPORTAGE_DUAL_OFFER_IDS,
  SPORTAGE_DUAL_SCENARIO_IDS,
  SPORTAGE_DUAL_TRACK_ID,
} from './sportageDualScenarioCase.js';
import {
  listCustomerVehicleTracks,
  listScenarioOfferSlots,
} from './vehicleTrack.js';
import {
  getOfferByCommercialScenarioId,
  listOffersForVehicleTrack,
} from '../vehicleOffer.js';
import {
  buildDualScenarioSendItems,
  canSendBothScenarioOffers,
  sendBothScenarioOffers,
} from './dualScenarioSend.js';
import { buildPortfolioItems } from './customerOfferPortfolioService.js';
import { MESSAGE_KIND } from './customerMessageService.js';

// --- normalize + list ---
{
  const scenario = normalizeCommercialScenario({
    id: 'leasing-1',
    type: 'leasing',
    customerType: 'private',
    termMonths: 36,
    annualMileage: 10000,
    downPayment: 0,
    source: 'customer_message',
  });
  assert.equal(scenario.type, 'leasing');
  assert.equal(scenario.paymentType, 'leasing');
  assert.equal(formatCommercialScenarioChip(scenario), 'Leasing · 36 M · 10.000 km · 0 €');
}

// --- Legacy single paymentType still works ---
{
  const lead = {
    paymentType: 'leasing',
    wish: { paymentType: 'leasing', termMonths: 48, mileagePerYear: 15000, downPayment: 0 },
  };
  const scenarios = listCommercialScenarios(lead);
  assert.equal(scenarios.length, 1);
  assert.equal(scenarios[0].source, 'legacy');
  assert.equal(scenarios[0].termMonths, 48);
}

// --- Demo seed: one Sportage track, two scenarios ---
{
  const lead = createSportageDualScenarioLead({ phase: 'ready', now: Date.now() });
  assert.equal(lead.id, SPORTAGE_DUAL_LEAD_ID);
  assert.equal(lead.wish.commercialScenarios.length, 2);

  const tracks = listCustomerVehicleTracks(lead);
  assert.equal(tracks.length, 1, 'exactly one vehicle track');
  assert.equal(tracks[0].id, SPORTAGE_DUAL_TRACK_ID);
  assert.equal(tracks[0].modelLabel, 'Sportage');
  assert.equal(tracks[0].hasMultipleScenarios, true);
  assert.equal(tracks[0].offerIds.length, 2);

  const slots = listScenarioOfferSlots(lead, SPORTAGE_DUAL_TRACK_ID);
  assert.equal(slots.length, 2);
  assert.equal(slots[0].scenarioId, SPORTAGE_DUAL_SCENARIO_IDS.LEASING);
  assert.equal(slots[1].scenarioId, SPORTAGE_DUAL_SCENARIO_IDS.FINANCING);
  assert.equal(slots[0].monthlyRate, 389);
  assert.equal(slots[1].monthlyRate, 429);
  assert.ok(slots.every((s) => s.ready));
  assert.ok(areAllScenarioOffersReady(slots));

  const leasingOffer = getOfferByCommercialScenarioId(
    lead,
    SPORTAGE_DUAL_SCENARIO_IDS.LEASING,
    SPORTAGE_DUAL_TRACK_ID,
  );
  assert.equal(leasingOffer.id, SPORTAGE_DUAL_OFFER_IDS.LEASING);
  assert.equal(leasingOffer.commercialScenarioId, SPORTAGE_DUAL_SCENARIO_IDS.LEASING);

  const offers = listOffersForVehicleTrack(lead, SPORTAGE_DUAL_TRACK_ID);
  assert.equal(offers.length, 2);
}

// --- Notepad groups ---
{
  const lead = createSportageDualScenarioLead({ phase: 'ready' });
  const groups = buildCustomerTruthNotepadGroups(lead);
  assert.ok(groups);
  assert.ok(groups.vehicle.some((c) => /Sportage/i.test(c.label)));
  assert.ok(groups.vehicle.some((c) => /Konfiguration/i.test(c.label)));
  assert.equal(groups.offerWishes.length, 2);
  assert.match(groups.offerWishes[0].label, /Leasing/);
  assert.match(groups.offerWishes[1].label, /Finanzierung/);
  assert.ok(!groups.offerWishes.some((c) => /Leasing.*Finanzierung|Finanzierung.*Leasing/i.test(c.label)));
  assert.equal(groups.customer[0].label, 'Privat');
  assert.ok(groups.open.some((c) => /Lieferzeit/i.test(c.label)));
}

// --- Dual send ---
{
  const lead = createSportageDualScenarioLead({ phase: 'ready' });
  assert.equal(canSendBothScenarioOffers(lead), true);
  const items = buildDualScenarioSendItems(lead);
  assert.equal(items.length, 2);
  assert.ok(items.every((i) => i.commercialScenarioId));
  assert.notEqual(items[0].offerId, items[1].offerId);

  const sent = sendBothScenarioOffers({
    lead,
    createdByName: 'Test VK',
    firstName: 'Julia',
  });
  assert.equal(sent.ok, true);
  assert.equal(sent.itemCount, 2);
  assert.equal(sent.dualSend, true);

  const offerCards = (sent.lead.crm?.customerMessages ?? [])
    .filter((m) => m.kind === MESSAGE_KIND.OFFER_CARD);
  assert.equal(offerCards.length, 2, 'two OFFER_CARD messages');
  assert.notEqual(
    offerCards[0].relatedOfferId,
    offerCards[1].relatedOfferId,
    'dedup keys must differ for dual scenarios',
  );
}

// --- Portfolio items from scenarios ---
{
  const lead = createSportageDualScenarioLead({ phase: 'ready' });
  const items = buildPortfolioItems({ lead, vehicleCards: [] });
  const scenarioItems = items.filter((i) => i.sourceType === 'commercial_scenario');
  assert.equal(scenarioItems.length, 2);
  assert.ok(scenarioItems.some((i) => i.rateLine?.includes('389')));
  assert.ok(scenarioItems.some((i) => i.rateLine?.includes('429')));
}

// --- setCommercialScenariosOnLead keeps legacy fields ---
{
  let lead = { id: 'x', wish: {} };
  lead = setCommercialScenariosOnLead(lead, [
    {
      id: 'leasing-1',
      type: 'leasing',
      termMonths: 36,
      annualMileage: 10000,
      downPayment: 0,
      customerType: 'private',
    },
    {
      id: 'financing-1',
      type: 'financing',
      termMonths: 60,
      annualMileage: 10000,
      downPayment: 4000,
      customerType: 'private',
    },
  ]);
  assert.equal(lead.paymentType, 'leasing');
  assert.equal(lead.wish.termMonths, 36);
  assert.equal(getCommercialScenarioById(lead, 'financing-1').downPayment, 4000);
}

// --- Draft phase: slots not ready ---
{
  const draft = createSportageDualScenarioLead({ phase: 'draft' });
  const slots = listScenarioOfferSlots(draft, SPORTAGE_DUAL_TRACK_ID);
  assert.equal(slots.length, 2);
  assert.ok(slots.every((s) => !s.ready));
  assert.equal(canSendBothScenarioOffers(draft), false);
}

console.log('commercialScenarios.test.js: OK');
