/**
 * Kundenakte – Datenstruktur & Fahrzeugkarten
 */
import assert from 'node:assert/strict';
import {
  buildVehicleOpportunityCards,
  buildWishConditionChips,
  computeAkteCleverStaerke,
  formatCustomerSince,
  formatVehicleCardConditions,
  formatVehicleCardPrice,
  formatVehicleCardsReadyMessage,
} from './customerAkte.js';

const since = formatCustomerSince(new Date().toISOString());
assert.ok(since?.includes('heute'));

const score = computeAkteCleverStaerke({
  name: 'Max Müller',
  phone: '0170',
  email: 'max@web.de',
  kundenhelferNotes: 'Hund, 2 Kinder',
  vehicleCardCount: 2,
  offersCount: 1,
});
assert.ok(score >= 70);

const cards = buildVehicleOpportunityCards({
  lead: { id: 'lead-1', createdAt: new Date().toISOString() },
  wishFields: {
    model: 'EV3',
    trimLabel: 'Earth',
    paymentType: 'leasing',
    termMonths: 48,
    mileagePerYear: 10000,
    desiredRate: 399,
  },
  reservedModels: [
    { id: 'ev3', name: 'EV3', modelKey: 'ev3', trimLabel: 'Earth', isPrimary: true },
    { id: 'sportage', name: 'Sportage Hybrid', modelKey: 'sportage-hybrid', trimLabel: 'Vision' },
  ],
  offers: [],
});

assert.equal(cards.length, 2);
assert.equal(formatVehicleCardConditions(cards[0]), '48 Monate · 10.000 km');
assert.equal(formatVehicleCardPrice(cards[0]), '399 € /Monat');

const cashCard = buildVehicleOpportunityCards({
  wishFields: {
    model: 'Sportage Hybrid',
    trimLabel: 'Vision',
    paymentType: 'cash',
    desiredPrice: 29000,
  },
})[0];
assert.equal(formatVehicleCardConditions(cashCard), 'Kauf');
assert.equal(formatVehicleCardPrice(cashCard), '29.000 € inkl. MwSt.');

assert.equal(formatVehicleCardsReadyMessage(3, 'Max Müller'), '3 Fahrzeuge für Max Müller vorgemerkt.');

const leasingChips = buildWishConditionChips({
  paymentType: 'leasing',
  termMonths: 48,
  mileagePerYear: 10000,
  desiredRate: 350,
});
assert.deepEqual(leasingChips, [
  'Leasing',
  '48 Monate',
  '10.000 km/Jahr',
  '0 € Anzahlung',
  'bis 350 €/Monat',
  'Liefertermin Egal',
]);

const cashChips = buildWishConditionChips({
  paymentType: 'cash',
  desiredPrice: 50000,
  delivery: 'flexibel',
});
assert.ok(cashChips.includes('Kauf'));
assert.ok(cashChips.some((c) => c.includes('50.000')));

console.log('customerAkte.test.js: ok');
