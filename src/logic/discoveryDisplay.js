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
