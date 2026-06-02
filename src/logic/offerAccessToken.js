const TOKEN_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const OFFER_TOKEN_TTL_DAYS = 14;

export function generateOfferAccessToken() {
  return Array.from({ length: 10 }, () =>
    TOKEN_CHARS[Math.floor(Math.random() * TOKEN_CHARS.length)],
  ).join('');
}

export function buildOfferMagicUrl(code, token) {
  const path = `/angebot/${encodeURIComponent(code)}?token=${encodeURIComponent(token)}`;
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${path}`;
  }
  return `https://clever-neuwagen.de${path}`;
}

export function buildMeinBereichOfferPath(code) {
  return `/mein-bereich/angebote/${encodeURIComponent(code)}`;
}

export function isOfferTokenExpired(dialog) {
  if (!dialog?.tokenExpiresAt) return false;
  return Date.now() > new Date(dialog.tokenExpiresAt).getTime();
}

export function validateOfferAccessToken(offer, token) {
  const dialog = offer?.dialog;
  if (!dialog?.accessToken || !token) {
    return { valid: false, code: 'MISSING_TOKEN', message: 'Kein Zugangslink' };
  }
  if (dialog.accessToken.toUpperCase() !== token.trim().toUpperCase()) {
    return { valid: false, code: 'INVALID_TOKEN', message: 'Link ungültig' };
  }
  if (isOfferTokenExpired(dialog)) {
    return { valid: false, code: 'EXPIRED_TOKEN', message: 'Link abgelaufen – bitte Verkäufer kontaktieren' };
  }
  return { valid: true };
}

export function buildCounterOfferEmailBody(offer, magicUrl, counterOffer) {
  const name = offer.customer?.name?.trim() || 'Kunde';
  const pricing = counterOffer?.pricing ?? offer.pricing;
  const rate = pricing.leasingRate ?? pricing.rate;
  return [
    `Guten Tag ${name},`,
    '',
    `wir haben Ihr Angebot für den ${offer.vehicle.label} angepasst:`,
    '',
    `Neue Rate: ${rate != null ? `${rate.toLocaleString('de-DE')} €/Monat` : '—'}`,
    pricing.termMonths ? `Laufzeit: ${pricing.termMonths} Monate` : null,
    pricing.mileagePerYear ? `Kilometer: ${pricing.mileagePerYear.toLocaleString('de-DE')} km/Jahr` : null,
    counterOffer?.accessoriesNote ? `Zubehör: ${counterOffer.accessoriesNote}` : null,
    counterOffer?.dealerMessage ? `\n${counterOffer.dealerMessage}` : null,
    '',
    'Angebot ansehen und digital antworten:',
    magicUrl,
    '',
    `Angebotsnummer: ${offer.code}`,
    '',
    'Freundliche Grüße',
    offer.dealer.contact?.name ?? offer.dealer.name,
  ].filter(Boolean).join('\n');
}

export function buildCounterOfferMailto(offer, magicUrl, counterOffer) {
  const subject = `Ihr aktualisiertes Angebot ${offer.code} – ${offer.vehicle.label}`;
  const body = buildCounterOfferEmailBody(offer, magicUrl, counterOffer);
  const to = offer.customer?.email ?? '';
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
