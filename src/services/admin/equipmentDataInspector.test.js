import assert from 'node:assert/strict';
import { FEATURE_AVAILABILITY_STATUS as S } from '../../data/features/modelEquipmentSchema.js';
import { clearImportedModelEquipmentProfiles } from '../configuration/equipmentImportRegistry.js';
import { resetEquipmentImportLoaderState, registerDefaultEquipmentImports } from '../configuration/equipmentImportLoader.js';
import { getSearchedFeatureStatusCopy } from '../configuration/equipmentFeatureSearch.js';
import {
  buildAvailabilityRows,
  customerCopyExposesInternalFields,
  ensureSampleEquipmentImportsLoaded,
  inspectFeatureSearch,
  loadInspectorModelContext,
} from './equipmentInspectorPresenter.js';

function reset() {
  clearImportedModelEquipmentProfiles();
  resetEquipmentImportLoaderState();
}

reset();
registerDefaultEquipmentImports();

const ctx = loadInspectorModelContext('ev3');
assert.equal(ctx.brand, 'Kia');
assert.equal(ctx.model, 'EV3');
assert.equal(ctx.source?.documentName, 'Kia EV3 Preisliste MJ26');
assert.equal(ctx.profileOrigin.key, 'json_import');
assert.ok(ctx.trims.some((t) => t.id === 'earth'));
assert.ok(ctx.packages.some((p) => p.name === 'Premium Paket'));

const rows = buildAvailabilityRows(ctx.profile);
const hudRow = rows.find((r) => r.featureId === 'head_up_display' && r.trimId === 'earth');
assert.ok(hudRow, 'HUD-Zeile vorhanden');
assert.equal(hudRow.featureLabel, 'Head-up-Display');
assert.equal(hudRow.status, S.PACKAGE_REQUIRED);
assert.equal(hudRow.packageName, 'Premium Paket');
assert.equal(hudRow.sourceDocument, 'Kia EV3 Preisliste MJ26');
assert.ok(hudRow.rawText?.includes('Head-Up Display'));

assert.ok(ctx.unknownFeatures.length >= 1);
assert.ok(ctx.unknownFeatures.some((u) => u.rawLabel === 'Akustikverglasung vorne'));
assert.equal(
  rows.some((r) => r.featureLabel.toLowerCase().includes('akustik')),
  false,
  'Unbekannte Features nicht in Availability-Tabelle',
);

const search = inspectFeatureSearch('Head Up', 'Kia', 'EV3', 'ev3');
assert.equal(search.type, 'match');
assert.equal(search.feature.id, 'head_up_display');
assert.equal(search.availability.modelStatus, S.PACKAGE_REQUIRED);
assert.ok(search.debugSourceRefs.length > 0);
assert.ok(search.internalEntries.some((e) => e.sourceRef?.rawText));
assert.ok(search.customerCopy?.statusLine?.includes('Premium Paket'));

const customerCopy = getSearchedFeatureStatusCopy({
  label: 'Head-up-Display',
  modelStatus: 'package',
  availablePackages: [{ name: 'Premium Paket' }],
  availableTrims: [{ trimName: 'Earth' }],
});
assert.equal(customerCopyExposesInternalFields(customerCopy), false);
assert.ok(!customerCopy.hint?.toLowerCase().includes('rawtext'));

const unknownStatus = rows.find((r) => r.featureId === 'panoramadach');
assert.equal(unknownStatus, undefined);

reset();
ensureSampleEquipmentImportsLoaded();
const ev2 = loadInspectorModelContext('ev2');
assert.ok(ev2.featureRows.some((r) => r.featureId === 'waermepumpe'));

console.log('equipmentDataInspector.test.js: ok');
