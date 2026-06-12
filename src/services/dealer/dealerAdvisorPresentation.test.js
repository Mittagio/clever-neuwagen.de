import assert from 'node:assert/strict';
import {
  resolveDealerModelTitle,
  buildDealerFulfillmentHeadline,
  buildDealerBenefitBullets,
  buildDealerWishCheckLines,
  buildDealerRecommendationLead,
  buildDealerMissingWishSummary,
} from './dealerAdvisorPresentation.js';

assert.equal(
  resolveDealerModelTitle({ modelLineKey: 'ev9', label: 'EV9 GT' }),
  'Kia EV9',
);

assert.equal(
  buildDealerFulfillmentHeadline({ matched: 5, scorableTotal: 5, total: 5 }),
  'Erfüllt alle 5 Wünsche',
);

assert.equal(
  buildDealerFulfillmentHeadline({ matched: 4, scorableTotal: 5, total: 5 }),
  '4 von 5 Wünschen erfüllt',
);

const bullets = buildDealerBenefitBullets([
  { id: 'seats', status: 'fulfilled', label: '7 Sitze' },
  { id: 'range_km', status: 'fulfilled', label: 'Reichweite ≥ 400 km', detail: '505 km' },
  { id: 'height_mm', status: 'fulfilled', label: 'Garage bis 2 m' },
  { id: 'towbar', status: 'fulfilled', label: 'Anhängerkupplung' },
]);
assert.ok(bullets.some((b) => /Familie/.test(b)));
assert.ok(bullets.some((b) => /505/.test(b)));
assert.ok(bullets.some((b) => /Garage/.test(b)));

const missing = buildDealerMissingWishSummary([
  { id: 'range_km', status: 'missing', label: 'Reichweite ≥ 400 km' },
]);
assert.deepEqual(missing, ['Reichweite ≥ 400 km']);

const wishLines = buildDealerWishCheckLines([
  { id: 'seats', status: 'fulfilled', label: '7 Sitze' },
  { id: 'height_mm', status: 'fulfilled', label: 'Garage bis 2 m' },
]);
assert.ok(wishLines.includes('7 Sitze'));
assert.ok(wishLines.includes('passt in Ihre Garage'));

const lead = buildDealerRecommendationLead(
  {
    modelLineKey: 'ev9',
    modelQuote: { matched: 5, scorableTotal: 5, total: 5 },
    modelChecks: [{ id: 'tow_braked', status: 'fulfilled', detail: '2500 kg' }],
    primaryMatch: { vehicle: { towCapacityKg: 2500 } },
  },
  [
    { modelLineKey: 'ev5', primaryMatch: { vehicle: { towCapacityKg: 1800 } }, modelChecks: [] },
  ],
);
assert.match(lead, /Clever empfiehlt Kia EV9/);
assert.match(lead, /alle 5 Ihrer Wünsche/);

console.log('dealerAdvisorPresentation.test.js: ok');
