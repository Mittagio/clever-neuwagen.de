import assert from 'node:assert/strict';
import { matchVehicleQuestion } from './vehicleQuestionMatcher.js';
import { buildDealerSmartAnswer } from './dealerSmartAnswerService.js';

const battery = matchVehicleQuestion('Wie groß ist die Batterie vom EV9?');
assert.ok(battery);
assert.equal(battery.intentId, 'battery_size');
assert.equal(battery.modelKey, 'ev9');
assert.equal(battery.factField, 'batteryKwh');

const tow = matchVehicleQuestion('Anhängelast EV9 Wohnwagen');
assert.equal(tow.intentId, 'towing_capacity');

const answer = buildDealerSmartAnswer('Wie groß ist die Batterie vom EV9?', []);
assert.ok(answer);
assert.ok(answer.narrative?.length || answer.lead?.includes('kWh') || answer.lead?.includes('99'));
assert.equal(answer.primaryModelKey, 'ev9');
assert.ok(answer.showViewModelCta);

const gap = buildDealerSmartAnswer('EV5 Dachlast', []);
assert.ok(gap?.dataGap || gap?.lead);

const power = buildDealerSmartAnswer('Wie viel PS hat der EV9?', []);
assert.ok(power);
assert.ok(!power.dataGap);
assert.ok(power.lead?.includes('204') || power.facts?.some((f) => f.value?.includes('204')));

const warranty = buildDealerSmartAnswer('Garantie EV9', []);
assert.ok(warranty);
assert.ok(!warranty.dataGap);
assert.ok(warranty.lead?.includes('7') || warranty.narrative?.some((n) => n.includes('7')));

const leather = buildDealerSmartAnswer('Leder EV9', []);
assert.ok(leather);
assert.ok(!leather.dataGap);
assert.ok(leather.lead?.includes('Paket') || leather.lead?.includes('serien'));

const delivery = buildDealerSmartAnswer('Lieferzeit EV4', []);
assert.ok(delivery);
assert.ok(!delivery.dataGap);
assert.ok(delivery.lead?.includes('Woche') || delivery.facts?.length);

console.log('vehicleQuestionMatcher.test.js: ok');
