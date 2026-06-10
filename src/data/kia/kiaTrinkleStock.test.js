import assert from 'node:assert/strict';

import { getKiaTrinklePilotStock, getKiaTrinkleStockStats } from './kiaTrinkleStock.js';

import { findSalesAdvisorMatches } from '../../services/sales/salesAdvisorService.js';

import { listKiaPdfPriceLists } from './kiaPriceListRegistry.js';

import { KIA_DEALER_MODEL_IDS } from './kiaPartnerHub.js';



const stock = getKiaTrinklePilotStock();

const stats = getKiaTrinkleStockStats();



assert.ok(stock.length >= 120, `Mindestens 120 Varianten, aktuell: ${stock.length}`);

assert.equal(stats.modelLineCount, 28, '19 PDF + Niro + Ceed + 7 offizielle Lücken');



const pdfModelKeys = listKiaPdfPriceLists().map((m) => m.modelKey);

for (const modelKey of pdfModelKeys) {

  assert.ok(

    stock.some((v) => v.modelKey === modelKey),

    `Kein Bestand für PDF-Modell ${modelKey}`,

  );

}



for (const v of stock) {

  assert.ok(v.listPriceGross > 0, `UPE fehlt: ${v.id}`);

  assert.ok(v.monthlyRate > 0, `Rate fehlt: ${v.id}`);

  assert.ok(v.technicalSpecs, `Technische Daten fehlen: ${v.id}`);

  assert.ok(v.technicalSpecs.lengthMm > 0, `Länge fehlt: ${v.id}`);

  assert.ok(v.powertrain, `Antrieb fehlt: ${v.id}`);
  assert.equal(v.imageModel, v.modelKey, `imageModel muss modelKey sein: ${v.id}`);
  assert.ok(v.heroImage?.includes('/images/manufacturers/kia/'), `Preislisten-Bild fehlt: ${v.id}`);
}



const elektro = stock.filter((v) => v.powertrain === 'elektro');

assert.ok(elektro.length >= 20, 'Ausreichend Elektro-Varianten im Bestand');

assert.ok(elektro.every((v) => v.modelKey.startsWith('ev') || v.modelKey.startsWith('pv5')));

const pv5Lines = ['pv5-passenger', 'pv5-cargo-l2h1', 'pv5-chassis-cab', 'pv5-crew'];
for (const modelKey of pv5Lines) {
  assert.ok(
    stock.some((v) => v.modelKey === modelKey),
    `PV5-Variante fehlt im Bestand: ${modelKey}`,
  );
}

assert.ok(stock.filter((v) => v.modelKey === 'sportage-hybrid').length >= 9, 'Sportage Hybrid aus Preisliste');
assert.ok(
  stock.some((v) => v.modelKey === 'sportage-hybrid' && v.trimId === 'spirit' && v.powertrain === 'hybrid'),
  'Sportage Hybrid Spirit im Bestand',
);



const matches = findSalesAdvisorMatches(['fuel_elektro'], {

  limit: 10,

  activeKiaModelIds: KIA_DEALER_MODEL_IDS,

  dealerSlug: 'autohaus-trinkle',

});

assert.ok(matches.length >= 5, 'Elektro-Wunsch liefert EV-Modelle');

assert.ok(matches.every((m) => m.vehicle.powertrain === 'elektro'));



const sportageOnly = findSalesAdvisorMatches(['type_suv'], {

  limit: 5,

  activeKiaModelIds: ['sportage'],

  dealerSlug: 'autohaus-trinkle',

});

assert.ok(sportageOnly.every((m) => m.vehicle.modelKey === 'sportage' || m.vehicle.model.includes('Sportage')));



console.log(`kiaTrinkleStock tests OK – ${stats.total} Fahrzeuge, ${stats.modelLineCount} Modelllinien`);

