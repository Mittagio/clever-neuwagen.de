import assert from 'node:assert/strict';
import {
  getKiaPdfPriceList,
  listKiaPdfPriceLists,
  getKiaPdfImportStats,
  getKiaPdfPriceFrom,
} from './kiaPriceListRegistry.js';

const stats = getKiaPdfImportStats();
assert.equal(stats.total, 24, '24 PDF-Preislisten (inkl. Sportage Hybrid aus Sportage-PDF)');
assert.ok(stats.withVariants >= 18, 'Mindestens 18 Modelle mit Varianten');
assert.ok(stats.totalVariants >= 95, 'Mindestens 95 UPE-Kombinationen');

const picanto = getKiaPdfPriceList('picanto');
assert.equal(picanto.priceFromGross, 17590);
assert.equal(picanto.variantCount, 7);
assert.ok(!picanto.importNote);

const ev3 = getKiaPdfPriceList('ev3');
assert.equal(ev3.priceFromGross, 35990);
assert.equal(ev3.variantCount, 7);
assert.ok(ev3.variants.some((v) => v.trimId === 'gt-line' && v.priceGross === 48690));

const sportage = getKiaPdfPriceList('sportage');
assert.equal(sportage.priceFromGross, 33990);
assert.equal(sportage.variantCount, 14, 'Benzin + Diesel aus Sportage-PDF');

const sportageHybrid = getKiaPdfPriceList('sportage-hybrid');
assert.equal(sportageHybrid.priceFromGross, 38990);
assert.equal(sportageHybrid.variantCount, 9);
assert.ok(sportageHybrid.derivedFrom === 'sportage');
assert.ok(sportageHybrid.variants.some((v) => v.trimId === 'core' && v.drive === '2WD' && v.power === '176 kW (239 PS)'));

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

const ev4Fastback = getKiaPdfPriceList('ev4-fastback');
assert.equal(ev4Fastback.variantCount, 2);
assert.equal(ev4Fastback.priceFromGross, 47140);

const ev6gt = getKiaPdfPriceList('ev6-gt');
assert.equal(ev6gt.variantCount, 1);
assert.equal(ev6gt.variants[0].priceGross, 69990);

const ev9gt = getKiaPdfPriceList('ev9-gt');
assert.ok(ev9gt.variantCount >= 1);
assert.equal(ev9gt.priceFromGross, 90490);

const pv5Cargo = getKiaPdfPriceList('pv5-cargo-l2h1');
assert.equal(pv5Cargo.variantCount, 3);
assert.equal(pv5Cargo.priceFromGross, 38990);

const pending = listKiaPdfPriceLists().filter((m) => m.import?.importNote);
assert.equal(pending.length, 0, 'Alle OCR-PDFs manuell ergänzt');

assert.equal(getKiaPdfPriceFrom('ev3'), 35990);

console.log('kiaPriceListRegistry tests OK');
