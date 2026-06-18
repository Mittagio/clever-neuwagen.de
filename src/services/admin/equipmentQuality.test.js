import assert from 'node:assert/strict';
import { FEATURE_AVAILABILITY_STATUS as S } from '../../data/features/modelEquipmentSchema.js';
import { clearImportedModelEquipmentProfiles } from '../configuration/equipmentImportRegistry.js';
import { ingestEquipmentImport } from '../configuration/equipmentImportMapper.js';
import { resetEquipmentImportLoaderState } from '../configuration/equipmentImportLoader.js';
import { resetFeatureAliasMappings, saveFeatureAliasMapping, ignoreUnknownFeature } from './featureAliasMappingService.js';
import { resetProfileQualityOverrides, saveProfileQualityOverride } from './equipmentProfileQualityStore.js';
import { reapplyFeatureAliasMappingsForModel } from './featureAliasProfileApplier.js';
import {
  calculateEquipmentProfileQuality,
  getOpenReviewItems,
  getQualityBadgeLabel,
  isFeatureSafeForCustomer,
} from './equipmentQualityService.js';
import { getInspectorUnknownFeatureGroups, loadInspectorModelContext } from './equipmentInspectorPresenter.js';
import { registerDefaultEquipmentImports } from '../configuration/equipmentImportLoader.js';

const CLEAN_PROFILE = {
  brand: 'Demo',
  model: 'Clean',
  modelKey: 'clean-model',
  modelYear: '2026',
  source: {
    type: 'pricelist',
    documentName: 'Clean Liste',
    validFrom: '2026-01-01',
    confidence: 'high',
  },
  trims: [{ id: 'base', label: 'Base' }],
  packages: [],
  featureAvailability: [
    {
      featureId: 'navigation',
      trimId: 'base',
      status: 'standard',
      confidence: 'high',
      sourceRef: {
        document: 'Clean Liste',
        page: 1,
        section: 'Serie',
        rawText: 'Navigation',
        url: null,
      },
    },
  ],
};

const LOW_CONFIDENCE_PROFILE = {
  ...CLEAN_PROFILE,
  modelKey: 'low-confidence-model',
  model: 'Low Confidence',
  featureAvailability: [
    {
      featureId: 'v2g',
      trimId: 'base',
      status: 'optional',
      confidence: 'low',
      sourceRef: {
        document: 'Clean Liste',
        page: 2,
        section: 'Elektro',
        rawText: 'V2G',
        url: null,
      },
    },
  ],
};

const UNKNOWN_STATUS_PROFILE = {
  ...CLEAN_PROFILE,
  modelKey: 'unknown-status-model',
  model: 'Unknown Status',
  featureAvailability: [
    {
      featureId: 'panoramadach',
      trimId: 'base',
      status: 'unknown',
      confidence: 'medium',
      sourceRef: {
        document: 'Clean Liste',
        page: 3,
        section: 'Dach',
        rawText: 'Panorama unklar',
        url: null,
      },
    },
  ],
};

function reset() {
  clearImportedModelEquipmentProfiles();
  resetEquipmentImportLoaderState();
  resetFeatureAliasMappings();
  resetProfileQualityOverrides();
}

reset();

// --- Profil mit unknownFeatures → needs_review ---
registerDefaultEquipmentImports();
const ev3Ctx = loadInspectorModelContext('ev3');
assert.ok(ev3Ctx.quality.openReviewCount > 0);
assert.ok(['needs_review', 'draft', 'partially_verified'].includes(ev3Ctx.quality.qualityStatus));
assert.equal(getQualityBadgeLabel(ev3Ctx.quality.qualityStatus).length > 0, true);

// --- Profil ohne offene Punkte → verified ---
reset();
ingestEquipmentImport(CLEAN_PROFILE, { register: true, dataOrigin: 'json_import' });
const cleanQuality = calculateEquipmentProfileQuality(
  CLEAN_PROFILE,
  { modelKey: 'clean-model', openUnknownFeatures: [], ignoredUnknownFeatures: [] },
);
assert.equal(cleanQuality.qualityStatus, 'verified');
assert.equal(cleanQuality.openReviewCount, 0);

// --- low confidence → needs_review ---
reset();
ingestEquipmentImport(LOW_CONFIDENCE_PROFILE, { register: true });
const lowItems = getOpenReviewItems(LOW_CONFIDENCE_PROFILE, { openUnknownFeatures: [] });
assert.ok(lowItems.some((item) => item.type === 'low_confidence'));
const lowQuality = calculateEquipmentProfileQuality(LOW_CONFIDENCE_PROFILE, {
  modelKey: 'low-confidence-model',
  openUnknownFeatures: [],
  ignoredUnknownFeatures: [],
  reviewItems: lowItems,
});
assert.equal(lowQuality.qualityStatus, 'needs_review');

// --- ignored unknownFeature zählt nicht als offen ---
reset();
ingestEquipmentImport({
  brand: 'Demo',
  model: 'Ignore Test',
  modelKey: 'ignore-test',
  modelYear: '2026',
  source: CLEAN_PROFILE.source,
  trims: CLEAN_PROFILE.trims,
  packages: [],
  featureAvailability: [
    {
      rawLabel: 'VTOL Steckdose',
      trimId: 'base',
      status: 'optional',
      confidence: 'low',
      sourceRef: { document: 'Test', page: 1, section: 'Laden', rawText: 'VTOL', url: null },
    },
  ],
}, { register: true });
ignoreUnknownFeature('VTOL Steckdose');
reapplyFeatureAliasMappingsForModel('ignore-test');
const ignoreGroups = getInspectorUnknownFeatureGroups('ignore-test');
assert.equal(ignoreGroups.openUnknownFeatures.length, 0);
assert.equal(ignoreGroups.ignoredUnknownFeatures.length, 1);

// --- mapped unknownFeature zählt nicht als offen ---
reset();
saveFeatureAliasMapping('VTOL Steckdose', 'v2l');
ingestEquipmentImport({
  brand: 'Demo',
  model: 'Mapped',
  modelKey: 'mapped-test',
  modelYear: '2026',
  source: CLEAN_PROFILE.source,
  trims: CLEAN_PROFILE.trims,
  packages: [],
  featureAvailability: [
    {
      rawLabel: 'VTOL Steckdose',
      trimId: 'base',
      status: 'optional',
      confidence: 'low',
      sourceRef: { document: 'Test', page: 1, section: 'Laden', rawText: 'VTOL', url: null },
    },
  ],
}, { register: true });
reapplyFeatureAliasMappingsForModel('mapped-test');
const mappedGroups = getInspectorUnknownFeatureGroups('mapped-test');
assert.equal(mappedGroups.openUnknownFeatures.length, 0);

// --- manual_verified hat hohe Priorität ---
const manualEntry = {
  featureId: 'v2l',
  trimId: 'base',
  status: S.OPTIONAL,
  confidence: 'manual_verified',
  source: { type: 'admin_override', confidence: 'manual_verified' },
};
const manualSafe = isFeatureSafeForCustomer(manualEntry, { qualityStatus: 'verified' }, [
  { featureId: 'v2g', type: 'low_confidence', severity: 'medium' },
]);
assert.equal(manualSafe, true);

// --- isFeatureSafeForCustomer: unknown / low confidence ---
const unknownEntry = { featureId: 'v2g', trimId: 'base', status: S.UNKNOWN, confidence: 'medium' };
assert.equal(isFeatureSafeForCustomer(unknownEntry, { qualityStatus: 'needs_review' }, []), false);

const lowEntry = { featureId: 'v2g', trimId: 'base', status: S.OPTIONAL, confidence: 'low' };
assert.equal(isFeatureSafeForCustomer(lowEntry, { qualityStatus: 'needs_review' }, []), false);

const blockedEntry = { featureId: 'v2g', trimId: 'base', status: S.OPTIONAL, confidence: 'high' };
assert.equal(
  isFeatureSafeForCustomer(blockedEntry, { qualityStatus: 'needs_review' }, [
    { featureId: 'v2g', trimId: 'base', severity: 'medium' },
  ]),
  false,
);

// --- verified override ---
reset();
ingestEquipmentImport(UNKNOWN_STATUS_PROFILE, { register: true });
saveProfileQualityOverride({
  modelKey: 'unknown-status-model',
  modelYear: '2026',
  status: 'verified',
  verifiedBy: 'local-admin',
});
const unknownReviewItems = getOpenReviewItems(UNKNOWN_STATUS_PROFILE, { openUnknownFeatures: [] });
const overrideQuality = calculateEquipmentProfileQuality(UNKNOWN_STATUS_PROFILE, {
  modelKey: 'unknown-status-model',
  openUnknownFeatures: [],
  ignoredUnknownFeatures: [],
  reviewItems: unknownReviewItems,
});
assert.equal(overrideQuality.qualityStatus, 'verified');
assert.equal(overrideQuality.overrideNote, 'Manuell als geprüft markiert');
assert.ok(overrideQuality.openReviewCount > 0, 'Offene Punkte bleiben sichtbar');

console.log('equipmentQuality.test.js: ok');
