import assert from 'node:assert/strict';
import { FEATURE_AVAILABILITY_STATUS as S } from '../../data/features/modelEquipmentSchema.js';
import { KIA_EV3_PRICELIST_IMPORT } from '../../data/imports/sampleEquipmentImports.js';
import { clearImportedModelEquipmentProfiles } from '../configuration/equipmentImportRegistry.js';
import { ingestEquipmentImport } from '../configuration/equipmentImportMapper.js';
import { resetEquipmentImportLoaderState } from '../configuration/equipmentImportLoader.js';
import {
  buildSalesCustomerText,
  salesCustomerTextIsClean,
  searchSalesEquipment,
} from './equipmentSalesSearchService.js';

function reset() {
  clearImportedModelEquipmentProfiles();
  resetEquipmentImportLoaderState();
}

reset();
ingestEquipmentImport(KIA_EV3_PRICELIST_IMPORT, { register: true, dataOrigin: 'json_import' });

// --- EV3 Head-up erkennt Modell + Feature ---
const hudSearch = searchSalesEquipment('EV3 Head-up');
assert.equal(hudSearch.type, 'match');
assert.equal(hudSearch.modelEntry.modelKey, 'ev3');
assert.equal(hudSearch.feature.id, 'head_up_display');
assert.equal(hudSearch.feature.label, 'Head-up-Display');
assert.ok(hudSearch.trimLines.length > 0);
assert.ok(hudSearch.trimLines.some((line) => line.includes('Premium Paket')));

// --- EV3 V2L erkennt Modell + Feature ---
const v2lSearch = searchSalesEquipment('EV3 V2L');
assert.ok(v2lSearch.type === 'match' || v2lSearch.type === 'pending');
assert.equal(v2lSearch.modelEntry.modelKey, 'ev3');
assert.equal(v2lSearch.feature.id, 'v2l');

// --- Head-up ohne Modell fordert Modellauswahl ---
const noModel = searchSalesEquipment('Head-up');
assert.equal(noModel.type, 'needs_model');
assert.equal(noModel.message, 'Bitte Modell auswählen');
assert.equal(noModel.feature?.id, 'head_up_display');

// --- mehrdeutiges Modell zeigt Vorschläge ---
const ambiguous = searchSalesEquipment('Kia EV Head-up');
assert.equal(ambiguous.type, 'ambiguous_model');
assert.equal(ambiguous.message, 'Meinten Sie?');
assert.ok(ambiguous.modelSuggestions.length >= 2);
const modelKeys = ambiguous.modelSuggestions.map((entry) => entry.modelKey);
assert.ok(modelKeys.includes('ev3'));
assert.ok(modelKeys.includes('ev6'));

// --- package_required erzeugt Kundentext „über [Paket] erhältlich“ ---
const customerText = buildSalesCustomerText({
  featureLabel: 'Head-up-Display',
  brand: 'Kia',
  model: 'EV3',
  availability: {
    modelStatus: S.PACKAGE_REQUIRED,
    availablePackages: [{ name: 'Premium Paket' }],
    availableTrims: [],
    entries: [],
  },
});
assert.ok(customerText.includes('über das Premium Paket erhältlich'));

// --- Quelle anzeigen ist vorhanden, wenn sourceRef existiert ---
assert.equal(hudSearch.hasSource, true);
assert.ok(hudSearch.sourceDetail?.hasSource);
assert.ok(hudSearch.sourceDetail?.sources?.some((source) => source.document));

// --- Kundentext enthält keine rawText/Seite/Confidence ---
assert.equal(salesCustomerTextIsClean(hudSearch.customerText), true);
assert.ok(!hudSearch.customerText.toLowerCase().includes('rawtext'));
assert.ok(!hudSearch.customerText.toLowerCase().includes('seite'));
assert.ok(!hudSearch.customerText.toLowerCase().includes('confidence'));

console.log('equipmentSalesSearch.test.js: alle Tests bestanden');
