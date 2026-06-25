/**
 * Kunden-Suchergebnisse – unverbindliche Einschätzung, kein CleverQuote-Score.
 */
import { buildCleverQuoteWishLines } from './dealerAdvisorPresentation.js';

export const CUSTOMER_SEARCH_COPY = {
  needAnswerKicker: 'Clever Einschätzung',
  wishesRecognizedTitle: 'Das haben wir verstanden:',
  singleResultHeadline: 'Das könnte zu Ihrem Wunsch passen',
  multiResultHeadline: 'Diese Modelle könnten passen',
  multiResultHeadlineAlt: 'Mehrere Richtungen möglich',
  assessmentTitle: 'Clever Einschätzung',
  assessmentVerdict: 'Könnte gut passen',
  matchesLabel: 'Passt zu Ihren Angaben:',
  disclaimer: 'Die finale Ausstattung und Verfügbarkeit prüft Ihr Autohaus.',
  compareTitle: 'Welche Richtung passt besser?',
  recommendWhyTitle: 'Passt zu Ihren Angaben',
  recommendFallback: 'Könnte zu Ihrer Suche passen.',
  heroKicker: 'Clever Einschätzung',
  searchSectionTitle: 'Das könnte passen',
};

/**
 * @param {number} visible
 * @param {number} total
 */
export function buildCustomerSearchSectionMeta(visible, total) {
  if (total <= 1) return 'Eine passende Richtung';
  return `${visible} von ${total} Richtungen`;
}

/**
 * @param {number} modelCount
 */
export function buildCustomerSearchResultsHeadline(modelCount) {
  if (modelCount <= 1) return CUSTOMER_SEARCH_COPY.singleResultHeadline;
  if (modelCount === 2) return CUSTOMER_SEARCH_COPY.multiResultHeadline;
  return CUSTOMER_SEARCH_COPY.multiResultHeadlineAlt;
}

/**
 * @param {string} shortTitle
 */
export function buildCustomerModelCtaLabel(shortTitle) {
  const name = String(shortTitle ?? 'Modell').trim();
  return `${name} genauer ansehen`;
}

/**
 * @param {object} [quote]
 * @param {object[]} [checks]
 * @param {string[]} [wishLines]
 * @param {number} [max]
 */
export function buildCustomerFitLines(quote, checks = [], wishLines = [], max = 4) {
  return buildCleverQuoteWishLines(quote, checks, wishLines, max);
}

/**
 * @param {number|null|undefined} percent
 */
export function shouldShowCustomerTechnicalScore(percent) {
  return false;
}
