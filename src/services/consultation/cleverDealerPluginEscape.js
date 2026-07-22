/**
 * Clever Dealer Plugin – Escape-Kanäle (WhatsApp / Telefon).
 * Nur verifizierte Händlerkontakte. Keine technischen IDs / Scores.
 */

/**
 * @param {string} [phone]
 * @returns {string|null}
 */
export function digitsOnlyPhone(phone) {
  const digits = String(phone ?? '').replace(/\D/g, '');
  return digits.length >= 6 ? digits : null;
}

/**
 * @param {object} dealerConditions
 * @returns {{ phone: string|null, phoneHref: string|null, whatsappHref: string|null }}
 */
export function resolveDealerEscapeContacts(dealerConditions = {}) {
  const phone = dealerConditions?.contact?.phone
    || dealerConditions?.phone
    || null;
  const digits = digitsOnlyPhone(phone);
  const waDigits = digits
    ? (digits.startsWith('0') ? `49${digits.slice(1)}` : digits)
    : null;

  return {
    phone: phone ? String(phone).trim() : null,
    phoneHref: digits ? `tel:${digits}` : null,
    whatsappHref: waDigits ? `https://wa.me/${waDigits}` : null,
  };
}

/**
 * Kompakter WhatsApp-Text nur aus validierten Kundenwünschen (Notizzettel).
 * @param {{ notepadLabels?: string[], dealerName?: string }} opts
 */
export function buildWhatsAppWishMessage({ notepadLabels = [], dealerName = '' } = {}) {
  const wishes = [...new Set((notepadLabels ?? []).map((l) => String(l).trim()).filter(Boolean))];
  const intro = 'Hallo, ich informiere mich gerade auf Ihrer Website.';
  if (!wishes.length) {
    return `${intro}\n\nIch freue mich über eine Rückmeldung.`;
  }
  const lines = wishes.map((w) => `– ${w}`).join('\n');
  const dealerBit = dealerName ? '' : '';
  void dealerBit;
  return `${intro}\n\nMeine bisherigen Wünsche:\n${lines}\n\nIch freue mich über eine Rückmeldung.`;
}

/**
 * @param {string} whatsappHref
 * @param {string} [message]
 */
export function buildWhatsAppUrlWithMessage(whatsappHref, message = '') {
  if (!whatsappHref) return null;
  const text = String(message ?? '').trim();
  if (!text) return whatsappHref;
  const sep = whatsappHref.includes('?') ? '&' : '?';
  return `${whatsappHref}${sep}text=${encodeURIComponent(text)}`;
}
