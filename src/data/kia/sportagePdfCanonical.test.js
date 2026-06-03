import assert from 'node:assert/strict';
import { kiaSportage } from '../models/kia/sportage.js';
import {
  SPORTAGE_PDF_META,
  SPORTAGE_PDF_VARIANTS,
  SPORTAGE_PDF_PACKAGE_PRICES,
  SPORTAGE_PDF_ACCESSORY_PRICES,
  SPORTAGE_PDF_COLOR_PRICES,
  SPORTAGE_PDF_WLTP,
} from './sportagePdfCanonical.js';
import {
  SPORTAGE_PHEV_PDF_META,
  SPORTAGE_PHEV_PDF_VARIANTS,
  SPORTAGE_PHEV_PDF_WLTP,
} from './sportagePhevPdfCanonical.js';

assert.equal(SPORTAGE_PDF_VARIANTS.length, 24);
assert.equal(SPORTAGE_PHEV_PDF_VARIANTS.length, 7);
assert.equal(SPORTAGE_PDF_META.priceFromGross, 33990);
assert.equal(SPORTAGE_PHEV_PDF_META.priceFromGross, 43100);

const coreEntry = SPORTAGE_PDF_VARIANTS.find(
  (v) => v.trimId === 'core' && v.engineId === 'tgi-mt-2wd',
);
assert.equal(coreEntry.priceGross, 33990);

const phevCore = SPORTAGE_PHEV_PDF_VARIANTS.find(
  (v) => v.trimId === 'core' && v.engineId === 'phev-2wd',
);
assert.equal(phevCore.priceGross, 43100);

assert.equal(kiaSportage.variants.length, 31);
assert.equal(kiaSportage.admin.priceListSource, 'Kia-Germany-Sportage-Preisliste.pdf');
assert.ok(kiaSportage.engines.some((e) => e.id === 'phev-2wd'));
assert.ok(kiaSportage.engines.some((e) => e.id === 'phev-awd'));

for (const pkg of kiaSportage.packages) {
  assert.equal(pkg.priceGross, SPORTAGE_PDF_PACKAGE_PRICES[pkg.id], `Paket ${pkg.id}`);
}

for (const acc of kiaSportage.accessories) {
  assert.equal(acc.priceGross, SPORTAGE_PDF_ACCESSORY_PRICES[acc.id], `Zubehör ${acc.id}`);
}

for (const color of kiaSportage.colors) {
  assert.equal(color.priceGross, SPORTAGE_PDF_COLOR_PRICES[color.id], `Farbe ${color.id}`);
}

for (const entry of kiaSportage.wltp) {
  const pdf = SPORTAGE_PDF_WLTP[entry.engineId] ?? SPORTAGE_PHEV_PDF_WLTP[entry.engineId];
  assert.ok(pdf, `WLTP für ${entry.engineId}`);
  assert.equal(entry.co2, pdf.co2);
  assert.equal(entry.co2Class, pdf.co2Class);
}

console.log('sportagePdfCanonical tests OK');
