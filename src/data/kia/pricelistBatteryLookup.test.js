import assert from 'node:assert/strict';
import {
  getPricelistBatteryKwh,
  parseBatteryKwhFromEngine,
  resolveElectricSpecs,
} from './pricelistBatteryLookup.js';
import { KIA_CLEVER_RECORDS } from '../clever/kiaCleverRecords.js';

assert.equal(parseBatteryKwhFromEngine('42,2-kWh-Batterie; 108 kW'), 42.2);
assert.equal(parseBatteryKwhFromEngine('81,4-kWh-Batterie, 150 kW'), 81.4);

const ev2 = getPricelistBatteryKwh('ev2');
assert.equal(ev2?.batteryGrossKwh, 42.2);
assert.deepEqual(ev2?.batteryOptionsKwh, [42.2]);

const ev3 = getPricelistBatteryKwh('ev3');
assert.ok(ev3?.batteryOptionsKwh.length >= 2);

const record = KIA_CLEVER_RECORDS.find((r) => r.modelKey === 'ev2');
const resolved = resolveElectricSpecs(record);
assert.equal(resolved.batteryGrossKwh, 42.2);

const ev9Air = KIA_CLEVER_RECORDS.find((r) => r.modelKey === 'ev9' && r.trimId === 'air');
const ev9Resolved = resolveElectricSpecs(ev9Air);
assert.equal(ev9Resolved.batteryNetKwh, 96);

console.log('pricelistBatteryLookup.test.js: ok');
