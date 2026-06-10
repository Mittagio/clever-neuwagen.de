import assert from 'node:assert/strict';
import { KIA_CLEVER_RECORDS } from '../../data/clever/kiaCleverRecords.js';
import { narrateBattery, narrateComparison, narrateAttribute } from './smartAnswerNarrative.js';
import { resolveElectricSpecs } from '../../data/kia/pricelistBatteryLookup.js';
import { buildDealerSmartAnswer } from './dealerSmartAnswerService.js';
import { getKiaTrinklePilotStock } from '../../data/kia/kiaTrinkleStock.js';

const ev9 = KIA_CLEVER_RECORDS.find((r) => r.modelKey === 'ev9');
const sorento = KIA_CLEVER_RECORDS.find((r) => r.modelKey === 'sorento-hybrid' || r.modelKey === 'sorento')
  ?? KIA_CLEVER_RECORDS.find((r) => r.modelKey.startsWith('sorento'));

const cmp = narrateComparison(ev9, sorento, 'ev9 oder sorento anhänge');
assert.match(cmp.title, /EV9 oder Sorento/i);
assert.ok(cmp.lead);
assert.ok(cmp.narrative.some((n) => /2,5/.test(n)));
assert.equal(cmp.modelCards.length, 2);

const ev2 = KIA_CLEVER_RECORDS.find((r) => r.modelKey === 'ev2');
const len = narrateAttribute(ev2, 'length');
assert.match(len.lead, /4,00 m/);

const ev2Batt = narrateBattery(ev2, resolveElectricSpecs(ev2));
assert.match(ev2Batt.lead, /42,2.*kWh/i);
assert.ok(ev2Batt.narrative.some((n) => /350 km/.test(n)));

const ans = buildDealerSmartAnswer('ev9 oder sorento anhänge', getKiaTrinklePilotStock());
assert.equal(ans.kicker, 'Clever Antwort');
assert.ok(ans.modelCards?.length === 2);
assert.ok(ans.facts?.length > 0);

console.log('smartAnswerNarrative.test.js: ok');
