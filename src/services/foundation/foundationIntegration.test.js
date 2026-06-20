/**
 * Integration: Foundation → Legacy-Adapter → Konfigurator-Brücke
 */
import assert from 'node:assert/strict';
import { kiaFoundationSeed, KIA_MODEL_YEAR_BY_KEY } from '../../data/foundation/seeds/kiaFoundationSeed.js';
import { resolveFoundationLegacyEntry, hasFoundationModel } from './configuratorFoundationRegistry.js';
import { resolveConfigureModel } from '../configuration/configureModelBridge.js';
import { buildPackageCatalog } from '../configuration/configurePackageCatalog.js';

const MODELS = ['sportage', 'ev2', 'ev3', 'stonic', 'niro'];

for (const modelKey of MODELS) {
  assert.ok(hasFoundationModel(modelKey), `${modelKey} in Foundation`);
  assert.ok(KIA_MODEL_YEAR_BY_KEY[modelKey], `${modelKey} modelYearId`);

  const legacy = resolveFoundationLegacyEntry(modelKey);
  assert.ok(legacy?._foundation, `${modelKey} legacy entry`);
  assert.ok(legacy.data.trims.length >= 3, `${modelKey} trims`);
  assert.ok(legacy.data.packages.length >= 1 || modelKey === 'picanto', `${modelKey} packages`);

  const viaBridge = resolveConfigureModel(modelKey);
  assert.equal(viaBridge?._foundation, true, `${modelKey} via bridge`);
  assert.equal(viaBridge?.key, modelKey);

  const trimId = viaBridge.defaultTrimId ?? viaBridge.data.trims[0]?.id;
  const catalog = buildPackageCatalog(modelKey, trimId, []);
  assert.ok(Array.isArray(catalog.packages), `${modelKey} package catalog`);
}

const ev2Deps = resolveConfigureModel('ev2');
const earthTrim = ev2Deps.data.trims.find((t) => t.id === 'earth');
const drivewisePkg = ev2Deps.data.packages.find((p) => p.id === 'ev2-drivewise-park');
if (drivewisePkg?.requiresPackages?.length) {
  const cat = buildPackageCatalog('ev2', 'earth', []);
  const dw = cat.packages.find((p) => p.id === 'ev2-drivewise-park');
  assert.ok(dw?.status === 'blocked' || dw?.missingRequiredLabels?.length, 'EV2 DriveWise Abhängigkeit');
}

console.log('foundation integration tests OK');
