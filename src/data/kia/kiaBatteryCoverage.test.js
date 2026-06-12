/**
 * node src/data/kia/kiaBatteryCoverage.test.js
 */
import assert from 'node:assert/strict';
import { KIA_OFFICIAL_MODELS } from './kiaOfficialPriceList.js';
import { buildDealerSmartAnswer } from '../../services/dealer/dealerSmartAnswerService.js';
import { getCleverRecordForModelKey } from '../../services/admin/vehicleStammdatenOverrideService.js';
import { resolveElectricSpecs } from './pricelistBatteryLookup.js';

const MODEL_KEY_ALIASES = {
  'pv5-cargo-l2h1': 'pv5-cargo',
};

const ELECTRIC_POWERTRAINS = new Set(['elektro', 'nutzfahrzeug', 'plugin-hybrid']);

for (const official of KIA_OFFICIAL_MODELS) {
  if (!ELECTRIC_POWERTRAINS.has(official.powertrain)) continue;

  const modelKey = MODEL_KEY_ALIASES[official.id] ?? official.id;
  const record = getCleverRecordForModelKey(modelKey);
  assert.ok(record, `${modelKey}: kein Clever Record`);

  const electric = resolveElectricSpecs(record);
  const hasBattery = electric.batteryGrossKwh != null
    || electric.batteryNetKwh != null
    || (electric.batteryOptionsKwh?.length > 0);
  assert.ok(hasBattery, `${modelKey}: keine Batterie-Stammdaten`);

  const query = `akkugröße ${official.name.replace(/\s+/g, ' ').toLowerCase()}`;
  const answer = buildDealerSmartAnswer(query, []);
  assert.ok(answer, `${modelKey}: keine Smart Answer für "${query}"`);
  assert.ok(!answer.dataGap, `${modelKey}: dataGap bei Batteriefrage`);
  const hasKwhInAnswer = answer.lead?.includes('kWh')
    || answer.narrative?.some((line) => line.includes('kWh'))
    || answer.facts?.some((f) => f.label === 'Batterie' && f.value?.includes('kWh'));
  assert.ok(hasKwhInAnswer, `${modelKey}: Antwort ohne kWh – ${answer.lead}`);
}

console.log('kiaBatteryCoverage.test.js: ok');
