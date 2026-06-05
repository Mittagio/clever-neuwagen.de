/**
 * node src/services/search/advisorSearchAlternatives.test.js
 */

import assert from 'node:assert/strict';
import { parseSearchIntent } from './searchIntentParser.js';
import { buildSearchProfile } from './searchProfile.js';
import { runAdvisorSearchWithAlternatives } from './advisorSearchAlternatives.js';
import { getKiaSalesVehiclePool } from '../../data/kia/kiaPartnerHub.js';
import { adjustRateForTerm } from '../../logic/oneSearchService.js';

const q = 'Elektro 7-Sitzer bis 50.000 €';
const intent = parseSearchIntent(q);
const filters = { query: q, dealer: 'autohaus-trinkle', maxPrice: 50000, payment: 'cash' };
const profile = buildSearchProfile({ query: q, intent, filters });
const vehicles = getKiaSalesVehiclePool({ dealerSlug: 'autohaus-trinkle' }).map((v) => ({
  ...v,
  displayRate: adjustRateForTerm(v.monthlyRate, 48),
}));

const bundle = runAdvisorSearchWithAlternatives({
  query: q,
  intent,
  profile,
  filters,
  wishes: { features: ['elektro', 'seats_7'], budget: { type: 'cash', maxPrice: 50000 }, rawQuery: q },
  vehicles,
  getDisplayRate: (v) => v.displayRate,
  limit: 8,
});

assert.equal(bundle.hasExactMatch, false, 'Kein exakter Treffer');
assert.ok(bundle.guidanceMessage, 'Erklärungstext');
assert.ok(bundle.alternatives.length >= 2, 'Mindestens 2 Alternativ-Stufen');

const labels = bundle.alternatives.flatMap((t) => t.modelLineGroups.map((g) => g.label));
assert.ok(labels.length > 0, 'Alternativen haben Modelllinien');

const sevenTier = bundle.alternatives.find((t) => t.id === 'seven_flexible_fuel');
if (sevenTier) {
  const sevenLabels = sevenTier.modelLineGroups.map((g) => g.label);
  assert.ok(!sevenLabels.some((l) => /^EV3$/i.test(l)), 'EV3 nicht in 7-Sitzer-Stufe');
}

const fiveSeaterTier = bundle.alternatives.find((t) => t.id === 'elektro_five_seater');
assert.ok(fiveSeaterTier?.modelLineGroups.length, 'Elektro-5-Sitzer-Stufe hat Treffer');

console.log('advisorSearchAlternatives OK');
console.log('Stufen:', bundle.alternatives.map((t) => `${t.title} (${t.modelLineGroups.length})`).join(' | '));
