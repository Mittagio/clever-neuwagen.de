import { formatCurrency } from './marketplaceService.js';

/** Ebene 1: Modellname ohne Trim (kein „Earth“, „GT-Line“). */
export function getMatchDisplayTitle(match) {
  if (!match) return '';
  const v = match.vehicle ?? {};
  const base = match.model ?? `${v.brand ?? ''} ${v.model ?? ''}`.trim();
  return base.replace(/\s+(Earth|Air|Vision|GT-Line|GT Line|Style|Design|Premium)\s*$/i, '').trim() || base;
}

export function formatMatchPrimaryPrice(match, paymentMode = 'leasing') {
  const v = match?.vehicle ?? {};
  if (paymentMode === 'cash' && v.cashPrice != null) {
    return { label: formatCurrency(v.cashPrice), suffix: '' };
  }
  const rate = match?.bestOffer?.monthlyRate ?? v.monthlyRate;
  if (rate == null) return { label: '—', suffix: '' };
  return { label: formatCurrency(rate), suffix: '/Monat' };
}

export function formatMatchCashAlt(match) {
  const v = match?.vehicle ?? {};
  if (v.cashPrice == null) return null;
  return formatCurrency(v.cashPrice);
}

/** Prominente Lieferzeit für Ebene 1 (Sprint 37). */
export function formatMatchDeliveryLabel(match) {
  const v = match?.vehicle ?? {};
  const t = match?.bestOffer?.deliveryTime ?? v.deliveryTime ?? '';
  const availability = match?.bestOffer?.availability ?? v.availability;
  if (availability === 'sofort' || /sofort/i.test(t)) return 'Sofort verfügbar';
  if (!t) return null;
  const cleaned = t.replace(/^Lieferzeit\s*/i, '').trim();
  if (/^\d/.test(cleaned)) return `Lieferbar in ${cleaned}`;
  if (/woche|tag|monat/i.test(cleaned)) return `Lieferbar in ${cleaned}`;
  return cleaned || t;
}

export function formatDealerDeliveryLabel(dealer, vehicle) {
  const t = dealer?.deliveryTime ?? vehicle?.deliveryTime ?? '';
  const availability = dealer?.availability ?? vehicle?.availability;
  if (availability === 'sofort' || /sofort/i.test(t)) return 'Sofort verfügbar';
  if (!t) return null;
  const cleaned = t.replace(/^Lieferzeit\s*/i, '').trim();
  if (/^\d/.test(cleaned) || /woche|tag|monat/i.test(cleaned)) return `Lieferbar in ${cleaned}`;
  return cleaned;
}
