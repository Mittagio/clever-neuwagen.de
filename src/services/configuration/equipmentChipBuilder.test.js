import assert from 'node:assert/strict';
import { getChipEligibleGlobalFeatures } from '../../data/features/globalFeatureCatalog.js';
import { FEATURE_AVAILABILITY_STATUS as S } from '../../data/features/modelEquipmentSchema.js';
import {
  buildEquipmentChipsForModel,
  getRecommendedEquipmentChips,
  resolveChipToScoringFeatureIds,
} from './equipmentChipBuilder.js';
import {
  isEquipmentWishAlreadySelected,
  mergeSearchedIntoFeatureIds,
  searchEquipmentFeature,
} from './equipmentFeatureSearch.js';
import {
  analyzeEquipmentWishSelection,
  getEquipmentWishChipGroups,
  toggleEquipmentChip,
} from './equipmentWishAdvisor.js';
import { getEquipmentWishChip, isChipSelected } from '../../data/features/equipmentWishChips.js';

const KIA = 'Kia';

// --- Generierung aus globalem Katalog ---
const chipEligible = getChipEligibleGlobalFeatures();
assert.ok(chipEligible.length > 0);
assert.ok(chipEligible.every((f) => f.showAsChip === true));

const ev2Groups = buildEquipmentChipsForModel(KIA, 'EV2', 'ev2');
const ev2Chips = ev2Groups.flatMap((g) => g.chips);
assert.ok(ev2Chips.length > 0, 'EV2 soll modellrelevante Chips haben');
assert.ok(ev2Chips.every((c) => c.showAsChip === true));
assert.ok(ev2Chips.every((c) => c.featureId === c.globalFeatureId));
assert.ok(!ev2Chips.some((c) => c.status === S.NOT_AVAILABLE));
assert.ok(!ev2Chips.some((c) => c.status === S.UNKNOWN));

const waermepumpeChip = ev2Chips.find((c) => c.featureId === 'waermepumpe');
assert.ok(waermepumpeChip, 'Wärmepumpe-Chip auf EV2');
assert.equal(waermepumpeChip.legacyFeatureId, 'heat_pump');

// Gruppierung nach Kategorie
assert.ok(ev2Groups.some((g) => g.label === 'Sitze & Komfort' || g.label === 'Elektro & Laden'));

// getEquipmentWishChipGroups nutzt Builder
const groups = getEquipmentWishChipGroups(KIA, 'EV2', 'ev2');
assert.equal(groups.length, ev2Groups.length);

// --- EV3 Head-up-Display über Paket ---
const ev3Chips = getRecommendedEquipmentChips(KIA, 'EV3', 'ev3');
const hudChip = ev3Chips.find((c) => c.featureId === 'head_up_display');
assert.ok(hudChip, 'HUD-Chip auf EV3');
assert.equal(hudChip.status, S.PACKAGE_REQUIRED);
assert.ok(hudChip.availabilitySummary?.includes('über'), 'Paket als Lösung, nicht als Chip-Label');
assert.ok(hudChip.label === 'Head-up-Display');
assert.notEqual(hudChip.label.toLowerCase(), 'premium');

const advisorHud = analyzeEquipmentWishSelection(KIA, 'EV3', ['head_up_display'], {
  modelKey: 'ev3',
});
const lineWithHud = advisorHud.trimLines.find((line) =>
  line.fulfilled?.some((f) => f.toLowerCase().includes('head-up')),
);
assert.ok(lineWithHud, 'Variante zeigt Head-up-Display als Wunsch');
assert.ok(!lineWithHud.fulfilled?.some((f) => f.toLowerCase() === 'premium-paket' || f === 'Premium-Paket'));

// --- Chip-Klick speichert globale Feature-ID ---
let selected = toggleEquipmentChip([], 'waermepumpe');
assert.deepEqual(selected, ['waermepumpe']);
assert.ok(isChipSelected('waermepumpe', selected));
assert.equal(resolveChipToScoringFeatureIds('waermepumpe')[0], 'heat_pump');

selected = toggleEquipmentChip(selected, 'waermepumpe');
assert.equal(selected.length, 0);

// --- Keine Duplikate Chip + Suche ---
const heatSearch = searchEquipmentFeature('Wärmepumpe', KIA, 'EV2', 'ev2', {
  selectedFeatureIds: ['waermepumpe'],
  selectedChipIds: ['waermepumpe'],
  searchedFeatures: [],
});
assert.equal(heatSearch.type, 'duplicate');

const merged = mergeSearchedIntoFeatureIds(
  resolveChipToScoringFeatureIds('waermepumpe'),
  [],
);
assert.ok(merged.featureIds.includes('heat_pump'));

// Chip und Suche dieselbe globale ID
const searchMatch = searchEquipmentFeature('Wärmepumpe', KIA, 'EV2', 'ev2');
assert.equal(searchMatch.item?.globalFeatureId, 'waermepumpe');

assert.ok(isEquipmentWishAlreadySelected(
  { entry: { catalogId: 'waermepumpe', globalFeatureId: 'waermepumpe', featureId: 'heat_pump', label: 'Wärmepumpe' } },
  { selectedFeatureIds: ['waermepumpe'], selectedChipIds: ['waermepumpe'], searchedFeatures: [] },
));

// --- advisorRelevant=false erhöht Scoring nicht ---
const advisorWithHeat = analyzeEquipmentWishSelection(KIA, 'EV2', ['waermepumpe'], { modelKey: 'ev2' });
const advisorEmpty = analyzeEquipmentWishSelection(KIA, 'EV2', [], { modelKey: 'ev2' });
assert.ok(advisorWithHeat.trimLines[0]?.matchPercent > advisorEmpty.trimLines[0]?.matchPercent);

const chip = getEquipmentWishChip('waermepumpe');
assert.equal(chip.globalFeatureId, 'waermepumpe');

console.log('equipmentChipBuilder.test.js: ok');
