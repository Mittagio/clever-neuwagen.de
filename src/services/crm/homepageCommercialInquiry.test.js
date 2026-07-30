/**
 * Epic 2 – Homepage-Anfrage → Dual commercialScenarios + Review + Apply
 */
import assert from 'node:assert/strict';
import {
  applyHomepageInquiryToLead,
  buildHomepageInquiryReviewModel,
  isHomepageDualScenarioInquiry,
  parseHomepageCommercialInquiry,
} from './homepageCommercialInquiry.js';
import { listCustomerVehicleTracks, listScenarioOfferSlots } from './vehicleTrack.js';
import { interpretSellerInput } from '../cleverSeller/interpretSellerInput.js';
import { runCleverSellerTurn } from '../cleverSeller/runCleverSellerTurn.js';
import {
  buildUniversalReviewModel,
  shouldShowUniversalReview,
} from '../cleverSeller/buildUniversalReviewModel.js';
import { applyAcceptedSellerTurn } from '../cleverSeller/applyAcceptedSellerTurn.js';

const SAMPLE = 'Ich interessiere mich für den Sportage mit der Konfiguration im Anhang. Bitte Leasing 36 Monate, 10.000 km, keine Anzahlung und alternativ Finanzierung 60 Monate, 4.000 € Anzahlung. Privat. Wie ist die Lieferzeit?';

// --- Parse ---
{
  const draft = parseHomepageCommercialInquiry(SAMPLE);
  assert.ok(draft);
  assert.equal(draft.model, 'Sportage');
  assert.equal(draft.configurationAttached, true);
  assert.equal(draft.customerType, 'private');
  assert.equal(draft.hasDualScenarios, true);
  assert.equal(draft.commercialScenarios.length, 2);

  const leasing = draft.commercialScenarios.find((s) => s.type === 'leasing');
  const financing = draft.commercialScenarios.find((s) => s.type === 'financing');
  assert.ok(leasing);
  assert.ok(financing);
  assert.equal(leasing.termMonths, 36);
  assert.equal(leasing.annualMileage, 10000);
  assert.equal(leasing.downPayment, 0);
  assert.equal(financing.termMonths, 60);
  assert.equal(financing.annualMileage, 10000);
  assert.equal(financing.downPayment, 4000);
  assert.ok(draft.openQuestions.some((q) => q.field === 'deliveryTime'));
  assert.equal(isHomepageDualScenarioInquiry(SAMPLE), true);
}

// --- Kein gemischter paymentType ---
{
  const draft = parseHomepageCommercialInquiry(SAMPLE);
  assert.ok(!draft.paymentType);
  assert.ok(draft.commercialScenarios.every((s) => s.type === 'leasing' || s.type === 'financing'));
}

// --- Review model ---
{
  const draft = parseHomepageCommercialInquiry(SAMPLE);
  const model = buildHomepageInquiryReviewModel(draft);
  assert.equal(model.title, '✨ Clever hat die Anfrage vorbereitet');
  assert.equal(model.primaryCta, 'Übernehmen');
  assert.ok(model.groups.some((g) => g.title === 'FAHRZEUG'));
  assert.ok(model.groups.some((g) => g.title === 'ANGEBOTSWÜNSCHE'));
  const wishes = model.groups.find((g) => g.title === 'ANGEBOTSWÜNSCHE');
  assert.equal(wishes.items.length, 2);
  assert.match(wishes.items[0].label, /Leasing/);
  assert.match(wishes.items[1].label, /Finanzierung/);
  assert.ok(model.groups.some((g) => g.title === 'OFFEN' && /Lieferzeit/i.test(g.line)));
}

// --- Apply: eine Spur, zwei Slots ---
{
  const draft = parseHomepageCommercialInquiry(SAMPLE);
  const lead = {
    id: 'lead-test-homepage',
    contact: { name: 'Test Kunde', email: 't@demo.de' },
    crm: {},
  };
  const applied = applyHomepageInquiryToLead(lead, draft);
  assert.equal(applied.ok, true);
  const tracks = listCustomerVehicleTracks(applied.lead);
  assert.equal(tracks.length, 1);
  assert.match(tracks[0].modelLabel, /Sportage/i);
  assert.equal(tracks[0].hasMultipleScenarios, true);
  assert.equal(applied.lead.wish.commercialScenarios.length, 2);
  assert.ok(!Object.values(applied.lead.crm.vehicleOffers || {}).every((o) => !o.commercialScenarioId));
  const slots = listScenarioOfferSlots(applied.lead, tracks[0].id);
  assert.equal(slots.length, 2);
  assert.ok(slots.every((s) => !s.ready), 'Slots start empty/pending');
  assert.equal(applied.lead.crm.customerTruth.configurationAttached, true);
  assert.equal(applied.lead.crm.customerTruth.deliveryTimeOpen, true);
  assert.equal(applied.lead.crm.customerTruth.deliveryTimeQuestion?.status, 'open');
}

// --- interpretSellerInput + Universal Review ---
{
  const interpreted = interpretSellerInput(SAMPLE);
  assert.ok(interpreted.homepageInquiry?.hasDualScenarios);
  assert.ok(interpreted.facts.some((f) => f.field === 'commercialScenarios'));
  assert.ok(!interpreted.facts.some((f) => f.field === 'paymentType'), 'no single paymentType mash');

  const turn = runCleverSellerTurn({
    lead: { id: 'lead-x', wish: {}, crm: {} },
    sellerInput: SAMPLE,
    env: { VITE_CLEVER_SELLER_ORCHESTRATOR: 'true', CLEVER_SELLER_ORCHESTRATOR: 'true' },
  });
  assert.ok(shouldShowUniversalReview(turn));
  const review = buildUniversalReviewModel(turn);
  assert.equal(review.title, '✨ Clever hat die Anfrage vorbereitet');
  assert.equal(review.primaryCta, 'Übernehmen');
}

// --- Accept path ---
{
  const lead = {
    id: 'lead-accept-homepage',
    name: 'Julia',
    contact: { name: 'Julia Weber', email: 'j@demo.de' },
    wish: {},
    crm: {},
  };
  const turn = runCleverSellerTurn({
    lead,
    sellerInput: SAMPLE,
    env: { VITE_CLEVER_SELLER_ORCHESTRATOR: 'true', CLEVER_SELLER_ORCHESTRATOR: 'true' },
  });
  const applied = applyAcceptedSellerTurn(lead, turn, { postFeedCard: false });
  assert.equal(applied.ok, true);
  const tracks = listCustomerVehicleTracks(applied.lead);
  assert.equal(tracks.length, 1);
  assert.equal(tracks[0].hasMultipleScenarios, true);
  assert.equal(applied.lead.wish.commercialScenarios.length, 2);
  const slots = listScenarioOfferSlots(applied.lead, tracks[0].id);
  assert.equal(slots.length, 2);
}

console.log('homepageCommercialInquiry.test.js: OK');
