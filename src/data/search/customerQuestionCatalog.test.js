/**
 * node src/data/search/customerQuestionCatalog.test.js
 */
import assert from 'node:assert/strict';
import {
  CUSTOMER_QUESTIONS,
  MATCH_QUESTIONS,
  getQuestionCoverageStats,
  TOP_DEMO_SEARCH_QUERIES,
} from './customerQuestionCatalog.js';
import { parseSearchIntent } from '../../services/search/searchIntentParser.js';

const stats = getQuestionCoverageStats();

assert.ok(CUSTOMER_QUESTIONS.length >= 55, `Mindestens 55 Fragen im Katalog (ist ${CUSTOMER_QUESTIONS.length})`);
assert.ok(stats.matchTotal >= 45, 'Mindestens 45 Matching-Fragen');

const ids = new Set(CUSTOMER_QUESTIONS.map((q) => q.id));
assert.equal(ids.size, CUSTOMER_QUESTIONS.length, 'Eindeutige Frage-IDs');

for (const q of CUSTOMER_QUESTIONS) {
  assert.ok(q.label, `${q.id}: label fehlt`);
  assert.ok(q.exampleQueries?.length >= 1, `${q.id}: exampleQueries fehlt`);
  assert.ok(['full', 'partial', 'missing'].includes(q.status), `${q.id}: status`);
}

// Tagungs-Top-Fragen müssen im Katalog sein
const mustHave = [
  'fuel_elektro', 'budget_leasing', 'range_min_300', 'towbar', 'tow_2000kg',
  'seats_7', 'isofix_3', 'trunk_large', 'heat_pump', 'camera_360',
  'panorama_roof', 'power_tailgate', 'length_max', 'height_max_garage',
];
for (const id of mustHave) {
  assert.ok(ids.has(id), `Pflicht-Frage fehlt: ${id}`);
}

// Parser erkennt kombinierte Demo-Anfragen
const parsed = parseSearchIntent('5 sitze bis 4 Meter länge');
assert.equal(parsed.seatsMin, 5);
assert.equal(parsed.maxLengthMm, 4000);

const parsedTow = parseSearchIntent('Hybrid 2 Tonnen Anhängelast');
assert.ok(parsedTow.towCapacityKg >= 2000 || parsedTow.features.includes('towbar'));

console.log('Kundenfragen-Katalog:');
console.log(`  Gesamt:        ${stats.total}`);
console.log(`  Fahrzeug-Match: ${stats.matchTotal} (${stats.full} voll, ${stats.partial} teil, ${stats.missing} offen)`);
console.log(`  Abdeckung:     ${stats.matchCoveragePercent}% voll beantwortbar`);
console.log(`  Händler-FAQ:   ${stats.beratungTotal}`);
console.log(`  High-Prio-Lücken: ${stats.highPriorityGaps.join(', ') || 'keine'}`);
console.log(`  Demo-Queries:  ${TOP_DEMO_SEARCH_QUERIES.length}`);
console.log('customerQuestionCatalog.test.js: ok');
