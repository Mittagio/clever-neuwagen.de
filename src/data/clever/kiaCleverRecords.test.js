/**
 * Kia Clever Records – Vollständigkeit aller kia.com DE Modelllinien
 */
import assert from 'node:assert/strict';
import { KIA_OFFICIAL_MODELS } from '../kia/kiaOfficialPriceList.js';
import { KIA_CLEVER_RECORDS } from './kiaCleverRecords.js';
import { buildAllKiaCleverRecords, listOfficialModelKeysWithRecords } from './buildKiaCleverRecords.js';
import { resolveCleverRecord } from './cleverDataRegistry.js';

const officialIds = KIA_OFFICIAL_MODELS.map((m) => m.id);
const recordIds = new Set(KIA_CLEVER_RECORDS.map((r) => r.id));

for (const id of officialIds) {
  const expectedId = `kia-${id}`;
  assert.ok(recordIds.has(expectedId), `Clever Record fehlt für ${id} (${expectedId})`);
}

assert.equal(KIA_CLEVER_RECORDS.length, officialIds.length + 2,
  '28 offizielle Modelllinien + 2 Trim-Detail-Records');

const rebuild = buildAllKiaCleverRecords();
assert.equal(rebuild.length, KIA_CLEVER_RECORDS.length);

const modelKeys = new Set(listOfficialModelKeysWithRecords());
assert.ok(modelKeys.has('ev4-fastback'));
assert.ok(modelKeys.has('sportage-hybrid'));
assert.ok(modelKeys.has('pv5-cargo'));

const ev9Air = resolveCleverRecord({
  brand: 'Kia',
  modelKey: 'ev9',
  trimId: 'air',
  powertrain: 'elektro',
});
assert.equal(ev9Air?.id, 'kia-ev9-air');
assert.equal(ev9Air?.towing?.brakedKg, 2500);

const ev3Base = resolveCleverRecord({
  brand: 'Kia',
  modelKey: 'ev3',
  powertrain: 'elektro',
});
assert.ok(ev3Base, 'EV3 Basis-Record');
assert.equal(ev3Base.id, 'kia-ev3');
assert.ok(ev3Base.electric?.wltpRangeKm >= 500);

console.log(`kiaCleverRecords.test.js: ok (${KIA_CLEVER_RECORDS.length} Records)`);
