import assert from 'node:assert/strict';
import { FEATURE_AVAILABILITY_STATUS as S } from '../../data/features/modelEquipmentSchema.js';
import { KIA_EV3_PRICELIST_IMPORT } from '../../data/imports/sampleEquipmentImports.js';
import { toCustomerSafeEquipmentWish } from '../../data/equipment/equipmentWishTypes.js';
import { clearImportedModelEquipmentProfiles } from '../configuration/equipmentImportRegistry.js';
import { ingestEquipmentImport } from '../configuration/equipmentImportMapper.js';
import { resetEquipmentImportLoaderState } from '../configuration/equipmentImportLoader.js';
import { normalizeLead } from '../../logic/leadNormalization.js';
import { searchSalesEquipment } from '../admin/equipmentSalesSearchService.js';
import {
  buildEquipmentWishFromSalesResult,
  buildNewSalesChanceStarterPayload,
  buildSourceDetailFromEquipmentWish,
  evaluateEquipmentWishDuplicate,
  equipmentWishCustomerTextIsClean,
  equipmentWishKeepsInternalSource,
  transferEquipmentWishToLead,
} from './equipmentOfferTransferService.js';

function reset() {
  clearImportedModelEquipmentProfiles();
  resetEquipmentImportLoaderState();
}

reset();
ingestEquipmentImport(KIA_EV3_PRICELIST_IMPORT, { register: true, dataOrigin: 'json_import' });

const hudSearch = searchSalesEquipment('EV3 Head-up');
assert.equal(hudSearch.type, 'match');

// --- Ausstattung aus Verkäufer-Suche erzeugt korrektes Offer-Payload ---
const wish = buildEquipmentWishFromSalesResult(hudSearch);
assert.equal(wish.type, 'equipment_feature');
assert.equal(wish.featureId, 'head_up_display');
assert.equal(wish.featureLabel, 'Head-up-Display');
assert.equal(wish.modelKey, 'ev3');
assert.equal(wish.modelLabel, 'Kia EV3');
assert.equal(wish.createdFrom, 'equipment_sales_search');
assert.ok(wish.id.startsWith('eqw-'));
assert.ok(wish.createdAt);

// --- package_required übernimmt packageId und packageLabel ---
assert.equal(wish.status, S.PACKAGE_REQUIRED);
assert.ok(wish.packageLabel?.includes('Premium Paket'));
assert.ok(wish.packageId || wish.packageLabel);

// --- sourceRef bleibt intern erhalten ---
assert.ok(equipmentWishKeepsInternalSource(wish));
assert.ok(wish.internalSourceRef?.document || wish.internalSourceRef?.rawText);

const customerSafe = toCustomerSafeEquipmentWish(wish);
assert.equal(customerSafe.internalSourceRef, undefined);
assert.equal(customerSafe.confidence, undefined);

// --- Kundentext enthält keine rawText, Seite oder Confidence ---
assert.equal(equipmentWishCustomerTextIsClean(wish), true);
assert.ok(wish.customerText.includes('Premium Paket'));
assert.ok(!wish.customerText.toLowerCase().includes('rawtext'));
assert.ok(!wish.customerText.toLowerCase().includes('seite'));
assert.ok(!wish.customerText.toLowerCase().includes('confidence'));

// --- Duplikat wird verhindert ---
const lead = normalizeLead({
  id: 'lead-test-eq',
  contact: { name: 'Test Kunde' },
  equipmentWishes: [wish],
});

const duplicateResult = transferEquipmentWishToLead(lead, hudSearch);
assert.equal(duplicateResult.ok, false);
assert.equal(duplicateResult.code, 'duplicate');
assert.equal(evaluateEquipmentWishDuplicate(lead.equipmentWishes, wish), 'exact');

// --- gleicher Wunsch mit anderer Variante kann aktualisiert werden ---
const variantWish = {
  ...wish,
  id: 'eqw-variant',
  trimId: 'gt-line',
  trimLabel: 'GT-Line',
  packageId: null,
  packageLabel: null,
  status: S.AVAILABLE,
  statusLabel: 'verfügbar ab GT-Line',
};
const leadWithVariant = normalizeLead({
  id: 'lead-test-variant',
  contact: { name: 'Variant Kunde' },
  equipmentWishes: [variantWish],
});

const conflict = transferEquipmentWishToLead(leadWithVariant, hudSearch);
assert.equal(conflict.ok, false);
assert.equal(conflict.code, 'variant_conflict');

const updated = transferEquipmentWishToLead(leadWithVariant, hudSearch, { forceUpdate: true });
assert.equal(updated.ok, true);
assert.equal(updated.code, 'updated');
assert.equal(updated.equipmentWishes.length, 1);
assert.equal(updated.equipmentWishes[0].packageLabel, wish.packageLabel);

// --- Kundenakte zeigt Ausstattungswunsch (Lead-Struktur) ---
const added = transferEquipmentWishToLead(
  normalizeLead({ id: 'lead-empty', contact: { name: 'Neu' }, equipmentWishes: [] }),
  hudSearch,
);
assert.equal(added.ok, true);
assert.equal(added.equipmentWishes.length, 1);
assert.equal(added.equipmentWishes[0].featureLabel, 'Head-up-Display');

// --- Quelle-Button nutzt EquipmentFeatureSourceModal (Detail aus Wunsch) ---
const sourceDetail = buildSourceDetailFromEquipmentWish(added.equipmentWishes[0]);
assert.equal(sourceDetail.featureLabel, 'Head-up-Display');
assert.equal(sourceDetail.hasSource, true);
assert.ok(sourceDetail.sources.some((source) => source.rawText?.includes('Head-Up Display')));

// --- Neue Verkaufschance Starter-Payload ---
const starter = buildNewSalesChanceStarterPayload(hudSearch);
assert.equal(starter.source, 'equipment_sales_search');
assert.equal(starter.equipmentWishes.length, 1);
assert.equal(starter.equipmentWishes[0].featureId, 'head_up_display');
assert.equal(starter.vehicle.modelKey, 'ev3');

console.log('equipmentOfferTransfer.test.js: alle Tests bestanden');
