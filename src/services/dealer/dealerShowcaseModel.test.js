/**
 * node src/services/dealer/dealerShowcaseModel.test.js
 */

import assert from 'node:assert/strict';
import { buildShowcaseCards, mapModelLineToShowcaseCard } from './dealerShowcaseModel.js';
import { computeSalesAdvisorResults } from '../sales/salesAdvisorService.js';

const sales = computeSalesAdvisorResults([], { limit: 12, dealerSlug: 'autohaus-trinkle' });
assert.ok(sales.modelLineGroups.length >= 3, 'Showcase: Modelllinien aus Bestand');

const cards = buildShowcaseCards(sales.modelLineGroups);
assert.ok(cards.length >= 3, 'Showcase: Karten');
assert.ok(cards.every((c) => c.fromBackend), 'Showcase: Backend-Flag');

const ev3 = cards.find((c) => c.id === 'ev3' || c.modelKey === 'ev3');
assert.ok(ev3, 'EV3 Karte');
assert.ok(ev3.rateFrom != null, 'EV3 Rate');

const mapped = mapModelLineToShowcaseCard(sales.modelLineGroups[0]);
assert.ok(mapped.slug || mapped.searchQuery, 'Slug oder Suchquery');

const fallback = buildShowcaseCards([]);
assert.ok(fallback.length >= 5, 'Fallback: statische Modellwelt');

console.log('dealerShowcaseModel tests OK');
