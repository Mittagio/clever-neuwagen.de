import assert from 'node:assert/strict';
import { buildVehicleFactAnswer } from '../dealer/vehicleFactAnswerService.js';
import {
  __resetStammdatenOverridesForTest,
  applyFieldAnswer,
  getCleverRecordForModelKey,
} from './vehicleStammdatenOverrideService.js';

__resetStammdatenOverridesForTest({});

const before = getCleverRecordForModelKey('ev5');
assert.ok(before);
assert.equal(before.towing?.roofLoadKg ?? null, null);

applyFieldAnswer({ modelKey: 'ev5', field: 'roofLoad', value: 80 });

const after = getCleverRecordForModelKey('ev5');
assert.equal(after.towing?.roofLoadKg, 80);

const answer = buildVehicleFactAnswer({ modelKey: 'ev5', field: 'roofLoad' }, 'EV5 Dachlast');
assert.ok(answer);
assert.ok(!answer.dataGap);
assert.ok(answer.lead?.includes('80'));

__resetStammdatenOverridesForTest({});
console.log('vehicleStammdatenOverrideService.test.js: ok');
