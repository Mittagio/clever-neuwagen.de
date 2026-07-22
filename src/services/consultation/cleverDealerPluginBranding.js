/**
 * Clever Dealer Plugin – Händlerbranding aus bestehender Conditions-Struktur.
 * Keine hardcodierten Pilotwerte als Pflicht.
 */

import { resolveDealerEscapeContacts } from './cleverDealerPluginEscape.js';

/**
 * @param {object} dealerConditions
 * @param {string} [fallbackName]
 */
export function buildPluginDealerBranding(dealerConditions = {}, fallbackName = 'Autohaus') {
  const name = dealerConditions?.dealerName?.trim()
    || dealerConditions?.name?.trim()
    || fallbackName;
  const contactName = dealerConditions?.contact?.name?.trim() || null;
  const contactRole = dealerConditions?.contact?.role?.trim() || 'Verkauf';
  const logoUrl = dealerConditions?.logoUrl
    || dealerConditions?.logo
    || dealerConditions?.branding?.logoUrl
    || null;
  const accent = dealerConditions?.branding?.accentColor
    || dealerConditions?.accentColor
    || null;
  const hoursToday = dealerConditions?.openingHours?.todayLabel
    || dealerConditions?.hours?.todayLabel
    || dealerConditions?.contact?.hoursToday
    || null;
  const hoursNote = dealerConditions?.openingHours?.note
    || dealerConditions?.hours?.note
    || null;

  const escapes = resolveDealerEscapeContacts(dealerConditions);

  return {
    dealerName: name,
    logoUrl: logoUrl ? String(logoUrl) : null,
    accentColor: accent ? String(accent) : null,
    contactName,
    contactRole,
    trustLine: contactName
      ? `Ihr Ansprechpartner: ${contactName} · ${contactRole}`
      : 'Unser Verkaufsteam übernimmt Ihre Wünsche.',
    hoursToday: hoursToday ? String(hoursToday) : null,
    hoursNote: hoursNote ? String(hoursNote) : null,
    phone: escapes.phone,
    phoneHref: escapes.phoneHref,
    whatsappHref: escapes.whatsappHref,
    cleverSupportLine: 'Unterstützt durch Clever',
  };
}
