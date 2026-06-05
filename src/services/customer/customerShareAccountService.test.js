/**
 * node src/services/customer/customerShareAccountService.test.js
 */

import assert from 'node:assert/strict';
import {
  buildShareComparisonAccountEntry,
  buildShareInquiryAccountEntry,
  mergeShareSessionsIntoComparisons,
  mergeShareSessionsIntoInquiries,
  addLinkedShareToken,
} from './customerShareAccountService.js';
import { listAdvisorShareSessionsByEmail } from '../../../server/advisorShareStore.js';

const sampleSession = {
  token: 'TEST-ACCOUNT-001',
  createdAt: Date.now(),
  dealerName: 'Autohaus Trinkle',
  sellerName: 'Berater',
  customer: { name: 'Anna', email: 'anna@example.com' },
  inquiryConfirmed: true,
  inquiryConfirmedAt: Date.now(),
  modelLineGroups: [
    {
      modelLineKey: 'ev3',
      label: 'Kia EV3',
      primaryMatch: { slug: 'kia-ev3-air', title: 'Kia EV3', trimLabel: 'Air', monthlyRate: 299 },
    },
  ],
  matches: [],
};

const comparison = buildShareComparisonAccountEntry(sampleSession);
assert.equal(comparison.shareToken, 'TEST-ACCOUNT-001');
assert.ok(comparison.items.length >= 1, 'Vergleichs-Items');
assert.equal(comparison.status, 'anfrage_bestaetigt');

const inquiry = buildShareInquiryAccountEntry(sampleSession);
assert.equal(inquiry.status, 'Anfrage bestätigt');
assert.ok(inquiry.shareUrl.includes('TEST-ACCOUNT-001'));

const merged = mergeShareSessionsIntoComparisons([], [sampleSession]);
assert.equal(merged.length, 1);

const inquiries = mergeShareSessionsIntoInquiries([], [sampleSession]);
assert.equal(inquiries.length, 1);

const withToken = addLinkedShareToken({ linkedShareTokens: [] }, 'abc-123');
assert.ok(withToken.linkedShareTokens.includes('ABC-123'));

const listed = listAdvisorShareSessionsByEmail('anna@example.com');
assert.ok(Array.isArray(listed));

console.log('customerShareAccountService tests OK');
