import { formatCurrency } from './marketplaceService.js';
import { adjustRateForDownPayment, adjustFinanceRate } from './vehicleDetailConfig.js';
import { getFeatureLabel } from '../data/features/featureCatalog.js';

const PAYMENT_LABELS = {
  leasing: 'Leasing',
  finance: 'Finanzierung',
  cash: 'Kaufpreis',
};

/**
 * Zentraler Anzeige-Preis für Hero, Sticky, Rechner und Anfrage
 * @param {object} params
 */
export function computeDetailPricing({
  payment = 'leasing',
  termMonths = 48,
  mileagePerYear = 10000,
  downPayment = 0,
  financeDown = 0,
  financeBalloon = 0,
  basePricing = null,
  activeDealer = null,
  vehicle = null,
}) {
  const cashPrice = basePricing?.cashPrice
    ?? activeDealer?.cashPrice
    ?? vehicle?.cashPrice
    ?? 0;
  let leasingRate = basePricing?.leasingRate
    ?? activeDealer?.monthlyRate
    ?? vehicle?.monthlyRate
    ?? 0;
  let financeRate = basePricing?.financeRate
    ?? activeDealer?.financeRate
    ?? Math.round(leasingRate * 1.08);
  leasingRate = adjustRateForDownPayment(leasingRate, downPayment, termMonths);
  financeRate = adjustFinanceRate(financeRate, financeDown, financeBalloon);

  const amount = payment === 'cash'
    ? cashPrice
    : payment === 'finance'
      ? financeRate
      : leasingRate;

  const paymentLabel = PAYMENT_LABELS[payment] ?? payment;
  const priceLabel = payment === 'cash'
    ? formatCurrency(amount)
    : `${formatCurrency(amount)}/Monat`;

  const subtitle = buildPriceSubtitle({ payment, termMonths, mileagePerYear });

  return {
    payment,
    amount,
    priceLabel,
    paymentLabel,
    subtitle,
    leasingRate,
    financeRate,
    cashPrice,
    termMonths,
    mileagePerYear,
    downPayment,
    financeDown,
    financeBalloon,
  };
}

export function buildPriceSubtitle({ payment, termMonths, mileagePerYear }) {
  if (payment === 'cash') return 'Kaufpreis';
  const km = Number(mileagePerYear).toLocaleString('de-DE');
  if (payment === 'finance') return `Finanzierung · ${termMonths} Monate`;
  return `Leasing · ${termMonths} Monate · ${km} km`;
}

/** Kompakte Zeile in der geschlossenen Tool-Karte „Preis & Zahlungsart“ */
export function buildPaymentTeaserLine(pricing) {
  if (!pricing) return '';
  if (pricing.payment === 'cash') return 'Kaufpreis';
  if (pricing.payment === 'finance') {
    return `Finanzierung · ${pricing.termMonths} Monate`;
  }
  const km = Number(pricing.mileagePerYear).toLocaleString('de-DE');
  const down = pricing.downPayment > 0
    ? `${formatCurrency(pricing.downPayment)} Anzahlung`
    : '0 € Anzahlung';
  return `Leasing · ${pricing.termMonths} Monate · ${km} km · ${down}`;
}

/** Kompakte Zeile für Aktionskarte „Rate anpassen“ */
export function buildPaymentActionDetailLine(pricing) {
  if (!pricing) return '';
  if (pricing.payment === 'cash') return 'Einmalzahlung';
  if (pricing.payment === 'finance') return `${pricing.termMonths} Monate`;
  const km = Number(pricing.mileagePerYear).toLocaleString('de-DE');
  const down = pricing.downPayment > 0
    ? `${formatCurrency(pricing.downPayment)} Anzahlung`
    : '0 € Anzahlung';
  return `${pricing.termMonths} Monate · ${km} km · ${down}`;
}

/**
 * Daten für spätere Anfrage-Zusammenfassung
 */
export function buildInquirySummary({
  displayTitle,
  dealerName,
  distanceKm,
  pricing,
  colorName,
  wishLabels = [],
  packageLabels = [],
  serialLabels = [],
  bonusLabels = [],
}) {
  const lines = [
    displayTitle,
    `${dealerName} · ${distanceKm} km`,
    `${pricing.priceLabel} · ${pricing.paymentLabel}`,
  ];
  if (pricing.payment === 'leasing') {
    lines.push(`${pricing.termMonths} Monate · ${Number(pricing.mileagePerYear).toLocaleString('de-DE')} km`);
    if (pricing.downPayment > 0) {
      lines.push(`${formatCurrency(pricing.downPayment)} Anzahlung`);
    } else {
      lines.push('0 € Anzahlung');
    }
  } else if (pricing.payment === 'finance') {
    lines.push(`${pricing.termMonths} Monate Finanzierung`);
  }
  if (colorName) lines.push(`Farbe: ${colorName}`);
  if (wishLabels.length) {
    lines.push('Gewünschte Ausstattung:');
    wishLabels.forEach((w) => lines.push(`· ${w}`));
  }
  if (packageLabels.length) {
    lines.push('Vom System gefunden:');
    packageLabels.forEach((p) => lines.push(`· ${p}`));
  }
  if (serialLabels.length) {
    lines.push('Bereits serienmäßig enthalten:');
    serialLabels.forEach((s) => lines.push(`· ${s}`));
  }
  if (bonusLabels.length) {
    lines.push('Zusätzlich durch Paket enthalten:');
    bonusLabels.forEach((b) => lines.push(`· ${b}`));
  }
  return {
    lines,
    pricing,
    displayTitle,
    dealerName,
    distanceKm,
    wishLabels,
    packageLabels,
    serialLabels,
    bonusLabels,
  };
}

export function getDetailSelectionState({
  payment,
  termMonths,
  mileagePerYear,
  downPayment,
  financeDown,
  financeBalloon,
  colorId,
  trimId,
  trimName,
  packageIds,
  accessoryIds,
  wishIds,
}) {
  return {
    payment,
    durationMonths: termMonths,
    mileagePerYear,
    downPayment,
    financeDown,
    financeBalloon,
    color: colorId,
    trim: trimId,
    trimName,
    packages: packageIds,
    accessories: accessoryIds,
    wishes: wishIds,
  };
}

export function wishIdsToLabels(wishIds = []) {
  return wishIds.map((id) => getFeatureLabel(id) ?? id).filter(Boolean);
}
