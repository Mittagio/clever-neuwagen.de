/**
 * Clever Universal Seller Orchestrator – Golden Cases
 * node src/services/cleverSeller/runCleverSellerTurn.test.js
 */
import assert from 'node:assert/strict';
import { createEmptyNeedProfile } from '../consultation/needProfileService.js';
import { SELLER_FACT_CLASS, SELLER_TURN_INTENTS, SELLER_INPUT_MODE } from './sellerFactTypes.js';
import { interpretSellerInput } from './interpretSellerInput.js';
import { runCleverSellerTurn } from './runCleverSellerTurn.js';
import { shouldShowUniversalReview } from './buildUniversalReviewModel.js';

const emptyLead = {
  id: 'lead-orch-1',
  name: 'Herr Norz',
  wish: { paymentType: 'leasing', termMonths: 48, annualMileage: 15000 },
  crm: {
    needProfile: createEmptyNeedProfile(),
    customerMessages: [],
    customerMessageThreads: [],
  },
};

// --- 1) Alles hinwerfen ---
const dump = `netto 2800
2 kinder
verheiratet
ford kuga
leasing läuft 11/2026 aus
300 euro wunschrate
ev5 gt line schwarz
auto nehmen wir in zahlung`;

const turn1 = runCleverSellerTurn({ lead: emptyLead, sellerInput: dump });
assert.equal(turn1.ok, true);
assert.equal(turn1.inputMode, SELLER_INPUT_MODE.CLEVER_WORK_INPUT);
assert.ok(turn1.extractedFacts.some((f) => f.field === 'monthlyNetIncome' && f.value === 2800));
assert.ok(turn1.extractedFacts.some((f) => f.field === 'childrenCount' && f.value === 2));
assert.ok(turn1.extractedFacts.some((f) => f.field === 'maritalStatus' && f.value === 'married'));
assert.ok(turn1.extractedFacts.some((f) => f.factClass === SELLER_FACT_CLASS.EXISTING_VEHICLE));
assert.ok(turn1.extractedFacts.some((f) => f.factClass === SELLER_FACT_CLASS.TRADE_IN_FACT));
assert.ok(turn1.extractedFacts.some((f) => f.field === 'monthlyBudget' && f.value === 300));
assert.ok(turn1.extractedFacts.some((f) => /EV5/i.test(f.label) && f.factClass === SELLER_FACT_CLASS.VEHICLE_INTEREST));
assert.ok(turn1.extractedFacts.some((f) => f.field === 'existingContractEnd'));
assert.ok(turn1.intents.some((i) => i.type === SELLER_TURN_INTENTS.UPDATE_CUSTOMER_CONTEXT));
assert.ok(turn1.intents.some((i) => i.type === SELLER_TURN_INTENTS.PREPARE_TRADE_IN));
assert.ok(turn1.missingInformation.some((m) => m.id === 'trade_in_mileage' || m.id === 'trade_in_registration'));
assert.ok(turn1.assistantReply);
assert.ok(turn1.uiEffects.capturedFacts.length >= 4);
assert.ok(turn1.proposedUpdates.length >= 4);
assert.ok(turn1.proposedUpdates.every((u) => u.source === 'seller_input'));

// --- 2) Multi-intent offer + trade-in + document ---
const turn2 = runCleverSellerTurn({
  lead: {
    ...emptyLead,
    wish: { paymentType: 'leasing', termMonths: 48, annualMileage: 15000, modelKey: 'ev3' },
  },
  sellerInput: 'Erstelle Angebot EV3, 21 Prozent Sonderrabatt, Lieferzeit fünf Monate, Kuga nehmen wir in Zahlung, frag nach Fahrzeugschein.',
});
assert.ok(turn2.intents.some((i) => i.type === SELLER_TURN_INTENTS.PREPARE_OFFER));
assert.ok(turn2.intents.some((i) => i.type === SELLER_TURN_INTENTS.PREPARE_TRADE_IN));
assert.ok(turn2.intents.some((i) => i.type === SELLER_TURN_INTENTS.REQUEST_DOCUMENTS));
assert.ok(turn2.extractedFacts.some((f) => f.field === 'discountPercent' && f.value === 21));
assert.ok(turn2.extractedFacts.some((f) => f.field === 'deliveryEstimateMonths'));

// --- 3) Ambiguity EV3 oder EV5 ---
const amb = interpretSellerInput('ev3 oder ev5');
assert.ok(amb.facts.some((f) => f.field === 'vehicleInterestMulti'));
assert.ok(!amb.facts.some((f) => f.field === 'vehicleInterest' && f.value?.modelKey === 'ev5' && !f.value?.trim));

// --- 4) Unklare 300 Euro ---
const money = interpretSellerInput('300 euro');
assert.ok(money.facts.some((f) => f.field === 'monthlyBudget' && f.needsConfirmation));

// --- 5) Korrektur km ---
const corr = interpretSellerInput('doch 20000 km statt 15000');
assert.ok(corr.facts.some((f) => f.field === 'annualMileage' && f.value === 20000));

// --- 6) Message vs Work ---
const msg = interpretSellerInput('schreib ihm auto ist sofort da');
assert.ok(
  msg.inputMode === SELLER_INPUT_MODE.CUSTOMER_MESSAGE
  || msg.intents.some((i) => i.type === SELLER_TURN_INTENTS.DRAFT_MESSAGE),
);

const work = interpretSellerInput('verheiratet, 2 kinder, ford kuga');
assert.equal(work.inputMode, SELLER_INPUT_MODE.CLEVER_WORK_INPUT);

// --- 7) Duplicate prevention ---
const withKids = {
  ...emptyLead,
  crm: {
    ...emptyLead.crm,
    needProfile: {
      ...createEmptyNeedProfile(),
      understoodLabels: ['2 Kinder'],
    },
  },
};
const turnDup = runCleverSellerTurn({
  lead: withKids,
  sellerInput: 'hat zwei Kinder und verheiratet',
});
assert.ok(!turnDup.extractedFacts.some((f) => f.field === 'childrenCount'));
assert.ok(turnDup.extractedFacts.some((f) => f.field === 'maritalStatus'));

// --- 8) Feature flag off ---
const off = runCleverSellerTurn({
  lead: emptyLead,
  sellerInput: dump,
  env: { CLEVER_SELLER_ORCHESTRATOR_ENABLED: 'false' },
});
assert.equal(off.ok, false);
assert.equal(off.preparedActions.length, 0);
assert.ok(off.extractedFacts.length > 0, 'Interpretation bleibt verfügbar');

// --- 9) Outlook-Betreff-Dump (Hafner / Probefahrt / Seltos·K4 / Octavia) ---
const outlookDump = `Eduard Hafner Urbach Interesse an PROBEFAHRT KIA SELTOS / KIA K4 SW 0179 7072736 Skoda Octavia Schalter
Do 30.07.2026
10:00
10:30
Automatik
Schiebedach
GT LINE / X LINE 3`;

const turnOutlook = runCleverSellerTurn({ lead: emptyLead, sellerInput: outlookDump });
assert.equal(turnOutlook.ok, true);
assert.ok(turnOutlook.extractedFacts.some((f) => f.field === 'customerName' && /Hafner/i.test(f.label)));
assert.ok(turnOutlook.extractedFacts.some((f) => f.field === 'customerPlace' && /Urbach/i.test(f.label)));
assert.ok(turnOutlook.extractedFacts.some((f) => f.field === 'phone' && /0179/.test(f.label)));
assert.ok(turnOutlook.extractedFacts.some((f) => f.factClass === SELLER_FACT_CLASS.APPOINTMENT_FACT && /Probefahrt/i.test(f.label)));
assert.ok(turnOutlook.extractedFacts.some((f) => f.field === 'vehicleInterestMulti' && /Seltos/i.test(f.label) && /K4/i.test(f.label)));
assert.ok(turnOutlook.extractedFacts.some((f) => f.factClass === SELLER_FACT_CLASS.EXISTING_VEHICLE && /Octavia/i.test(f.label) && /Schalter/i.test(f.label)));
assert.ok(!turnOutlook.extractedFacts.some((f) => f.factClass === SELLER_FACT_CLASS.EXISTING_VEHICLE && /Seltos/i.test(f.label)));
assert.ok(turnOutlook.extractedFacts.some((f) => f.field === 'transmissionPreference' && /Automatik/i.test(f.label)));
assert.ok(turnOutlook.extractedFacts.some((f) => f.field === 'sunroofRequired'));
assert.ok(turnOutlook.extractedFacts.some((f) => f.field === 'trimPreference' && /GT-Line/i.test(f.label)));
assert.ok(turnOutlook.intents.some((i) => i.type === SELLER_TURN_INTENTS.PROPOSE_APPOINTMENT));
assert.ok(turnOutlook.intents.some((i) => i.type === SELLER_TURN_INTENTS.UPDATE_CUSTOMER_CONTEXT));

// --- 10) Freitext Dump: Lieferzeit / Farbe ---
const liefer = interpretSellerInput('Lieferzeit bis 11.2026 wichtig');
assert.ok(liefer.facts.some((f) => f.field === 'deliveryDeadline' && /11\.2026/i.test(f.label)));
const farbe = interpretSellerInput('Farbe rot');
assert.ok(farbe.facts.some((f) => f.field === 'colorPreference' && /rot/i.test(f.label)));
const rabatt = runCleverSellerTurn({ lead: emptyLead, sellerInput: '21 %' });
assert.ok(rabatt.extractedFacts.some((f) => f.field === 'discountPercent'));

// --- 11) Explizite Kundennachricht ≠ Offer-Dump ---
const msgLiefer = interpretSellerInput('Schreib ihm: Lieferzeit ca. 3 Monate');
assert.equal(msgLiefer.inputMode, SELLER_INPUT_MODE.CUSTOMER_MESSAGE);
assert.ok(msgLiefer.intents.some((i) => i.type === SELLER_TURN_INTENTS.DRAFT_MESSAGE));
assert.ok(!msgLiefer.intents.some((i) => i.type === SELLER_TURN_INTENTS.PREPARE_OFFER));
const msgTurn = runCleverSellerTurn({
  lead: emptyLead,
  sellerInput: 'Schreib ihm: Lieferzeit ca. 3 Monate',
});
assert.equal(msgTurn.inputMode, SELLER_INPUT_MODE.CUSTOMER_MESSAGE);
assert.equal(shouldShowUniversalReview(msgTurn), false);

console.log('runCleverSellerTurn.test.js: OK');
