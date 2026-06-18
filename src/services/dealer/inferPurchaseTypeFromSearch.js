/**
 * Kaufart aus Suche / Profil ableiten (Leasing, Finanzierung, Barzahlung).
 */

/** @typedef {'cash'|'finance'|'leasing'} KnownPurchaseType */

/**
 * @param {string} [text]
 * @returns {KnownPurchaseType|null}
 */
export function parsePurchaseTypeFromText(text = '') {
  const lower = text.toLowerCase();
  if (/\bleasing\b/i.test(lower)) return 'leasing';
  if (/\bfinanzier/i.test(lower)) return 'finance';
  if (/\b(bar|barkauf|sofortkauf|einmalig kaufen|kaufen bar)\b/i.test(lower)) return 'cash';
  if (/\bkauf\b/i.test(lower) && !/finanzier/i.test(lower) && !/leasing/i.test(lower)) return 'cash';
  return null;
}

/**
 * @param {object} [params]
 * @param {string} [params.submittedQuery]
 * @param {object} [params.searchProfile]
 * @param {object} [params.searchFilters]
 * @returns {KnownPurchaseType|null}
 */
export function inferKnownPurchaseType({
  submittedQuery = '',
  searchProfile = null,
  searchFilters = null,
} = {}) {
  const fromFilters = searchFilters?.payment;
  if (fromFilters === 'leasing' || fromFilters === 'finance' || fromFilters === 'cash') {
    return fromFilters;
  }

  const fromProfile = searchProfile?.budget?.type ?? searchProfile?.paymentType;
  if (fromProfile === 'leasing' || fromProfile === 'finance' || fromProfile === 'cash') {
    return fromProfile;
  }

  return parsePurchaseTypeFromText(submittedQuery);
}
