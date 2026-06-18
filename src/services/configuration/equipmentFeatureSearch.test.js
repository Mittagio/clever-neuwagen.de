import assert from 'node:assert/strict';
import { GLOBAL_FEATURE_CATALOG } from '../../data/features/globalFeatureCatalog.js';
import {
  createReservedSearchItem,
  mergeSearchedIntoFeatureIds,
  searchEquipmentFeature,
  searchedFeatureToWishFeature,
} from './equipmentFeatureSearch.js';
import { analyzeEquipmentWishSelection } from './equipmentWishAdvisor.js';
import { normalizeEquipmentQuery } from './equipmentQueryUtils.js';

const BRAND = 'Kia';
const MODEL = 'EV2';
const MODEL_KEY = 'ev2';

function search(query, ctx = {}) {
  return searchEquipmentFeature(query, BRAND, MODEL, MODEL_KEY, ctx);
}

assert.equal(GLOBAL_FEATURE_CATALOG.length, 100);

// Normalisierung
assert.equal(normalizeEquipmentQuery('bi direktional').normalized, 'bidirektional');

// Wärmepumpe – bereits per Chip aktiv
const heatPumpDuplicate = search('Wärmepumpe', {
  selectedFeatureIds: ['waermepumpe'],
  searchedFeatures: [],
  selectedChipIds: ['waermepumpe'],
});
assert.equal(heatPumpDuplicate.type, 'duplicate');

// Wärmepumpe – eindeutiger Treffer
const heatPump = search('Wärmepumpe');
assert.equal(heatPump.type, 'match');
assert.equal(heatPump.item?.globalFeatureId, 'waermepumpe');
assert.equal(heatPump.item?.featureId, 'heat_pump');
assert.equal(searchedFeatureToWishFeature(heatPump.item).uncertain, false);

const merged = mergeSearchedIntoFeatureIds([], [heatPump.item]);
assert.ok(merged.featureIds.includes('heat_pump'));

// LED – Vorschläge oder eindeutiger Treffer
const led = search('LED');
assert.ok(['ambiguous', 'match'].includes(led.type));
if (led.type === 'ambiguous') {
  assert.ok(led.suggestions.length >= 2);
}

// bi direktional → V2L
const bidirectional = search('bi direktional');
assert.equal(bidirectional.type, 'match');
assert.equal(bidirectional.item?.label, 'V2L / Vehicle-to-Load');
assert.equal(bidirectional.item?.globalFeatureId, 'v2l');
assert.ok(['available', 'standard', 'optional'].includes(bidirectional.item?.modelStatus));

// LED-Scheinwerfer auf EV2
const ledHeadlights = search('LED-Scheinwerfer');
assert.equal(ledHeadlights.type, 'match');
assert.equal(ledHeadlights.item?.globalFeatureId, 'led_scheinwerfer');
assert.ok(['available', 'standard', 'optional'].includes(ledHeadlights.item?.modelStatus));

const v2l = search('V2L');
assert.equal(v2l.type, 'match');
assert.equal(v2l.item?.globalFeatureId, 'v2l');

const mergedBoth = mergeSearchedIntoFeatureIds([], [ledHeadlights.item, v2l.item]);
assert.equal(mergedBoth.confirmedCatalogWishes.length, 2);
assert.equal(mergedBoth.uncertainLabels.length, 0);

const advisor = analyzeEquipmentWishSelection(BRAND, MODEL, [], {
  modelKey: MODEL_KEY,
  searchedFeatures: [ledHeadlights.item, v2l.item],
});
const airLine = advisor.trimLines.find((line) => line.trimName === 'Air');
assert.ok(airLine?.fulfilled?.includes('LED-Scheinwerfer'));
assert.ok(airLine?.fulfilled?.includes('V2L / Vehicle-to-Load'));

// Totwinkelassistent – EV2 Air Serie (kein „wird geprüft“)
const blindSpotChip = analyzeEquipmentWishSelection(BRAND, MODEL, ['blind_spot'], {
  modelKey: MODEL_KEY,
});
const airBlindSpot = blindSpotChip.trimLines.find((line) => line.trimName === 'Air');
assert.ok(airBlindSpot?.fulfilled?.includes('Totwinkelassistent'));
assert.equal(airBlindSpot?.uncertain?.length ?? 0, 0);
assert.equal(airBlindSpot?.matchPercent, 100);

const blindSpotSearch = search('Totwinkelassistent');
assert.equal(blindSpotSearch.type, 'match');
assert.equal(blindSpotSearch.item?.modelStatus, 'standard');
assert.ok(blindSpotSearch.item?.availableTrims?.some((trim) => trim.trimId === 'air'));

const blindSpotAdvisor = analyzeEquipmentWishSelection(BRAND, MODEL, [], {
  modelKey: MODEL_KEY,
  searchedFeatures: [blindSpotSearch.item],
});
const airBlindSpotSearch = blindSpotAdvisor.trimLines.find((line) => line.trimName === 'Air');
assert.ok(airBlindSpotSearch?.fulfilled?.includes('Totwinkelassistent'));
assert.equal(airBlindSpotSearch?.uncertain?.length ?? 0, 0);

// xyz abc – nicht im globalen Katalog
const unknown = search('xyz abc');
assert.equal(unknown.type, 'not_found');
assert.ok(unknown.hint?.includes('Autohaus'));

const reserved = createReservedSearchItem('xyz abc');
assert.equal(reserved.modelStatus, 'reserved');
assert.equal(searchedFeatureToWishFeature(reserved).uncertain, true);

// Beifahrersitz elektrisch – Katalog ja, Modell unklar
const passengerSeat = search('Beifahrersitz elektrisch');
assert.equal(passengerSeat.type, 'unconfirmed');
assert.equal(passengerSeat.feature?.id, 'elektrische_sitzverstellung_beifahrer');
assert.equal(passengerSeat.message, 'Für dieses Modell aktuell nicht eindeutig gefunden.');

// Head Up – global erkannt, auf EV2 aktuell nicht eindeutig im Modellindex
const hud = search('Head Up');
assert.equal(hud.type, 'unconfirmed');
assert.equal(hud.feature?.id, 'head_up_display');
assert.equal(hud.item?.label, 'Head-up-Display');

console.log('equipmentFeatureSearch.test.js: ok (3-layer, EV2)');
