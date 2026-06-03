import assert from 'node:assert/strict';
import {
  KIA_OFFICIAL_MODELS,
  KIA_PRICE_LIST_META,
  getKiaOfficialModel,
  listKiaOfficialModels,
  formatKiaPriceFrom,
  getKiaOfficialCatalogSummary,
} from './kiaOfficialPriceList.js';

assert.equal(KIA_PRICE_LIST_META.sourceUrl, 'https://www.kia.com/de/broschuere/');
assert.equal(KIA_PRICE_LIST_META.validUntil, '2026-06-30');
assert.ok(KIA_OFFICIAL_MODELS.length >= 27, 'Alle Modelllinien der Kia-Preislistenseite');

const sportage = getKiaOfficialModel('sportage');
assert.equal(sportage.priceFromGross, 33990);
assert.equal(sportage.monthlyRateFrom, 199);

const ev3 = getKiaOfficialModel('ev3');
assert.equal(ev3.priceFromGross, 35990);
assert.equal(ev3.monthlyRateFrom, 299);
assert.ok(ev3.wltpText.includes('Air'));
assert.ok(ev3.wltpText.includes('Earth/GT-line'));

const ev5gt = getKiaOfficialModel('ev5-gt');
assert.equal(ev5gt.priceFromGross, 59990);
assert.equal(ev5gt.monthlyRateFrom, 0);
assert.equal(ev5gt.monthlyRateAvailable, false);

const pv5crew = getKiaOfficialModel('pv5-crew');
assert.equal(pv5crew.priceFromGross, null);
assert.equal(pv5crew.orderNote, 'Jetzt bestellbar – Preis folgt mit Markteinführung');

const elektro = listKiaOfficialModels({ powertrain: 'elektro' });
assert.ok(elektro.length >= 8);
assert.ok(elektro.every((m) => m.co2Class === 'A'));

const pbv = listKiaOfficialModels({ category: 'pbv' });
assert.ok(pbv.length >= 4);

assert.ok(formatKiaPriceFrom(35990).includes('35.990'), 'Preisformat DE');

const summary = getKiaOfficialCatalogSummary();
assert.equal(summary.modelCount, KIA_OFFICIAL_MODELS.length);

console.log('kiaOfficialPriceList tests OK');
