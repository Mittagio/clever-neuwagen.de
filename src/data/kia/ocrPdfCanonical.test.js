import assert from 'node:assert/strict';
import {
  getKiaPdfPriceList,
  getKiaPdfImportStats,
  listKiaPdfPriceLists,
} from './kiaPriceListRegistry.js';
import {
  SORENTO_DIESEL_VARIANTS,
  SORENTO_HYBRID_VARIANTS,
  SORENTO_PHEV_VARIANTS,
  K4_SPORTSWAGON_VARIANTS,
  EV6_VARIANTS,
  SPORTAGE_PHEV_IMPORT_VARIANTS,
  PICANTO_VARIANTS,
} from './ocrPdfCanonical.js';

function assertPdfMatches(modelKey, expectedVariants, priceFrom) {
  const imp = getKiaPdfPriceList(modelKey);
  assert.ok(imp, modelKey);
  assert.equal(imp.variantCount, expectedVariants.length, `${modelKey} variant count`);
  assert.equal(imp.priceFromGross, priceFrom, `${modelKey} priceFrom`);
  assert.ok(!imp.importNote, `${modelKey} should have no importNote`);
  for (let i = 0; i < expectedVariants.length; i += 1) {
    assert.equal(imp.variants[i].priceGross, expectedVariants[i].priceGross, `${modelKey}[${i}]`);
    assert.equal(imp.variants[i].trimId, expectedVariants[i].trimId, `${modelKey}[${i}] trim`);
  }
}

assertPdfMatches('picanto', PICANTO_VARIANTS, 17590);
assertPdfMatches('sportage-phev', SPORTAGE_PHEV_IMPORT_VARIANTS, 43100);
assertPdfMatches('sorento', SORENTO_DIESEL_VARIANTS, 56690);
assertPdfMatches('sorento-hybrid', SORENTO_HYBRID_VARIANTS, 55190);
assertPdfMatches('sorento-phev', SORENTO_PHEV_VARIANTS, 61140);
assertPdfMatches('k4-sportswagon', K4_SPORTSWAGON_VARIANTS, 29890);
assertPdfMatches('ev6', EV6_VARIANTS, 44990);

const stats = getKiaPdfImportStats();
assert.equal(stats.pendingOcr, 0, 'Keine OCR-ausstehenden PDFs mehr');
assert.ok(stats.totalVariants >= 110, 'Mindestens 110 UPE-Kombinationen gesamt');

const pending = listKiaPdfPriceLists().filter((m) => m.import?.importNote);
assert.equal(pending.length, 0);

console.log('ocrPdfCanonical tests OK');
