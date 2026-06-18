import assert from 'node:assert/strict';
import { FEATURE_AVAILABILITY_STATUS as S } from '../../data/features/modelEquipmentSchema.js';
import { KIA_EV3_PRICELIST_IMPORT } from '../../data/imports/sampleEquipmentImports.js';
import { clearImportedModelEquipmentProfiles } from '../configuration/equipmentImportRegistry.js';
import { ingestEquipmentImport } from '../configuration/equipmentImportMapper.js';
import { resetEquipmentImportLoaderState } from '../configuration/equipmentImportLoader.js';
import { getSearchedFeatureStatusCopy } from '../configuration/equipmentFeatureSearch.js';
import {
  customerCopyExposesInternalFields,
  inspectFeatureSearch,
  loadInspectorModelContext,
} from './equipmentInspectorPresenter.js';
import {
  buildFeatureSourceCopyText,
  buildFeatureSourceDetailFromRow,
  buildFeatureSourceDetailFromSearch,
  buildSourceBlockFromEntry,
  canShowSourceForRow,
  sortSourceBlocks,
} from './equipmentInspectorSourcePresenter.js';

function reset() {
  clearImportedModelEquipmentProfiles();
  resetEquipmentImportLoaderState();
}

reset();
ingestEquipmentImport(KIA_EV3_PRICELIST_IMPORT, { register: true, dataOrigin: 'json_import' });

const ctx = loadInspectorModelContext('ev3');
const hudRow = ctx.featureRows.find(
  (row) => row.featureId === 'head_up_display' && row.trimId === 'earth',
);
assert.ok(hudRow, 'HUD-Zeile vorhanden');

// --- Feature mit sourceRef zeigt Quelle anzeigen ---
assert.equal(canShowSourceForRow(hudRow, ctx), true);
const hudDetail = buildFeatureSourceDetailFromRow({ row: hudRow, context: ctx });
assert.equal(hudDetail.hasSource, true);
assert.equal(hudDetail.featureLabel, 'Head-up-Display');
assert.equal(hudDetail.sources[0].document, 'Kia EV3 Preisliste MJ26');
assert.equal(hudDetail.sources[0].section, 'Sonderausstattung');
assert.equal(hudDetail.sources[0].page, 8);
assert.ok(hudDetail.sources[0].rawText?.includes('Head-Up Display'));
assert.equal(hudDetail.packageName, 'Premium Paket');
assert.equal(hudDetail.status, S.PACKAGE_REQUIRED);

// --- Feature ohne sourceRef zeigt Keine Quelle hinterlegt ---
const noSourceRow = {
  featureId: 'matrix_led',
  featureLabel: 'Matrix-LED',
  trimId: 'air',
  trimName: 'Air',
  status: S.OPTIONAL,
  packageName: null,
  confidence: 'medium',
  sourceDocument: null,
  sourceSection: null,
  sourcePage: null,
  rawText: null,
  sourceUrl: null,
};
assert.equal(canShowSourceForRow(noSourceRow, ctx), false);
const noSourceDetail = buildFeatureSourceDetailFromRow({ row: noSourceRow, context: ctx });
assert.equal(noSourceDetail.hasSource, false);

// --- rawText im Inspector, nicht in Kundenvorschau ---
const search = inspectFeatureSearch('Head Up', 'Kia', 'EV3', 'ev3');
assert.equal(search.type, 'match');
assert.equal(search.hasInspectableSource, true);
const searchDetail = buildFeatureSourceDetailFromSearch(search, ctx);
assert.ok(searchDetail.sources.some((source) => source.rawText?.includes('Head-Up Display')));
assert.equal(customerCopyExposesInternalFields(search.customerCopy), false);
assert.ok(!search.customerCopy?.statusLine?.toLowerCase().includes('rawtext'));
assert.ok(!search.customerCopy?.hint?.toLowerCase().includes('sonderausstattung'));

const customerCopy = getSearchedFeatureStatusCopy({
  label: 'Head-up-Display',
  modelStatus: 'package',
  availablePackages: [{ name: 'Premium Paket' }],
  availableTrims: [{ trimName: 'Earth' }],
});
assert.equal(customerCopyExposesInternalFields(customerCopy), false);

// --- mehrere Quellen nach Priorität sortiert ---
const sorted = sortSourceBlocks([
  buildSourceBlockFromEntry({
    featureId: 'v2l',
    trimId: 'base',
    status: S.OPTIONAL,
    confidence: 'low',
    sourceRef: { document: 'Low Doc', section: 'A', page: 1, rawText: 'low' },
    source: { type: 'pricelist', validFrom: '2025-01-01', confidence: 'low' },
  }),
  buildSourceBlockFromEntry({
    featureId: 'v2l',
    trimId: 'base',
    status: S.OPTIONAL,
    confidence: 'manual_verified',
    sourceRef: { document: 'Manual Doc', section: 'B', page: 2, rawText: 'manual' },
    source: { type: 'admin_override', validFrom: '2026-01-01', confidence: 'manual_verified' },
  }),
  buildSourceBlockFromEntry({
    featureId: 'v2l',
    trimId: 'base',
    status: S.OPTIONAL,
    confidence: 'high',
    sourceRef: { document: 'High Doc', section: 'C', page: 3, rawText: 'high' },
    source: { type: 'pricelist', validFrom: '2026-06-01', confidence: 'high' },
  }),
]);
assert.equal(sorted[0].document, 'Manual Doc');
assert.equal(sorted[1].document, 'High Doc');
assert.equal(sorted[2].document, 'Low Doc');

// --- package_required zeigt Paket + Quelle ---
assert.ok(hudDetail.statusDescription.includes('Premium Paket'));
assert.equal(hudDetail.sources[0].document, 'Kia EV3 Preisliste MJ26');

// --- Kopiertext ---
const copyText = buildFeatureSourceCopyText(hudDetail);
assert.ok(copyText.includes('Kia'));
assert.ok(copyText.includes('EV3'));
assert.ok(copyText.includes('Head-up-Display'));
assert.ok(copyText.includes('Premium Paket'));
assert.ok(copyText.includes('Kia EV3 Preisliste MJ26'));
assert.ok(copyText.includes('Sonderausstattung'));
assert.ok(copyText.includes('Seite 8'));
assert.ok(copyText.toLowerCase().includes('confidence: high'));

console.log('equipmentInspectorSource.test.js: ok');
