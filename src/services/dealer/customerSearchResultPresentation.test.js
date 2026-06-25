/**
 * Kunden-Suchergebnis – Wording & CTAs
 */
import assert from 'node:assert/strict';
import {
  buildCustomerModelCtaLabel,
  buildCustomerSearchResultsHeadline,
  CUSTOMER_SEARCH_COPY,
  shouldShowCustomerTechnicalScore,
} from './customerSearchResultPresentation.js';

assert.equal(buildCustomerSearchResultsHeadline(1), 'Das könnte zu Ihrem Wunsch passen');
assert.equal(buildCustomerSearchResultsHeadline(2), 'Diese Modelle könnten passen');
assert.equal(buildCustomerSearchResultsHeadline(5), 'Mehrere Richtungen möglich');

assert.equal(buildCustomerModelCtaLabel('Niro'), 'Niro genauer ansehen');
assert.equal(shouldShowCustomerTechnicalScore(100), false);
assert.ok(!CUSTOMER_SEARCH_COPY.assessmentTitle.includes('Quote'));
assert.ok(!CUSTOMER_SEARCH_COPY.assessmentVerdict.toLowerCase().includes('garantiert'));

console.log('customerSearchResultPresentation.test.js: ok');
