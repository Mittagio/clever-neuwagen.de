import assert from 'node:assert/strict';
import {
  GENERIC_DEMO_IMPORT,
  KIA_EV2_PRICELIST_IMPORT,
  KIA_EV3_PRICELIST_IMPORT,
} from '../../data/imports/sampleEquipmentImports.js';
import { FEATURE_AVAILABILITY_STATUS as S } from '../../data/features/modelEquipmentSchema.js';
import { buildAvailabilitySummary } from './equipmentChipBuilder.js';
import { getRecommendedEquipmentChips } from './equipmentChipBuilder.js';
import {
  ingestEquipmentImport,
  mapImportToModelEquipmentProfile,
  mergeImportedEquipmentProfile,
  normalizeEquipmentImport,
  validateEquipmentImport,
} from './equipmentImportMapper.js';
import {
  clearImportedModelEquipmentProfiles,
  getImportedUnknownFeatures,
  hasImportedModelEquipmentProfile,
} from './equipmentImportRegistry.js';
import { resolveModelFeatureAvailability } from './modelEquipmentData.js';

function setup() {
  clearImportedModelEquipmentProfiles();
}

setup();

// --- Validierung & Normalisierung ---
const ev3Validation = validateEquipmentImport(KIA_EV3_PRICELIST_IMPORT);
assert.equal(ev3Validation.valid, true, ev3Validation.errors.join('; '));

const normalized = normalizeEquipmentImport(KIA_EV3_PRICELIST_IMPORT);
assert.equal(normalized.modelKey, 'ev3');
assert.equal(normalized.trims.find((t) => t.id === 'gt-line')?.name, 'GT-Line');
assert.equal(normalized.packages.find((p) => p.id === 'premium-paket')?.name, 'Premium Paket');

// --- Bekanntes Feature mit sourceRef ---
const mappedEv3 = mapImportToModelEquipmentProfile(KIA_EV3_PRICELIST_IMPORT);
const hudEntry = mappedEv3.profile.featureAvailability.find(
  (e) => e.featureId === 'head_up_display' && e.trimId === 'earth',
);
assert.ok(hudEntry, 'HUD-Eintrag vorhanden');
assert.equal(hudEntry.status, S.PACKAGE_REQUIRED);
assert.equal(hudEntry.packageId, 'premium-paket');
assert.equal(hudEntry.sourceRef.document, 'Kia EV3 Preisliste MJ26');
assert.ok(mappedEv3.unknownFeatures.some((u) => u.rawLabel === 'Akustikverglasung vorne'));

ingestEquipmentImport(KIA_EV3_PRICELIST_IMPORT, { register: true });
assert.ok(hasImportedModelEquipmentProfile('ev3'));

const resolvedHud = resolveModelFeatureAvailability('Kia', 'EV3', 'ev3', 'head_up_display');
assert.equal(resolvedHud.modelStatus, S.PACKAGE_REQUIRED);
assert.ok(resolvedHud.availablePackages.some((p) => p.name === 'Premium Paket'));
assert.ok(resolvedHud.sourceRefs.includes('Kia EV3 Preisliste MJ26'));

const summary = buildAvailabilitySummary(resolvedHud);
assert.ok(summary.includes('Premium Paket'), `Erwartet Paket als Lösung, erhalten: ${summary}`);
assert.ok(summary.includes('über'));
assert.ok(!summary.startsWith('Premium Paket'));

// --- Unbekanntes Feature ---
setup();
const mappedGeneric = mapImportToModelEquipmentProfile(GENERIC_DEMO_IMPORT);
assert.equal(
  mappedGeneric.profile.featureAvailability.some((e) => e.featureId?.includes('akustik')),
  false,
);
assert.ok(mappedGeneric.unknownFeatures.some((u) => u.rawLabel === 'Akustikverglasung vorne'));
ingestEquipmentImport(GENERIC_DEMO_IMPORT, { register: true });
assert.equal(getImportedUnknownFeatures('demo-model-x').length, 1);

// --- unknown status zählt nicht als Chip ---
setup();
ingestEquipmentImport(KIA_EV2_PRICELIST_IMPORT, { register: true });
const ev2Chips = getRecommendedEquipmentChips('Kia', 'EV2', 'ev2');
assert.ok(!ev2Chips.some((c) => c.featureId === 'panoramadach'));
const unknownPanorama = resolveModelFeatureAvailability('Kia', 'EV2', 'ev2', 'panoramadach');
assert.equal(unknownPanorama.modelStatus, S.UNKNOWN);

// --- Merge-Priorität ---
setup();
const existingProfile = {
  brand: 'Kia',
  model: 'EV3',
  modelKey: 'ev3',
  modelYear: '2026',
  trims: [{ id: 'earth', name: 'Earth' }],
  packages: [{ id: 'premium-paket', name: 'Premium Paket', trimIds: ['earth'] }],
  featureAvailability: [{
    featureId: 'head_up_display',
    trimId: 'earth',
    status: S.STANDARD,
    confidence: 'high',
    source: { type: 'manual_verified', confidence: 'high', validFrom: '2025-01-01' },
    sourceRef: { document: 'Manuell bestätigt', page: null, section: null, rawText: null, url: null },
  }],
  sourceRefs: ['manual'],
  source: { type: 'manual_verified', confidence: 'high', validFrom: '2025-01-01' },
};

const lowImportProfile = mapImportToModelEquipmentProfile({
  ...KIA_EV3_PRICELIST_IMPORT,
  source: { type: 'pricelist', documentName: 'Low Import', validFrom: '2026-06-01', confidence: 'low' },
}).profile;

const merged = mergeImportedEquipmentProfile(existingProfile, lowImportProfile);
const mergedHud = merged.featureAvailability.find(
  (e) => e.featureId === 'head_up_display' && e.trimId === 'earth',
);
assert.equal(mergedHud.status, S.STANDARD, 'manual_verified gewinnt gegen low import');
assert.equal(mergedHud.source.type, 'manual_verified');

const mergedHighVsMedium = mergeImportedEquipmentProfile(
  {
    ...existingProfile,
    featureAvailability: [{
      featureId: 'waermepumpe',
      trimId: 'earth',
      status: S.STANDARD,
      confidence: 'high',
      source: { type: 'pricelist', confidence: 'high', validFrom: '2025-01-01' },
    }],
  },
  {
    ...lowImportProfile,
    featureAvailability: [{
      featureId: 'waermepumpe',
      trimId: 'earth',
      status: S.NOT_AVAILABLE,
      confidence: 'medium',
      source: { type: 'pricelist', confidence: 'medium', validFrom: '2026-06-01' },
    }],
  },
);
const heat = mergedHighVsMedium.featureAvailability.find((e) => e.featureId === 'waermepumpe');
assert.equal(heat.status, S.STANDARD, 'high gewinnt vor medium');

setup();
console.log('equipmentImportMapper.test.js: ok');
