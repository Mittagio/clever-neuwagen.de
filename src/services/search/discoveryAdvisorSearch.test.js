import assert from 'node:assert/strict';
import { getMarketplaceVehiclePool } from '../../data/marketplacePool.js';
import { filterMarketplaceVehicles } from '../../logic/marketplaceService.js';
import { adjustRateForTerm } from '../../logic/oneSearchService.js';
import { parseCustomerWish } from '../wish/wishParser.js';
import { matchAndRankDiscovery } from './discoveryAdvisorSearch.js';
import {
  needsDiscoveryClarification,
  getModelLineKey,
} from '../sales/advisorRanking.js';

const filters = {
  query: 'elektro',
  fuel: 'elektro',
  type: 'elektro',
  termMonths: 48,
  brand: 'kia',
  intentStructured: true,
};

const wishes = parseCustomerWish('elektro');
if (!wishes.features.includes('elektro')) wishes.features.push('elektro');

const vehicles = filterMarketplaceVehicles(getMarketplaceVehiclePool(), filters).map((v) => ({
  ...v,
  displayRate: adjustRateForTerm(v.monthlyRate, 48),
}));

assert.ok(needsDiscoveryClarification(filters, wishes), 'Nur Elektro auf /fahrzeuge → Nachfrage');

const withUseCase = { ...filters, useCase: 'family' };
assert.ok(!needsDiscoveryClarification(withUseCase, wishes), 'Mit useCase → keine Nachfrage');

const ranked = matchAndRankDiscovery({
  wishes,
  vehicles,
  filters: withUseCase,
  getDisplayRate: (v) => v.displayRate,
  limit: 12,
});

assert.ok(ranked.length >= 2, 'Mehrere Modelllinien');
const lines = new Set(ranked.map((m) => getModelLineKey(m.vehicle)));
assert.ok(lines.size >= 2, 'Kein Varianten-Spam');
assert.equal(
  ranked.filter((m) => getModelLineKey(m.vehicle) === 'ev3').length,
  1,
  'Max. ein EV3',
);

const percents = ranked.map((m) => m.cleverQuote?.percent).filter((p) => p != null);
assert.ok(new Set(percents).size >= 2, 'CleverQuote differenziert');
assert.ok(ranked[0].cleverQuote?.advisorMode, 'Beratermodus');

console.log('discoveryAdvisorSearch tests OK');
