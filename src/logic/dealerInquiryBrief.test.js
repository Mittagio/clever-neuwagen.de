import assert from 'node:assert/strict';
import {
  buildDealerInquiryBrief,
  formatDealerInquiryBriefLines,
  getLeadBriefPreview,
} from './dealerInquiryBrief.js';

const brief = buildDealerInquiryBrief({
  contactName: 'Herr Müller',
  displayTitle: 'Kia EV3 Earth',
  displayPrice: { label: '318 €', subtitle: '48 Monate · 10.000 km' },
  detailSelection: {
    paymentMode: 'leasing',
    termMonths: 48,
    mileagePerYear: 10000,
    downPayment: 0,
    selectedFeatures: ['heated_seats'],
  },
  recommendationResult: {
    requestedFeatures: [{ id: 'heated_seats', label: 'Sitzheizung' }],
  },
  cleverQuote: {
    percent: 96,
    matched: 4,
    scorableTotal: 5,
    items: [
      { id: 'heated_seats', label: 'Sitzheizung', status: 'fulfilled' },
      { id: 'camera_rear', label: 'Rückfahrkamera', status: 'fulfilled' },
      { id: 'heat_pump', label: 'Wärmepumpe', status: 'package' },
    ],
  },
  wishes: { budget: { maxMonthlyRate: 350 } },
  wishAlternatives: [
    { title: 'Kia EV3 Air', matched: 4, total: 5, priceLabel: '298 €', slug: 'ev3-air' },
  ],
  dealer: { name: 'Autohaus Trinkle', distanceKm: 12 },
  vehicle: { slug: 'kia-ev3-earth', title: 'Kia EV3 Earth', brand: 'Kia' },
  pricing: { payment: 'leasing', termMonths: 48, mileagePerYear: 10000, downPayment: 0, amount: 318 },
});

assert.equal(brief.customerName, 'Herr Müller');
assert.equal(brief.cleverQuotePercent, 96);
assert.equal(brief.budget.maxMonthly, 350);
assert.ok(brief.wishes.fulfilled.includes('Sitzheizung'));
assert.equal(brief.alternatives.length, 1);
assert.equal(brief.variant.priceLabel, '318 €');

const lines = formatDealerInquiryBriefLines(brief);
assert.ok(lines.some((l) => l.includes('96 % CleverQuote')));
assert.ok(lines.some((l) => l.includes('Herr Müller')));

const preview = getLeadBriefPreview(brief);
assert.ok(preview.includes('96 %'));
assert.ok(preview.includes('350'));

console.log('dealerInquiryBrief.test.js: ok');

const cashBrief = buildDealerInquiryBrief({
  displayTitle: 'Kia EV3 Earth',
  displayPrice: { label: '38.065 €', subtitle: 'Kaufpreis' },
  detailSelection: { paymentMode: 'cash', selectedFeatures: [] },
  cleverQuote: { percent: 92, matched: 3, scorableTotal: 4, items: [] },
  vehicle: { slug: 'kia-ev3-earth' },
  pricing: { payment: 'cash', amount: 38065 },
});

assert.equal(cashBrief.variant.payment, 'cash');
assert.ok(cashBrief.variant.lines.some((l) => /Kaufpreis/.test(l)));
assert.equal(cashBrief.variant.priceLabel, '38.065 €');
assert.ok(!cashBrief.variant.priceLabel.includes('/Monat'));

const cashLines = formatDealerInquiryBriefLines(cashBrief);
assert.ok(cashLines.some((l) => l.includes('Kaufpreis')));

console.log('dealerInquiryBrief.test.js cash: ok');
