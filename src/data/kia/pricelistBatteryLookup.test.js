import assert from 'node:assert/strict';
import {
  getPricelistBatteryKwh,
  parseBatteryKwhFromEngine,
  resolveBatteryForModelKey,
  resolveElectricSpecs,
} from './pricelistBatteryLookup.js';
import { KIA_CLEVER_RECORDS } from '../clever/kiaCleverRecords.js';

assert.equal(parseBatteryKwhFromEngine('42,2-kWh-Batterie; 108 kW'), 42.2);
assert.equal(parseBatteryKwhFromEngine('81,4-kWh-Batterie, 150 kW'), 81.4);
assert.equal(parseBatteryKwhFromEngine('63-kWh-Batterie'), 63);
assert.equal(parseBatteryKwhFromEngine('84-kWh-Batterie'), 84);

const ev6 = getPricelistBatteryKwh('ev6');
assert.equal(ev6?.batteryGrossKwh, 63);
assert.deepEqual(ev6?.batteryOptionsKwh, [63, 84]);

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

const ev9Base = KIA_CLEVER_RECORDS.find((r) => r.modelKey === 'ev9' && !r.trimId);
assert.ok(ev9Base?.electric?.batteryOptionsKwh?.length >= 2);

const pv5Cargo = resolveBatteryForModelKey('pv5-cargo');
assert.deepEqual(pv5Cargo?.batteryOptionsKwh, [51.5, 71.2]);

console.log('pricelistBatteryLookup.test.js: ok');
