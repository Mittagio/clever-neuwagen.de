import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { FEATURE_AVAILABILITY_STATUS as S } from '../../data/features/modelEquipmentSchema.js';
import {
  buildEquipmentImportFileEntries,
  discoverEquipmentImportFilesFromFilesystem,
  extractFileNameFromPath,
} from './equipmentImportFileDiscovery.js';
import {
  buildEquipmentImportDedupeKey,
  EQUIPMENT_IMPORT_FILE_ENTRIES,
  loadEquipmentImportByModelKey,
  loadEquipmentImportFiles,
  registerDefaultEquipmentImports,
  registerEquipmentImportsFromFiles,
  resetEquipmentImportLoaderState,
  tryRegisterEquipmentImportRecord,
} from './equipmentImportLoader.js';
import {
  clearImportedModelEquipmentProfiles,
  getImportedModelEquipmentProfile,
  getImportedUnknownFeatures,
  hasImportedModelEquipmentProfile,
  listImportedModelKeys,
} from './equipmentImportRegistry.js';
import {
  ensureSampleEquipmentImportsLoaded,
  loadInspectorModelContext,
} from '../admin/equipmentInspectorPresenter.js';

const equipmentDirUrl = new URL('../../data/imports/equipment/', import.meta.url);
const equipmentDir = fileURLToPath(equipmentDirUrl);

function reset() {
  clearImportedModelEquipmentProfiles();
  resetEquipmentImportLoaderState();
}

reset();

// --- fileName wird korrekt aus dem Pfad abgeleitet ---
assert.equal(
  extractFileNameFromPath('../../data/imports/equipment/kia-ev3-2026.equipment.json'),
  'kia-ev3-2026.equipment.json',
);
assert.equal(
  extractFileNameFromPath('C:\\project\\src\\data\\imports\\equipment\\kia-ev2-2026.equipment.json'),
  'kia-ev2-2026.equipment.json',
);

const mockModules = {
  '../../data/imports/equipment/kia-ev3-2026.equipment.json': { modelKey: 'kia-ev3' },
  '../../data/imports/equipment/demo-model-x-2026.equipment.json': { default: { modelKey: 'demo-model-x' } },
};
const builtEntries = buildEquipmentImportFileEntries(mockModules);
assert.equal(builtEntries.length, 2);
assert.equal(builtEntries[0].fileName, 'demo-model-x-2026.equipment.json');
assert.equal(builtEntries[1].fileName, 'kia-ev3-2026.equipment.json');
assert.equal(builtEntries[1].importData.modelKey, 'kia-ev3');

// --- mehrere JSON-Dateien werden automatisch gefunden (ohne manuelle Liste) ---
const fsDiscovered = discoverEquipmentImportFilesFromFilesystem(equipmentDirUrl);
const jsonFilesOnDisk = readdirSync(equipmentDir).filter((name) => name.endsWith('.equipment.json'));
assert.equal(fsDiscovered.length, jsonFilesOnDisk.length);
assert.ok(fsDiscovered.length >= 3, 'Mindestens drei *.equipment.json Dateien erwartet');
assert.ok(
  fsDiscovered.every((entry) => entry.fileName.endsWith('.equipment.json')),
  'Nur *.equipment.json Dateien',
);

assert.equal(EQUIPMENT_IMPORT_FILE_ENTRIES.length, jsonFilesOnDisk.length);
assert.ok(
  EQUIPMENT_IMPORT_FILE_ENTRIES.some((entry) => entry.fileName === 'kia-ev3-2026.equipment.json'),
  'kia-ev3 wird automatisch gefunden – keine manuelle Eintragung nötig',
);
assert.ok(
  EQUIPMENT_IMPORT_FILE_ENTRIES.every((entry) => entry.filePath && entry.fileName && entry.importData),
  'Jeder Eintrag hat filePath, fileName und importData',
);

// --- JSON-Import wird geladen ---
const files = loadEquipmentImportFiles();
assert.equal(files.length, jsonFilesOnDisk.length);
assert.ok(files.every((f) => f.validation.valid), 'Alle JSON-Dateien müssen valide sein');

const ev3File = files.find((f) => f.modelKey === 'ev3');
assert.ok(ev3File, 'kia-ev3 JSON vorhanden');
assert.equal(ev3File.fileName, 'kia-ev3-2026.equipment.json');
assert.equal(ev3File.brand, 'Kia');
assert.equal(ev3File.model, 'EV3');
assert.equal(ev3File.documentName, 'Kia EV3 Preisliste MJ26');

// --- loadEquipmentImportByModelKey ---
const ev3ByAlias = loadEquipmentImportByModelKey('kia-ev3');
assert.ok(ev3ByAlias, 'loadEquipmentImportByModelKey("kia-ev3") liefert Import');
assert.equal(ev3ByAlias.model, 'EV3');
assert.equal(loadEquipmentImportByModelKey('ev3')?.modelKey, 'kia-ev3');

// --- Import wird validiert und registriert ---
const registerResults = registerEquipmentImportsFromFiles();
assert.equal(registerResults.filter((r) => r.registered).length, jsonFilesOnDisk.length);
assert.ok(hasImportedModelEquipmentProfile('ev3'));
assert.ok(hasImportedModelEquipmentProfile('ev2'));
assert.ok(hasImportedModelEquipmentProfile('demo-model-x'));

const ev3Profile = getImportedModelEquipmentProfile('ev3');
assert.equal(ev3Profile.dataOrigin, 'json_import');
assert.equal(ev3Profile.importFile, 'kia-ev3-2026.equipment.json');

const ev3Summary = registerResults.find((r) => r.fileName === 'kia-ev3-2026.equipment.json');
assert.ok(ev3Summary);
assert.equal(ev3Summary.status, 'registered');
assert.deepEqual(ev3Summary.errors, []);
assert.ok(Array.isArray(ev3Summary.warnings));

// --- Doppelte Registrierung wird verhindert ---
const secondPass = registerEquipmentImportsFromFiles();
assert.equal(
  secondPass.filter((r) => r.skipped && r.reason === 'duplicate').length,
  jsonFilesOnDisk.length,
);
assert.equal(listImportedModelKeys().length, jsonFilesOnDisk.length);

const dedupeKey = buildEquipmentImportDedupeKey(ev3ByAlias);
assert.ok(registerResults.some((r) => r.dedupeKey === dedupeKey));

// --- registerDefaultEquipmentImports idempotent ---
reset();
registerDefaultEquipmentImports();
assert.ok(hasImportedModelEquipmentProfile('ev3'));
const keysAfterFirst = listImportedModelKeys().length;
registerDefaultEquipmentImports();
assert.equal(listImportedModelKeys().length, keysAfterFirst);

// --- Ungültige Datei wird übersprungen ---
reset();
const invalidImport = {
  brand: 'Invalid',
  model: 'Broken',
  modelKey: 'broken-model',
  modelYear: '2099',
  source: { type: 'pricelist', documentName: 'Broken Doc' },
  trims: [],
  featureAvailability: [
    { featureId: 'navigation', trimId: 'air', status: 'standard' },
  ],
};
const invalidResult = tryRegisterEquipmentImportRecord(invalidImport, {
  fileName: 'broken.equipment.json',
  filePath: path.join(equipmentDir, 'broken.equipment.json'),
});
assert.equal(invalidResult.registered, false);
assert.equal(invalidResult.reason, 'validation_failed');
assert.equal(invalidResult.status, 'failed');
assert.ok(invalidResult.errors.length > 0);
assert.equal(hasImportedModelEquipmentProfile('broken-model'), false);

// --- unknownFeatures bleiben im Inspector sichtbar ---
reset();
registerDefaultEquipmentImports();
const ev3Ctx = loadInspectorModelContext('ev3');
assert.ok(ev3Ctx.unknownFeatures.some((u) => u.rawLabel === 'Akustikverglasung vorne'));
assert.equal(ev3Ctx.profileOrigin.key, 'json_import');
assert.equal(ev3Ctx.profileOrigin.sourceType, 'pricelist');
assert.equal(ev3Ctx.profileOrigin.importFile, 'kia-ev3-2026.equipment.json');

const demoCtx = loadInspectorModelContext('demo-model-x');
assert.equal(getImportedUnknownFeatures('demo-model-x').length, 1);
assert.ok(demoCtx.unknownFeatures.some((u) => u.rawLabel === 'Akustikverglasung vorne'));

// --- Inspector-Ladehilfe nutzt JSON-Loader ---
reset();
ensureSampleEquipmentImportsLoaded();
const ev2Ctx = loadInspectorModelContext('ev2');
assert.ok(ev2Ctx.featureRows.some((r) => r.featureId === 'waermepumpe'));
assert.equal(ev2Ctx.profileOrigin.key, 'json_import');

const ledAvailability = ev2Ctx.featureRows.find((r) => r.featureId === 'led_scheinwerfer');
assert.ok(ledAvailability);
assert.equal(ledAvailability.status, S.AVAILABLE);

console.log('equipmentImportLoader.test.js: ok');
