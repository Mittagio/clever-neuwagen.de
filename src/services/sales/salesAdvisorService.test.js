import assert from 'node:assert/strict';
import { buildWishesFromChipIds, findSalesAdvisorMatches, needsWishClarification } from './salesAdvisorService.js';
import { buildSalesWhatsAppMessage } from './salesShareService.js';
import { getKiaSalesVehiclePool } from '../../data/kia/kiaPartnerHub.js';
import { getModelLineKey } from './advisorRanking.js';

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

const elektroBudgetTight = findSalesAdvisorMatches(
  ['fuel_elektro', 'budget_250'],
  { limit: 5, activeKiaModelIds: ['sportage', 'ev3', 'ev4'] },
);
assert.ok(elektroBudgetTight.length > 0, 'Elektro auch bei engem Budget');
assert.ok(
  elektroBudgetTight.every((m) => m.vehicle?.powertrain === 'elektro'),
  'Enges Budget: niemals Sportage bei Elektro-Wunsch',
);

const elektroSportageOnly = findSalesAdvisorMatches(
  ['fuel_elektro'],
  { limit: 5, activeKiaModelIds: ['sportage'] },
);
assert.equal(elektroSportageOnly.length, 0, 'Ohne EV im Katalog: kein falscher Sportage-Fallback');

assert.ok(needsWishClarification(['fuel_elektro']), 'Nur Elektro → Nachfrage nötig');
assert.ok(!needsWishClarification(['fuel_elektro', 'daily_family']), 'Elektro + Familie → direkt weiter');
assert.ok(!needsWishClarification(['fuel_elektro', 'budget_400']), 'Elektro + Budget → direkt weiter');

const elektroOnly = findSalesAdvisorMatches(['fuel_elektro', 'daily_family'], {
  limit: 12,
  dealerSlug: 'autohaus-trinkle',
});
assert.ok(elektroOnly.length >= 3, 'Elektro: mehrere Modelllinien');
const modelLines = new Set(elektroOnly.map((m) => getModelLineKey(m.vehicle)));
assert.ok(modelLines.size >= 3, 'Kein EV3-Spam: mindestens 3 verschiedene Modelllinien');
const ev3Count = elektroOnly.filter((m) => getModelLineKey(m.vehicle) === 'ev3').length;
assert.equal(ev3Count, 1, 'Pro Modelllinie maximal ein Treffer');

const percents = elektroOnly.map((m) => m.cleverQuote?.percent).filter((p) => p != null);
const uniquePercents = new Set(percents);
assert.ok(uniquePercents.size >= 2, 'CleverQuote differenziert (nicht alle gleich)');
assert.ok(percents[0] >= (percents[1] ?? 0), 'Absteigend nach CleverQuote');
assert.ok(percents.every((p) => p >= 0 && p <= 100), 'CleverQuote aus echter Wunsch-Passung (0–100 %)');
assert.ok(elektroOnly[0].cleverQuote?.advisorMode, 'Beratermodus aktiv');

const elektroBudgetFamily = findSalesAdvisorMatches(
  ['fuel_elektro', 'budget_400', 'daily_family'],
  { limit: 8, dealerSlug: 'autohaus-trinkle' },
);
if (elektroBudgetFamily.length >= 2) {
  assert.ok(
    elektroBudgetFamily.every((m) => m.cleverQuote?.percent != null),
    'CleverQuote für alle Budget+Familie-Treffer',
  );
  const budgetModelLines = new Set(elektroBudgetFamily.map((m) => getModelLineKey(m.vehicle)));
  assert.ok(budgetModelLines.size >= 2, 'Budget+Familie: mehrere Modelllinien');
}

console.log('salesAdvisorService tests OK');
