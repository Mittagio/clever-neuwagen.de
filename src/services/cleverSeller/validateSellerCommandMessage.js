/**
 * Seller-Arbeitsanweisungen dürfen nicht in Kundennachrichten landen.
 */

/**
 * @param {string} body
 * @returns {boolean}
 */
export function containsSellerCommandInMessage(body = '') {
  const text = String(body || '').trim();
  if (!text) return false;
  if (/^schreib(?:e|en)?\b/i.test(text)) return true;
  if (/^erstell(?:e|en)?\s+(?:dem\s+kunden|herrn?\s+|frau\s+)/i.test(text)) return true;
  if (/\berstell(?:e|en)?\s+dem\s+kunden\b/i.test(text)) return true;
  if (/\berstell(?:e|en)?\s+(?:herrn?\s+|frau\s+)?\w+\s+ein\s+angebot\b/i.test(text)) return true;
  if (/\bbezugnehmend auf\b[\s\S]{0,80}\berstell\b/i.test(text)) return true;
  if (/\bmach(?:e|en)?\s+(?:ihm|ihr|dem\s+kunden)\b/i.test(text)) return true;
  if (/\bangebot\s+erstellen\b/i.test(text)) return true;
  if (/\bmit\s+\d{1,2}\s*%\s*rabatt\s+machen\b/i.test(text)) return true;
  if (/\bschreib(?:e|en)?\s+(?:ihm|ihr|dem\s+kunden)\s+ein\s+angebot\b/i.test(text)) return true;
  if (/\bschreib(?:e|en)?\s+(?:herrn?\s+|frau\s+)?\w+/i.test(text)
    && /\b(dass|das|wegen)\b/i.test(text)) {
    return true;
  }
  return false;
}

/**
 * @param {string} body
 * @returns {{ ok: boolean, reason?: string }}
 */
export function validateCustomerMessageNotSellerCommand(body = '') {
  if (containsSellerCommandInMessage(body)) {
    return { ok: false, reason: 'seller_command_in_message' };
  }
  return { ok: true };
}
