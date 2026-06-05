/**
 * 3-Schichten-System Tests
 * node src/services/search/cleverSearchPipeline.test.js
 */

import assert from 'node:assert/strict';
import { getKiaSalesVehiclePool } from '../../data/kia/kiaPartnerHub.js';
import { filterMarketplaceVehicles } from '../../logic/marketplaceService.js';
import { parseSearchIntent } from './searchIntentParser.js';
import { intentToMarketplaceFilters } from './intentToFilters.js';
import { parseCustomerWish } from '../wish/wishParser.js';
import { runCleverSearch } from './cleverSearchPipeline.js';
import { buildSearchProfile } from './searchProfile.js';
import { passesHardRules } from './hardExclusionRules.js';
import { getModelLineKey } from '../sales/advisorRanking.js';
import { adjustRateForTerm } from '../../logic/oneSearchService.js';

function runQuery(query, extra = {}) {
  const intent = parseSearchIntent(query);
  const filters = { ...intentToMarketplaceFilters(intent), ...extra.filters };
  const wishes = parseCustomerWish(query);
  if (filters.fuel === 'elektro' && !wishes.features.includes('elektro')) {
    wishes.features.push('elektro');
  }
  const pool = getKiaSalesVehiclePool({ dealerSlug: 'autohaus-trinkle' });
  const prepared = filterMarketplaceVehicles(pool, filters).map((v) => ({
    ...v,
    displayRate: adjustRateForTerm(v.monthlyRate, 48),
  }));
  return runCleverSearch({
    query,
    intent,
    filters,
    wishes,
    vehicles: prepared,
    getDisplayRate: (v) => v.displayRate,
    limit: 30,
  });
}

function modelLines(result) {
  return result.matches.map((m) => getModelLineKey(m.vehicle));
}

const sevenIntent = parseSearchIntent('7-Sitzer');
assert.equal(sevenIntent.seatsMin, 7, '7-Sitzer → seatsMin=7');
assert.ok(sevenIntent.features.includes('seats_7'), '7-Sitzer → seats_7 Feature');

const pool = getKiaSalesVehiclePool({ dealerSlug: 'autohaus-trinkle' });
const ev3 = pool.find((v) => v.modelKey === 'ev3');
const sorento = pool.find((v) => v.modelKey?.startsWith('sorento'));
const profile7 = buildSearchProfile({ query: '7-Sitzer', intent: sevenIntent });
assert.ok(!passesHardRules(ev3, profile7), 'EV3 scheitert bei 7-Sitzer');
assert.ok(passesHardRules(sorento, profile7), 'Sorento besteht bei 7-Sitzer');

const elektro = runQuery('Elektroauto', { filters: { useCase: 'family' } });
assert.ok(elektro.matches.length >= 4, 'Elektro: mehrere Modelllinien');
const elektroLines = new Set(modelLines(elektro));
assert.equal(elektroLines.size, elektro.matches.length, 'Kein Varianten-Spam');
assert.ok(elektroLines.has('ev3'), 'EV3 dabei');
assert.equal(
  elektro.matches.filter((m) => getModelLineKey(m.vehicle) === 'ev3').length,
  1,
  'Nicht 8× EV3',
);

const ev3Group = elektro.modelLineGroups.find((g) => g.modelLineKey === 'ev3');
assert.ok(ev3Group, 'EV3 Modelllinien-Gruppe');
assert.equal(ev3Group.variantCount, 3, 'EV3: Air, Earth, GT-Line');
assert.equal(ev3Group.variants.length, 2, 'Zwei Alternativen zum Primary-Trim');

const seven = runQuery('7-Sitzer');
const sevenLines = new Set(modelLines(seven));
assert.ok(!sevenLines.has('ev3'), 'EV3 nicht bei 7-Sitzer');
assert.ok(!sevenLines.has('ev2'), 'EV2 nicht bei 7-Sitzer');
assert.ok(sevenLines.has('sorento') || sevenLines.has('ev9'), 'Sorento oder EV9');

const elektroSeven = runQuery('Elektro 7-Sitzer');
for (const m of elektroSeven.matches) {
  assert.equal(m.vehicle.powertrain, 'elektro', 'Nur Elektro');
}
assert.ok(!new Set(modelLines(elektroSeven)).has('ev3'), 'EV3 ausgeschlossen');

const klein = runQuery('Kleinwagen Automatik Sitzheizung');
if (klein.matches.length) {
  const topLine = getModelLineKey(klein.matches[0].vehicle);
  assert.ok(['picanto', 'ev2'].includes(topLine), `Kleinwagen-Top: ${topLine}`);
}

const prof = buildSearchProfile({
  query: 'Elektroauto 7-Sitzer unter 500 Euro mit Sitzheizung',
  intent: parseSearchIntent('Elektroauto 7-Sitzer unter 500 Euro mit Sitzheizung'),
});
assert.equal(prof.fuel, 'electric');
assert.equal(prof.seatsMin, 7);

console.log('cleverSearchPipeline tests OK');
