import assert from 'node:assert/strict';
import { mergeTextIntoNeedProfile } from '../consultation/needProfileService.js';
import { buildCustomerUnderstanding } from '../dealer/customerUnderstanding.js';
import {
  runSellerReasoning,
  scoreQuestionImpact,
  buildSellerQuestionPrompt,
  buildVehicleReactionMessage,
} from './sellerReasoningEngine.js';

function testElectricFamilyHypothesis() {
  const profile = mergeTextIntoNeedProfile('Elektro für Familie mit 400 km Reichweite');
  const understanding = buildCustomerUnderstanding({ crm: { needProfile: profile } });
  const result = runSellerReasoning({ needProfile: profile, customerUnderstanding: understanding });

  assert.ok(result.items.length >= 2);
  assert.ok(result.hypothesisLead?.includes('EV'));
  assert.match(
    buildSellerQuestionPrompt({
      needProfile: profile,
      question: { id: 'longDistance', prompt: 'Langstrecke?' },
      customerUnderstanding: understanding,
    }),
    /Wie nutzen Sie das Fahrzeug überwiegend/i,
  );
  console.log('✓ Elektro Familie → Fahrzeughypothese + Langstreckenfrage');
}

function testTrailerExclusion() {
  const profile = mergeTextIntoNeedProfile('Elektro Familie mit 1.500 kg Anhängelast');
  profile.towCapacityKg = 1500;
  const understanding = buildCustomerUnderstanding({ crm: { needProfile: profile } });
  const result = runSellerReasoning({ needProfile: profile, customerUnderstanding: understanding });

  const ev3Faded = result.fadedItems.find((item) => item.modelKey === 'ev3');
  assert.ok(ev3Faded, 'EV3 sollte ausgeschlossen werden');
  assert.match(ev3Faded.exclusionReason ?? '', /Anhängelast/i);
  assert.ok(result.exclusionNote?.includes('EV3'));
  console.log('✓ 1.500 kg Anhängelast → EV3 faded mit Begründung');
}

function testHybridTrailerQuestionImpact() {
  const profile = mergeTextIntoNeedProfile('Hybrid mit 1.500 kg Anhängelast');
  profile.towCapacityKg = 1500;
  profile.fuel = 'hybrid';
  const understanding = buildCustomerUnderstanding({ crm: { needProfile: profile } });

  const towingImpact = scoreQuestionImpact({
    questionId: 'towingUsage',
    needProfile: profile,
    customerUnderstanding: understanding,
  });
  const chargingImpact = scoreQuestionImpact({
    questionId: 'chargingAtHome',
    needProfile: profile,
    answers: {},
    customerUnderstanding: understanding,
  });

  assert.ok(towingImpact >= chargingImpact);
  console.log('✓ Hybrid Anhänger → Anhängerart wichtiger als Wallbox');
}

function testReactionAfterUrlaub() {
  const profile = mergeTextIntoNeedProfile('Elektro Familie');
  const msg = buildVehicleReactionMessage('longDistance', 'often', {
    needProfile: profile,
    answers: {},
  });
  assert.match(msg ?? '', /EV6/i);
  console.log('✓ Urlaub-Antwort → EV6-Reaktion');
}

testElectricFamilyHypothesis();
testTrailerExclusion();
testHybridTrailerQuestionImpact();
testReactionAfterUrlaub();
console.log('\nSeller Reasoning Engine Tests bestanden.');
