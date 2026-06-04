import assert from 'node:assert/strict';
import { buildCuratedResultsLine } from '../services/cleverQuote/cleverQuoteConstants.js';
import { formatMatchPrimaryPrice } from './discoveryDisplay.js';

assert.match(buildCuratedResultsLine(12, 3), /besten 3 Treffer/);
assert.match(buildCuratedResultsLine(2, 3), /besten Treffer/);
assert.match(buildCuratedResultsLine(0, 3), /Keine Kia-Modelle/);

const cashPrice = formatMatchPrimaryPrice(
  { vehicle: { cashPrice: 38065, monthlyRate: 318 }, bestOffer: { monthlyRate: 318 } },
  'cash',
);
assert.ok(!cashPrice.suffix);
assert.ok(cashPrice.label.includes('38'));

const leasePrice = formatMatchPrimaryPrice(
  { vehicle: { cashPrice: 38065, monthlyRate: 318 }, bestOffer: { monthlyRate: 318 } },
  'leasing',
);
assert.equal(leasePrice.suffix, '/Monat');

console.log('mvpDiscoveryPricing.test.js: ok');
