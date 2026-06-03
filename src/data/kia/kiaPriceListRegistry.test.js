import assert from 'node:assert/strict';
import {
  getKiaPdfPriceList,
  listKiaPdfPriceLists,
  getKiaPdfImportStats,
  getKiaPdfPriceFrom,
} from './kiaPriceListRegistry.js';

const stats = getKiaPdfImportStats();
assert.equal(stats.total, 19, '19 PDF-Dateien importiert');
assert.ok(stats.withVariants >= 14, 'Mindestens 14 Modelle mit Varianten');
assert.ok(stats.totalVariants >= 80, 'Mindestens 80 UPE-Kombinationen');

const ev3 = getKiaPdfPriceList('ev3');
assert.equal(ev3.priceFromGross, 35990);
assert.equal(ev3.variantCount, 7);
assert.ok(ev3.variants.some((v) => v.trimId === 'gt-line' && v.priceGross === 48690));

const sportage = getKiaPdfPriceList('sportage');
assert.equal(sportage.priceFromGross, 33990);
assert.ok(sportage.variantCount >= 20);

const sportagePhev = getKiaPdfPriceList('sportage-phev');
assert.equal(sportagePhev.priceFromGross, 43100);
assert.equal(sportagePhev.variantCount, 7);
assert.ok(!sportagePhev.importNote);

const ev6 = getKiaPdfPriceList('ev6');
assert.equal(ev6.priceFromGross, 44990);
assert.equal(ev6.variantCount, 8);
assert.ok(!ev6.importNote);

const ev5gt = getKiaPdfPriceList('ev5-gt');
assert.equal(ev5gt.variantCount, 1);
assert.equal(ev5gt.variants[0].priceGross, 59990);

const pending = listKiaPdfPriceLists().filter((m) => m.import?.importNote);
assert.equal(pending.length, 0, 'Alle OCR-PDFs manuell ergänzt');

assert.equal(getKiaPdfPriceFrom('ev3'), 35990);

console.log('kiaPriceListRegistry tests OK');
