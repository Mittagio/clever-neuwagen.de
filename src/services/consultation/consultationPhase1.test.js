/**
 * Clever Beratung Phase 1 – drei Welten, NeedProfile, Fragen-Trennung
 */
import assert from 'node:assert/strict';
import { QUERY_TYPES } from '../clever/customerQueryTypes.js';
import {
  CLEVER_WORLD,
  getActiveCleverWorld,
  requiresVehicleConsultationWorld,
  buildWorldGateRedirect,
} from './consultationWorlds.js';
import {
  NEED_CONSULTATION_QUESTIONS,
  VEHICLE_EQUIPMENT_QUESTIONS,
  NEED_QUESTION_IDS,
  VEHICLE_QUESTION_IDS,
} from './consultationQuestions.js';
import {
  mergeTextIntoNeedProfile,
  buildUnderstoodLabels,
  mergeNeedProfileIntoLead,
} from './needProfileService.js';
import { buildNeedWorldRecommendation } from './consultationRecommendation.js';
import {
  createConsultationProfile,
  getNextConsultationQuestion,
  getNextVehicleConsultationQuestion,
} from '../dealer/cleverSalesAdvisor.js';
import { GOLDEN_RULE_NEVER_ASK_KNOWN } from './consultationGoldenRules.js';

// Drei Welten
assert.equal(getActiveCleverWorld({}), CLEVER_WORLD.NEED_CONSULTATION);
assert.equal(
  getActiveCleverWorld({ needProfile: { selectedModelKey: 'ev3' } }),
  CLEVER_WORLD.VEHICLE_CONSULTATION,
);
assert.equal(
  getActiveCleverWorld({ hasOffer: true }),
  CLEVER_WORLD.OFFER,
);

// Fragen getrennt
for (const q of NEED_CONSULTATION_QUESTIONS) {
  assert.equal(q.world, 'need_consultation');
  assert.ok(!VEHICLE_QUESTION_IDS.has(q.id));
}
for (const q of VEHICLE_EQUIPMENT_QUESTIONS) {
  assert.equal(q.world, 'vehicle_consultation');
  assert.ok(!NEED_QUESTION_IDS.has(q.id));
}

// Welt 1 Wizard fragt keine Wärmepumpe
const profile = createConsultationProfile('Elektro-SUV für zwei Kinder bis 350 €');
const needProfile = mergeTextIntoNeedProfile('Elektro-SUV für zwei Kinder bis 350 €');
const ctx = { searchProfile: null, searchFilters: null, needProfile };
let working = profile;
const askedIds = new Set();
for (let i = 0; i < 12; i += 1) {
  const q = getNextConsultationQuestion(working, ctx);
  if (!q) break;
  askedIds.add(q.id);
  working = {
    ...working,
    answers: { ...working.answers, [q.id]: q.options[0].id },
  };
}
assert.ok(!askedIds.has('heatPump'), 'Wärmepumpe gehört nicht in Welt 1');
assert.ok(!askedIds.has('hud'));

const vehicleQ = getNextVehicleConsultationQuestion(working, {
  ...ctx,
  primaryModelKey: 'ev3',
});
assert.equal(vehicleQ?.id, 'heatPump');

// NeedProfile aus Freitext
assert.ok(needProfile.fuel === 'electric' || needProfile.priorities?.includes('family'));
const labels = buildUnderstoodLabels(needProfile);
assert.ok(labels.some((l) => /Elektro|Familie|Budget/i.test(l)));

// Primärempfehlung statt gleichwertiger Shortlist
const needRec = buildNeedWorldRecommendation({
  profile,
  needProfile,
  searchProfile: { maxMonthlyRate: 350, seatsMin: 5 },
  searchBundle: {
    exact: {
      modelLineGroups: [
        { modelLineKey: 'ev3', label: 'EV3', primaryMatch: { vehicle: { modelKey: 'ev3' } } },
        { modelLineKey: 'ev4', label: 'EV4', primaryMatch: { vehicle: { modelKey: 'ev4' } } },
        { modelLineKey: 'niro-ev', label: 'Niro EV', primaryMatch: { vehicle: { modelKey: 'niro-ev' } } },
      ],
    },
  },
});
assert.ok(needRec.ready);
assert.match(needRec.headline, /EV3/i);
assert.equal(needRec.primary.modelKey, 'ev3');
assert.equal(needRec.alternatives.length, 2);
assert.ok(!needRec.primary.trimLabel);

// Orchestrator-Gate
assert.ok(requiresVehicleConsultationWorld({ queryType: QUERY_TYPES.MODEL_EQUIPMENT_QUESTION }));
const gate = buildWorldGateRedirect({ modelKey: 'ev3', modelLabel: 'EV3' });
assert.equal(gate.worldGate, CLEVER_WORLD.NEED_CONSULTATION);

assert.ok(GOLDEN_RULE_NEVER_ASK_KNOWN.includes('niemals'));

// NeedProfile unter lead.crm.needProfile
const leadWithProfile = mergeNeedProfileIntoLead({ id: 'lead-1', crm: {} }, needProfile);
assert.ok(leadWithProfile.crm.needProfile);
assert.equal(leadWithProfile.crm.needProfile.fuel, needProfile.fuel);
assert.ok(Array.isArray(leadWithProfile.crm.needProfile.understoodLabels));

console.log('consultationPhase1.test.js: ok');
