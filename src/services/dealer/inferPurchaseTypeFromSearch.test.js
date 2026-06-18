import assert from 'node:assert/strict';
import {
  inferKnownPurchaseType,
  parsePurchaseTypeFromText,
} from './inferPurchaseTypeFromSearch.js';

assert.equal(parsePurchaseTypeFromText('Kia EV2 Leasing 250 Euro'), 'leasing');
assert.equal(parsePurchaseTypeFromText('Kia EV2 finanzieren'), 'finance');
assert.equal(parsePurchaseTypeFromText('Kia EV2 kaufen bar'), 'cash');
assert.equal(inferKnownPurchaseType({ submittedQuery: 'Kia EV2 Leasing 250 Euro' }), 'leasing');
assert.equal(inferKnownPurchaseType({ searchFilters: { payment: 'finance' } }), 'finance');
assert.equal(inferKnownPurchaseType({ submittedQuery: 'Kia EV3 Earth' }), null);

console.log('inferPurchaseTypeFromSearch.test.js: ok');
