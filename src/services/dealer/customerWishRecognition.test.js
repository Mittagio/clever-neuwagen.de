import assert from 'node:assert/strict';
import { parseSearchIntent } from '../search/searchIntentParser.js';
import { intentToMarketplaceFilters } from '../search/intentToFilters.js';
import { matchDealerChipIdsFromDraft } from './dealerWishChips.js';
import { buildRecognizedCustomerWishes } from './customerWishRecognition.js';

const query = 'Anhängelast 1500 kg. Wunsch Hybrid oder Elektro. Zeitnahe Verfügbarkeit. Ich habe bereits eine E-Mail über den Konfigurator geschickt.';
const intent = parseSearchIntent(query);
const filters = intentToMarketplaceFilters(intent);
const chips = matchDealerChipIdsFromDraft(query, filters);

assert.equal(intent.towCapacityKg, 1500);
assert.deepEqual(intent.fuelAlternatives, ['hybrid', 'elektro']);
assert.equal(intent.availability, 'sofort_verfuegbar');
assert.equal(intent.existingLead, true);
assert.ok(chips.includes('tow_1500'));
assert.ok(chips.includes('availability_sofort'));

const wishes = buildRecognizedCustomerWishes({ intent, filters });
const labels = wishes.map((wish) => wish.label);
assert.ok(labels.some((label) => /Anhängelast/i.test(label)));
assert.ok(labels.some((label) => /Hybrid oder Elektro/i.test(label)));
assert.ok(labels.some((label) => /Verfügbarkeit/i.test(label)));
assert.ok(labels.some((label) => /Anfrage gestellt/i.test(label)));

const mileageQuery = 'Fahre 20.000 km, Leasing bis 350 €, Sitzheizung';
const mileageIntent = parseSearchIntent(mileageQuery);
assert.equal(mileageIntent.mileagePerYear, 20000);
assert.equal(mileageIntent.maxRate, 350);
assert.ok(mileageIntent.features.includes('heated_seats'));

const wohnwagen = parseSearchIntent('Wohnwagen 1,8 t, drei Kinder, Hundebox, Lagerfahrzeug');
assert.equal(wohnwagen.towCapacityKg, 1800);
assert.equal(wohnwagen.familyHint, 'Drei Kinder');
assert.equal(wohnwagen.availability, 'sofort_verfuegbar');
assert.ok(wohnwagen.dogBoxHint);

const rateQuery = 'Fahre 20.000 km, maximal 350 € Rate';
const rateIntent = parseSearchIntent(rateQuery);
assert.equal(rateIntent.maxRate, 350);

const euroRateIntent = parseSearchIntent('maximal 400 Euro Rate, Diesel oder Benzin');
assert.equal(euroRateIntent.maxRate, 400);
assert.deepEqual(euroRateIntent.fuelAlternatives, ['diesel', 'verbrenner']);

const wallboxWishes = buildRecognizedCustomerWishes({
  intent: parseSearchIntent('EV6, Wallbox in der Garage'),
});
assert.ok(wallboxWishes.some((wish) => /Wallbox/i.test(wish.label)));

const isofixIntent = parseSearchIntent('Familien-SUV, zwei Kindersitze hinten');
assert.equal(isofixIntent.isofixRearMin, 2);

const chargeQuery = 'Plug-in oder Diesel, Schnellladen CCS, 0% Finanzierung';
const chargeIntent = parseSearchIntent(chargeQuery);
assert.deepEqual(chargeIntent.fuelAlternatives, ['plugin-hybrid', 'diesel']);
assert.ok(chargeIntent.features.includes('fast_charge'));
assert.equal(chargeIntent.financeZeroPercent, true);

const chargeWishes = buildRecognizedCustomerWishes({ intent: chargeIntent });
const chargeLabels = chargeWishes.map((wish) => wish.label);
assert.ok(chargeLabels.some((label) => /Plug-in|Diesel/i.test(label)));
assert.ok(chargeLabels.some((label) => /Schnellladen/i.test(label)));
assert.ok(chargeLabels.some((label) => /0 % Finanzierung/i.test(label)));

console.log('customerWishRecognition.test.js: ok');
