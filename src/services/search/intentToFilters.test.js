/**
 * intentToFilters – Operator-Precedence & bodyType
 * node src/services/search/intentToFilters.test.js
 */

import assert from 'node:assert/strict';
import { parseSearchIntent } from './searchIntentParser.js';
import { intentToMarketplaceFilters, toAdvisorMarketplaceFilters } from './intentToFilters.js';

const kleinwagen = intentToMarketplaceFilters(parseSearchIntent('kleinwagen bis 20.000 €'));
assert.equal(kleinwagen.type, 'kleinwagen', 'Kleinwagen darf nicht zu Elektro werden');
assert.equal(kleinwagen.maxPrice, 20000);

const kleinesAuto = intentToMarketplaceFilters(parseSearchIntent('kleines auto'));
assert.equal(kleinesAuto.type, 'kleinwagen', 'kleines auto → Kleinwagen');

const advisorFeatures = toAdvisorMarketplaceFilters(
  intentToMarketplaceFilters(parseSearchIntent('elektro sitzheizung wärmepumpe 360 kamera')),
);
assert.equal(advisorFeatures.features.length, 0, 'Ausstattung nicht hart filtern');
assert.equal(advisorFeatures.fuel, 'elektro', 'Elektro-Antrieb bleibt hart');

console.log('intentToFilters tests OK');
