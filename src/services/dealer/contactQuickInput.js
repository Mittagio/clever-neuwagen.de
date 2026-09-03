/** Schnelle Telefon-/E-Mail-Eingabe – weniger Tippen (wie Capture-Flow). */

export const CONTACT_EMAIL_DOMAINS = Object.freeze([
  '@gmail.com',
  '@googlemail.com',
  '@web.de',
  '@gmx.de',
  '@t-online.de',
  '@icloud.com',
  '@outlook.de',
  '@hotmail.de',
  '@yahoo.de',
]);

/** Häufige DE-Handynetze – Tap setzt/ersetzt Vorwahl. */
export const CONTACT_PHONE_PREFIXES = Object.freeze([
  '0151', '0152', '0157', '01570', '01575',
  '0160', '0162', '0163',
  '0170', '0171', '0172', '0173', '0174', '0175', '0176', '0177', '0178', '0179',
]);

export function applyEmailDomain(value, domain) {
  const trimmed = String(value || '').trim();
  const local = trimmed.includes('@')
    ? trimmed.split('@')[0].trim()
    : trimmed;
  if (!local) return '';
  return `${local}${domain}`;
}

/**
 * Prefix setzen: ersetzt führende 0… Vorwahl oder hängt an, wenn leer/kurz.
 */
export function applyPhonePrefix(value, prefix) {
  const digits = String(value || '').replace(/[^\d+]/g, '');
  const cleanPrefix = String(prefix || '').replace(/\D/g, '');
  if (!cleanPrefix) return String(value || '');

  if (!digits || digits === '+' || /^0{0,1}$/.test(digits)) {
    return cleanPrefix;
  }

  // Bereits gleiche Vorwahl → unverändert lassen (oder nur formatieren)
  const national = digits.startsWith('+49')
    ? `0${digits.slice(3)}`
    : digits.startsWith('49') && !digits.startsWith('0')
      ? `0${digits.slice(2)}`
      : digits;

  if (national.startsWith(cleanPrefix)) {
    return national;
  }

  // Vorwahl älterer Art (015…/016…/017…) ersetzen, Rest behalten
  const rest = national.replace(/^0?(15\d{1,3}|16\d{1,2}|17\d)/, '');
  if (rest && rest !== national) {
    return `${cleanPrefix}${rest}`;
  }

  // Sonst Prefix voranstellen (Rest behalten, führende 0 strippen)
  const body = national.replace(/^0+/, '');
  return `${cleanPrefix}${body}`;
}
