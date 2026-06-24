/**
 * node src/services/dealerAiParser.test.js
 */
import assert from 'node:assert/strict';
import {
  parseDealerAiInput,
  applyDealerAiTermMonths,
  LEASE_TERM_MONTHS,
} from './dealerAiParser.js';

function field(parsed, label) {
  return parsed.displayFields.find((row) => row.label === label)?.value;
}

const ev5Km48 = parseDealerAiInput('ev5 leasing 50.000 km 48');
assert.equal(ev5Km48.ok, true);
assert.equal(ev5Km48.fields.paymentType, 'leasing');
assert.equal(ev5Km48.fields.termMonths, 48);
assert.equal(ev5Km48.fields.desiredRate, null, '48 ist Laufzeit, keine Wunschrate');
assert.equal(ev5Km48.action, 'create_leasing_offer');

const ev5Km48Monate = parseDealerAiInput('ev5 leasing 50.000 km 48 monate');
assert.equal(ev5Km48Monate.fields.termMonths, 48);
assert.equal(ev5Km48Monate.fields.desiredRate, null, 'keine Doppel-Interpretation als Rate');

const explicitRate = parseDealerAiInput(
  'Erstelle mir für Herrn Müller ein Angebot für einen Sportage Spirit, 48 Monate, 15.000 km, Wunschrate 350 €.',
);
assert.equal(explicitRate.fields.termMonths, 48);
assert.equal(explicitRate.fields.desiredRate, 350);

const leasingAb = parseDealerAiInput('EV3 Earth, Frost Blue, Leasing ab 329 €.');
assert.equal(leasingAb.fields.desiredRate, 329);
assert.equal(leasingAb.fields.paymentType, 'leasing');

assert.deepEqual(LEASE_TERM_MONTHS, [12, 24, 36, 42, 48, 60]);

const suvWish = parseDealerAiInput(
  'Suche ein Benziner, Automatik, Größe bis 4,50 Meter, SUV, um die 250 Euro im Monat mit vier Jahren und 10.000 Kilometer. Rückfahrkamera und Sitzheizung.',
);
assert.equal(suvWish.ok, true);
assert.equal(suvWish.fields.paymentType, 'leasing');
assert.equal(suvWish.fields.bodyType, 'SUV');
assert.equal(suvWish.fields.termMonths, 48);
assert.equal(suvWish.fields.mileagePerYear, 10000);
assert.equal(suvWish.fields.desiredRate, 250);

const test1 = parseDealerAiInput('Kia Sportage Hybrid Kauf');
assert.equal(test1.fields.model, 'Sportage');
assert.match(test1.fields.motorLabel, /hybrid/i);
assert.equal(test1.fields.paymentType, 'cash');
assert.equal(test1.action, 'create_cash_offer');

const test2 = parseDealerAiInput('EV3 Leasing 48 Monate 10.000 Kilometer 300 Euro Rate');
assert.equal(test2.fields.model, 'EV3');
assert.equal(test2.fields.paymentType, 'leasing');
assert.equal(test2.fields.termMonths, 48);
assert.equal(test2.fields.mileagePerYear, 10000);
assert.equal(test2.fields.desiredRate, 300);
assert.equal(test2.action, 'create_leasing_offer');

const test3 = parseDealerAiInput(
  'Kunde möchte Sportage Hybrid finanzieren mit 5.000 Euro Anzahlung und ca. 350 Euro Rate',
);
assert.equal(test3.fields.model, 'Sportage');
assert.match(test3.fields.motorLabel, /hybrid/i);
assert.equal(test3.fields.paymentType, 'financing');
assert.equal(test3.fields.downPayment, 5000);
assert.equal(test3.fields.desiredRate, 350);
assert.equal(test3.action, 'create_financing_offer');

const test4 = parseDealerAiInput(
  'Kunde möchte EV4 mit Schlussrate und Rückgabeoption, Laufzeit 48 Monate',
);
assert.equal(test4.fields.model, 'EV4');
assert.equal(test4.fields.paymentType, 'threeWayFinancing');
assert.equal(test4.fields.termMonths, 48);
assert.equal(test4.action, 'create_three_way_offer');

const test5 = parseDealerAiInput('Kia Niro Hybrid Kauf, Übergabe am liebsten nächste Woche');
assert.equal(test5.fields.model, 'Niro');
assert.match(test5.fields.motorLabel, /hybrid/i);
assert.equal(test5.fields.paymentType, 'cash');
assert.equal(test5.fields.desiredDeliveryDate, 'nächste Woche');
assert.equal(test5.action, 'create_cash_offer');

const manualTerm = applyDealerAiTermMonths(ev5Km48, 36);
assert.equal(manualTerm.fields.termMonths, 36);

const leaseBundle = parseDealerAiInput('Kia EV4 Air Leasing 48 10.000 km 2000 € Anzahlung');
assert.equal(leaseBundle.ok, true);
assert.equal(leaseBundle.fields.termMonths, 48);
assert.equal(leaseBundle.fields.mileagePerYear, 10000);
assert.equal(leaseBundle.fields.downPayment, 2000);
assert.equal(leaseBundle.fields.desiredRate, null, 'Anzahlung ist kein Budget');

console.log('dealerAiParser.test.js: ok');
