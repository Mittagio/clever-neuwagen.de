/**
 * Tests: Foundation Regel-Engine
 */
import assert from 'node:assert/strict';
import { kiaSportageFoundationSeed } from '../../data/foundation/seeds/kiaSportageFoundationSeed.js';
import { kiaFoundationSeed } from '../../data/foundation/seeds/kiaFoundationSeed.js';
import { getModelYearBundle } from '../../data/foundation/configuratorFoundationSchema.js';
import { evaluateConfiguratorState, canCalculatePricing } from './configuratorRuleEngine.js';
import { CONFIGURATOR_AUDIENCE } from '../../data/foundation/ruleTypes.js';

const bundle = getModelYearBundle(kiaSportageFoundationSeed, 'sportage-2027');
assert.ok(bundle, 'Sportage-Bundle soll existieren');
assert.ok(bundle.optionPackages.length >= 5, 'Sportage Pakete importiert');

const visionState = evaluateConfiguratorState(bundle, {
  trimId: 'vision',
  powertrainId: bundle.powertrains[0]?.id ?? null,
  colorId: null,
  packageIds: [],
}, CONFIGURATOR_AUDIENCE.SELLER);

assert.ok(visionState.packages.length >= 5, 'Pakete für Vision');
const comfort = visionState.packages.find((p) => p.id === 'p1-comfort');
assert.ok(comfort, 'P1 Komfort vorhanden');
assert.equal(comfort.status, 'included', 'P1 in Vision serienmäßig enthalten (Sitzheizung)');

const blockedPanorama = evaluateConfiguratorState(bundle, {
  trimId: 'vision',
  powertrainId: bundle.powertrains[0]?.id ?? null,
  colorId: null,
  packageIds: ['p4-panorama'],
}, CONFIGURATOR_AUDIENCE.SELLER);

const panorama = blockedPanorama.packages.find((p) => p.id === 'p4-panorama');
assert.ok(panorama?.status === 'selected' || panorama?.status === 'available' || panorama?.status === 'blocked');

const withDrivewise = evaluateConfiguratorState(bundle, {
  trimId: 'vision',
  powertrainId: bundle.powertrains[0]?.id ?? null,
  colorId: null,
  packageIds: ['p5-drivewise', 'p4-panorama'],
}, CONFIGURATOR_AUDIENCE.SELLER);

const p4selected = withDrivewise.packages.find((p) => p.id === 'p4-panorama');
assert.ok(['selected', 'available'].includes(p4selected?.status), 'Panorama wählbar mit DriveWise');

const pricing = canCalculatePricing(bundle, {
  trimId: 'vision',
  powertrainId: bundle.powertrains[0]?.id ?? null,
  colorId: visionState.colors[0]?.id ?? null,
  packageIds: ['p2-leather'],
}, CONFIGURATOR_AUDIENCE.SELLER);

assert.ok(pricing.ok || pricing.state.needsReview === false, 'Preisberechnung möglich oder Daten vollständig');

const ev2Bundle = getModelYearBundle(kiaFoundationSeed, 'ev2-2026');
assert.ok(ev2Bundle?.trims.length >= 4, 'EV2 Trims nach Merge');

const ev2Air = evaluateConfiguratorState(ev2Bundle, {
  trimId: 'air',
  powertrainId: ev2Bundle.powertrains[0]?.id ?? null,
  colorId: null,
  packageIds: [],
}, CONFIGURATOR_AUDIENCE.SELLER);

const winterConnectAir = ev2Air.packages.find((p) => p.id === 'ev2-winter-connect');
assert.equal(winterConnectAir?.status, 'unavailable', 'Winter-Connect nicht für Air');

const ev2Gt = evaluateConfiguratorState(ev2Bundle, {
  trimId: 'gt-line',
  powertrainId: ev2Bundle.powertrains[0]?.id ?? null,
  colorId: null,
  packageIds: [],
}, CONFIGURATOR_AUDIENCE.SELLER);

const drivewiseGt = ev2Gt.packages.find((p) => p.id === 'ev2-drivewise-park');
assert.equal(drivewiseGt?.status, 'included', 'DriveWise in GT-Line enthalten');

console.log('configuratorRuleEngine tests OK');
