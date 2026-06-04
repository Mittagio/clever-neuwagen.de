/**
 * End-to-End: Suche → CleverQuote → Händler-Brief (EV3 MVP)
 */
import assert from 'node:assert/strict';
import { computeCleverQuote } from '../services/cleverQuote/cleverQuoteService.js';
import { buildRecommendation, createInitialDetailSelection } from '../services/configuration/featureResolver.js';
import { buildDealerInquiryBrief, formatDealerInquiryBriefLines } from './dealerInquiryBrief.js';
import { pickStreamUpgrade } from './vehicleDetailStream.js';

const vehicle = {
  brand: 'Kia',
  model: 'EV3',
  powertrain: 'elektro',
  bodyType: 'suv',
  slug: 'kia-ev3-earth',
  title: 'Kia EV3 Earth',
  monthlyRate: 318,
};

const vehicleCatalog = { brand: 'Kia', model: 'EV3', vehicle, dealerConditions: null };

const selection = createInitialDetailSelection(vehicle, {
  trim: 'earth',
  trimName: 'Earth',
  selectedFeatures: ['heated_seats', 'rear_camera', 'heat_pump', 'camera_360'],
});

const recommendation = buildRecommendation(selection, vehicleCatalog);
assert.equal(recommendation.requiredPackages[0]?.id, 'ev3-technik');

const cleverQuote = computeCleverQuote({
  vehicle,
  trimId: 'earth',
  wishes: { features: selection.selectedFeatures, budget: { maxMonthlyRate: 400 } },
});
assert.ok(cleverQuote.percent >= 70, 'CleverQuote mit Registry-Wünschen berechenbar');
assert.ok(
  cleverQuote.items.some((i) => i.status === 'fulfilled'),
  'Mindestens ein Wunsch erfüllt',
);
assert.ok(
  cleverQuote.items.some((i) => i.status === 'package'),
  '360° als Paket-Wunsch sichtbar',
);

const streamUpgrade = pickStreamUpgrade(recommendation);
assert.equal(streamUpgrade.kind, 'package');

const brief = buildDealerInquiryBrief({
  contactName: 'Anna Test',
  displayTitle: 'Kia EV3 Earth',
  displayPrice: { label: '318 €', subtitle: '48 Monate · 10.000 km' },
  detailSelection: selection,
  recommendationResult: recommendation,
  cleverQuote,
  wishes: { budget: { maxMonthlyRate: 400 }, features: selection.selectedFeatures },
  dealer: { name: 'Autohaus Trinkle', distanceKm: 8 },
  vehicle,
  pricing: { payment: 'leasing', termMonths: 48, mileagePerYear: 10000, amount: 318 },
});

assert.equal(brief.packageRecommendation, 'Technik Paket');
assert.ok(brief.wishes.fulfilled.length >= 2);
assert.ok(brief.cleverQuoteSnapshot?.optional?.length >= 1 || brief.packageRecommendation);
assert.equal(brief.dealer.name, 'Autohaus Trinkle');

const lines = formatDealerInquiryBriefLines(brief);
assert.ok(lines.some((l) => l.includes('Technik Paket')));
assert.ok(lines.some((l) => l.includes('CleverQuote')));

console.log('inquiryFlowMvp.test.js: ok');
