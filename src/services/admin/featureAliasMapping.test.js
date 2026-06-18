import assert from 'node:assert/strict';
import { FEATURE_AVAILABILITY_STATUS as S } from '../../data/features/modelEquipmentSchema.js';
import { FEATURE_ALIAS_STORAGE_KEY } from '../../data/features/featureAliasOverrides.js';
import { clearImportedModelEquipmentProfiles } from '../configuration/equipmentImportRegistry.js';
import { ingestEquipmentImport } from '../configuration/equipmentImportMapper.js';
import { resolveGlobalFeatureFromQuery } from '../configuration/globalFeatureResolver.js';
import { resolveModelFeatureAvailability } from '../configuration/modelEquipmentData.js';
import { resetEquipmentImportLoaderState } from '../configuration/equipmentImportLoader.js';
import {
  assignUnknownFeatureMapping,
  getInspectorUnknownFeatureGroups,
  ignoreInspectorUnknownFeature,
  loadInspectorModelContext,
  searchGlobalFeaturesForMapping,
} from './equipmentInspectorPresenter.js';
import { reapplyFeatureAliasMappingsForModel } from './featureAliasProfileApplier.js';
import {
  findMappingForRawLabel,
  getFeatureAliasMappings,
  ignoreUnknownFeature,
  isUnknownFeatureIgnored,
  resetFeatureAliasMappings,
  saveFeatureAliasMapping,
} from './featureAliasMappingService.js';
import {
  readFeatureAliasStore,
  resetFeatureAliasStore,
  writeFeatureAliasStore,
} from './featureAliasMappingStore.js';

const VTOL_IMPORT = {
  brand: 'Demo',
  model: 'VTOL Test',
  modelKey: 'vtol-test',
  modelYear: '2026',
  source: {
    type: 'pricelist',
    documentName: 'VTOL Testliste',
    validFrom: '2026-01-01',
    confidence: 'low',
  },
  trims: [{ id: 'base', label: 'Base' }],
  packages: [],
  featureAvailability: [
    {
      rawLabel: 'VTOL Steckdose',
      trimId: 'base',
      status: 'optional',
      confidence: 'low',
      sourceRef: {
        document: 'VTOL Testliste',
        page: 1,
        section: 'Laden',
        rawText: 'VTOL Steckdose',
        url: null,
      },
    },
  ],
};

function reset() {
  clearImportedModelEquipmentProfiles();
  resetEquipmentImportLoaderState();
  resetFeatureAliasMappings();
}

reset();

// --- Mapping speichern und lesen ---
const saved = saveFeatureAliasMapping('VTOL Steckdose', 'v2l');
assert.ok(saved, 'Mapping soll gespeichert werden');
assert.equal(saved.mappedFeatureId, 'v2l');
assert.equal(saved.confidence, 'manual_verified');
assert.equal(saved.source, 'admin_override');

const found = findMappingForRawLabel('VTOL Steckdose');
assert.ok(found);
assert.equal(found.mappedFeatureId, 'v2l');

// --- Persistenz (Store / localStorage-Struktur) ---
const store = readFeatureAliasStore();
assert.equal(store.mappings.length, 1);
assert.equal(store.mappings[0].rawLabel, 'VTOL Steckdose');
assert.equal(getFeatureAliasMappings().length, 1);

writeFeatureAliasStore({
  mappings: [{
    rawLabel: 'Bidirektionale Steckdose',
    mappedFeatureId: 'v2l',
    source: 'admin_override',
    createdAt: '2026-01-01T00:00:00.000Z',
    confidence: 'manual_verified',
  }],
  ignoredRawLabels: [],
});
assert.equal(readFeatureAliasStore().mappings[0].rawLabel, 'Bidirektionale Steckdose');

reset();
saveFeatureAliasMapping('VTOL Steckdose', 'v2l');

// --- manual_verified hat höchste Priorität in Resolver ---
const vtolMatch = resolveGlobalFeatureFromQuery('VTOL');
assert.equal(vtolMatch.type, 'match');
assert.equal(vtolMatch.feature.id, 'v2l');
assert.equal(vtolMatch.resolutionSource, 'admin_override');

const bidirectionalMatch = resolveGlobalFeatureFromQuery('bidirektional');
assert.equal(bidirectionalMatch.type, 'match');
assert.equal(bidirectionalMatch.feature.id, 'v2l');

const steckdoseMatch = resolveGlobalFeatureFromQuery('Steckdose am Auto');
assert.equal(steckdoseMatch.type, 'match');
assert.equal(steckdoseMatch.feature.id, 'v2l');

// --- Import + Reapply: unknown wird zu Feature ---
reset();
saveFeatureAliasMapping('VTOL Steckdose', 'v2l');
ingestEquipmentImport(VTOL_IMPORT, { register: true, dataOrigin: 'json_import' });
reapplyFeatureAliasMappingsForModel('vtol-test');

const vtolCtx = loadInspectorModelContext('vtol-test');
assert.equal(vtolCtx.unknownFeatures.length, 0, 'Zugeordnetes Unknown nicht mehr offen');
assert.ok(
  vtolCtx.featureRows.some((row) => row.featureId === 'v2l'),
  'V2L in Feature-Verfügbarkeit nach Mapping',
);
assert.equal(vtolCtx.featureRows.find((row) => row.featureId === 'v2l')?.confidence, 'manual_verified');

const customerV2l = resolveModelFeatureAvailability('Demo', 'VTOL Test', 'vtol-test', 'v2l');
assert.ok(customerV2l);
assert.equal(customerV2l.modelStatus, S.OPTIONAL);

// --- Inspector: Zuordnung über Presenter ---
reset();
ingestEquipmentImport({
  ...VTOL_IMPORT,
  featureAvailability: [
    {
      rawLabel: 'Akustikverglasung Test',
      trimId: 'base',
      status: 'optional',
      confidence: 'low',
      sourceRef: { document: 'Test', page: 1, section: 'Glas', rawText: 'Akustik', url: null },
    },
  ],
}, { register: true });

const beforeAssign = getInspectorUnknownFeatureGroups('vtol-test');
assert.equal(beforeAssign.openUnknownFeatures.length, 1);

const assignResult = assignUnknownFeatureMapping('vtol-test', 'Akustikverglasung Test', 'v2l');
assert.ok(assignResult?.message.includes('V2L'));
const afterAssign = getInspectorUnknownFeatureGroups('vtol-test');
assert.equal(afterAssign.openUnknownFeatures.length, 0);

// --- Ignorierte Unknowns ---
reset();
ingestEquipmentImport(VTOL_IMPORT, { register: true });
ignoreUnknownFeature('VTOL Steckdose');
reapplyFeatureAliasMappingsForModel('vtol-test');

assert.ok(isUnknownFeatureIgnored('VTOL Steckdose'));
const ignoredGroups = getInspectorUnknownFeatureGroups('vtol-test');
assert.equal(ignoredGroups.openUnknownFeatures.length, 0);
assert.equal(ignoredGroups.ignoredUnknownFeatures.length, 1);
assert.equal(ignoredGroups.ignoredUnknownFeatures[0].rawLabel, 'VTOL Steckdose');

reset();
ingestEquipmentImport(VTOL_IMPORT, { register: true });
ignoreInspectorUnknownFeature('vtol-test', 'VTOL Steckdose');
const ignoredCtx = loadInspectorModelContext('vtol-test');
assert.equal(ignoredCtx.unknownFeatures.length, 0);
assert.equal(ignoredCtx.ignoredUnknownFeatures.length, 1);

// --- Dropdown-Suche ---
const v2lHits = searchGlobalFeaturesForMapping('v2l');
assert.ok(v2lHits.some((feature) => feature.id === 'v2l'));
assert.ok(v2lHits[0].label.includes('V2L'));

const labelHits = searchGlobalFeaturesForMapping('Vehicle-to-Load');
assert.ok(labelHits.some((feature) => feature.id === 'v2l'));

const synonymHits = searchGlobalFeaturesForMapping('bidirektional');
assert.ok(synonymHits.some((feature) => feature.id === 'v2l'));

assert.equal(FEATURE_ALIAS_STORAGE_KEY, 'clever_equipment_feature_alias_mappings');

resetFeatureAliasStore();

console.log('featureAliasMapping.test.js: ok');
