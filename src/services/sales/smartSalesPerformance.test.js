/**
 * Sprint 34 Phase C – Performance-Budget (Regel 8)
 * Ziel: Suche < 2 s · CleverQuote-Pool < 1 s · Resolver pro Aufruf < 25 ms
 */
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { getKiaSalesVehiclePool } from '../../data/kia/kiaPartnerHub.js';
import { MANUFACTURER_MODELS } from '../../data/manufacturer/manufacturerRegistry.js';
import { resolveWishConfiguration } from '../configurator/wishPackageResolver.js';
import { computeCleverQuote } from '../cleverQuote/cleverQuoteService.js';
import { buildWishesFromChipIds, findSalesAdvisorMatches } from './salesAdvisorService.js';

const BUDGET_MS = {
  salesSearch: 2000,
  cleverQuotePool: 1000,
  wishResolveCall: 25,
};

const MVP_CHIP_IDS = [
  'fuel_elektro',
  'heated_seats',
  'camera_360',
  'heat_pump',
  'budget_400',
  'type_suv',
];

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function measureRuns(fn, runs = 3) {
  const samples = [];
  for (let i = 0; i < runs; i += 1) {
    const t0 = performance.now();
    fn();
    samples.push(performance.now() - t0);
  }
  return { samples, ms: median(samples) };
}

function warmUp() {
  findSalesAdvisorMatches(MVP_CHIP_IDS, { limit: 12 });
  const wishes = buildWishesFromChipIds(MVP_CHIP_IDS);
  const pool = getKiaSalesVehiclePool();
  for (const v of pool.slice(0, 3)) {
    computeCleverQuote({ vehicle: v, wishes });
  }
}

warmUp();

const search = measureRuns(() => {
  findSalesAdvisorMatches(MVP_CHIP_IDS, { limit: 12 });
});
assert.ok(
  search.ms < BUDGET_MS.salesSearch,
  `Verkaufssuche ${search.ms.toFixed(1)} ms > ${BUDGET_MS.salesSearch} ms`,
);

const wishes = buildWishesFromChipIds(MVP_CHIP_IDS);
const pool = getKiaSalesVehiclePool();
const quoteBatch = measureRuns(() => {
  for (const vehicle of pool) {
    computeCleverQuote({ vehicle, wishes });
  }
});
assert.ok(
  quoteBatch.ms < BUDGET_MS.cleverQuotePool,
  `CleverQuote-Pool (${pool.length} Fzg.) ${quoteBatch.ms.toFixed(1)} ms > ${BUDGET_MS.cleverQuotePool} ms`,
);

const sportage = MANUFACTURER_MODELS.sportage;
const resolveBatch = measureRuns(() => {
  resolveWishConfiguration({
    brand: sportage.brand,
    model: sportage.model,
    trimId: sportage.defaultTrimId,
    wishFeatureIds: ['heated_seats', 'camera_360', 'heat_pump', 'towbar'],
    engineId: sportage.defaultEngineId,
  });
}, 5);
assert.ok(
  resolveBatch.ms < BUDGET_MS.wishResolveCall,
  `Wish-Resolver ${resolveBatch.ms.toFixed(1)} ms > ${BUDGET_MS.wishResolveCall} ms`,
);

console.log('Sprint 34 Performance OK');
console.log(`  Verkaufssuche:     ${search.ms.toFixed(1)} ms (Budget ${BUDGET_MS.salesSearch} ms)`);
console.log(`  CleverQuote-Pool:  ${quoteBatch.ms.toFixed(1)} ms / ${pool.length} Fahrzeuge (Budget ${BUDGET_MS.cleverQuotePool} ms)`);
console.log(`  Wish-Resolver:     ${resolveBatch.ms.toFixed(1)} ms (Budget ${BUDGET_MS.wishResolveCall} ms)`);
