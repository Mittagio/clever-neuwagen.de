import assert from 'node:assert/strict';
import { buildWishesFromChipIds } from './salesAdvisorService.js';
import { buildSalesWhatsAppMessage } from './salesShareService.js';

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
assert.ok(message.includes('CleverQuote 97 %'));
assert.ok(message.includes('Autohaus Trinkle'));

console.log('salesAdvisorService tests OK');
