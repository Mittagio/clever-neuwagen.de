import assert from 'node:assert/strict';
import { buildWishesFromChipIds, findSalesAdvisorMatches } from './salesAdvisorService.js';
import { buildSalesWhatsAppMessage } from './salesShareService.js';
import { getKiaSalesVehiclePool } from '../../data/kia/kiaPartnerHub.js';

const wishes = buildWishesFromChipIds([
  'fuel_elektro',
  'heated_seats',
  'camera_360',
  'budget_400',
  'type_suv',
]);

assert.ok(wishes.features.includes('elektro'));
assert.ok(wishes.features.includes('heated_seats'));
assert.ok(wishes.features.includes('camera_360'));
assert.equal(wishes.budget.maxMonthlyRate, 400);
assert.equal(wishes.bodyType, 'suv');

const message = buildSalesWhatsAppMessage({
  customerName: 'Herr Müller',
  sellerName: 'Max Mustermann',
  dealerName: 'Autohaus Trinkle',
  matches: [{ model: 'Kia EV3', cleverQuote: { percent: 97 } }],
  shareUrl: 'https://clever-neuwagen.de/vergleich/ABC',
});

assert.ok(message.includes('Herr Müller'));
assert.ok(message.includes('97 % CleverQuote'));
assert.ok(message.includes('geprüft'));
assert.ok(message.includes('Autohaus Trinkle'));

const kiaPool = getKiaSalesVehiclePool();
assert.ok(kiaPool.every((v) => v.brand === 'Kia'), 'Verkaufs-Pool nur Kia');

const matches = findSalesAdvisorMatches([
  'fuel_elektro',
  'heated_seats',
  'camera_360',
  'budget_400',
  'type_suv',
], { limit: 10 });
assert.ok(matches.length > 0, 'Kia-Matches bei Elektro-SUV-Wunsch');
assert.ok(
  matches.every((m) => m.vehicle?.brand === 'Kia'),
  'findSalesAdvisorMatches liefert nur Kia',
);
assert.ok(
  !matches.some((m) => ['Ford', 'Hyundai', 'MG', 'VW'].includes(m.vehicle?.brand)),
  'Kein Multi-Brand-Fallback',
);
assert.ok(matches[0].kiaMeta, 'Kia-Meta angereichert');

if (matches.length >= 2 && matches[0].cleverQuote && matches[1].cleverQuote) {
  const p0 = matches[0].cleverQuote.percent ?? 0;
  const p1 = matches[1].cleverQuote.percent ?? 0;
  assert.ok(p0 >= p1, 'Matches nach CleverQuote sortiert');
}

console.log('salesAdvisorService tests OK');
