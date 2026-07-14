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

function testHybridHevCandidates() {
  const profile = mergeTextIntoNeedProfile('Hybrid für Familie');
  profile.fuel = 'hybrid';
  const understanding = buildCustomerUnderstanding({ crm: { needProfile: profile } });
  const result = runSellerReasoning({ needProfile: profile, customerUnderstanding: understanding });

  const keys = result.items.map((i) => i.modelKey);
  assert.ok(keys.includes('sportage-hybrid'), 'Sportage HEV sollte dabei sein');
  assert.ok(keys.includes('sorento-hybrid'), 'Sorento HEV sollte dabei sein');
  assert.ok(keys.includes('niro'), 'Niro HEV sollte dabei sein');
  console.log('✓ Hybrid → Sportage HEV, Sorento HEV, Niro HEV');
}

function testHybridLangstreckePrefersHev() {
  const profile = mergeTextIntoNeedProfile('Hybrid Langstrecke');
  profile.fuel = 'hybrid';
  const understanding = buildCustomerUnderstanding({ crm: { needProfile: profile } });
  const result = runSellerReasoning({
    needProfile: profile,
    answers: { longDistance: 'often' },
    customerUnderstanding: understanding,
  });

  const top = result.items[0]?.modelKey ?? '';
  assert.ok(
    top === 'sportage-hybrid' || top === 'sorento-hybrid',
    `Erwartet HEV-SUV oben, bekam: ${top}`,
  );
  const msg = buildVehicleReactionMessage('longDistance', 'often', {
    needProfile: profile,
    answers: {},
  });
  assert.match(msg ?? '', /Vollhybrid|Sportage HEV|Sorento HEV/i);
  console.log('✓ Hybrid + Langstrecke → HEV-Kandidaten bevorzugt');
}

function testHybridPowertrainQuestionPrompt() {
  assert.match(
    buildSellerQuestionPrompt({
      needProfile: { fuel: 'hybrid' },
      question: { id: 'hybridPowertrain', prompt: 'HEV oder PHEV?' },
    }),
    /Vollhybrid \(HEV\).*Plug-in-Hybrid \(PHEV\)/i,
  );
  console.log('✓ hybridPowertrain-Frage formuliert');
}

testElectricFamilyHypothesis();
testTrailerExclusion();
testHybridTrailerQuestionImpact();
testReactionAfterUrlaub();
testHybridHevCandidates();
testHybridLangstreckePrefersHev();
testHybridPowertrainQuestionPrompt();
console.log('\nSeller Reasoning Engine Tests bestanden.');
