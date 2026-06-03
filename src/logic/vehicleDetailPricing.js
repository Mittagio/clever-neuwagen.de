import { formatCurrency } from './marketplaceService.js';
import { adjustRateForDownPayment, adjustFinanceRate } from './vehicleDetailConfig.js';
import { getFeatureLabel } from '../data/features/featureCatalog.js';

const PAYMENT_LABELS = {
  leasing: 'Leasing',
  finance: 'Finanzierung',
  cash: 'Kaufpreis',
};

/** Einheitliche Zahlungsart (leasing | finance | cash) */
export function normalizePaymentMode(payment) {
  if (payment === 'financing') return 'finance';
  if (payment === 'kaufpreis') return 'cash';
  return payment ?? 'leasing';
}

/** Betrag aus priceConfiguration-Ergebnis passend zur Zahlungsart */
export function getAmountFromEnginePricing(enginePricing, payment) {
  if (!enginePricing) return 0;
  const mode = normalizePaymentMode(payment);
  if (mode === 'cash') return enginePricing.cashPrice ?? 0;
  if (mode === 'finance') {
    return enginePricing.financeRate ?? enginePricing.primaryRate ?? 0;
  }
  return enginePricing.leasingRate ?? enginePricing.primaryRate ?? 0;
}

/** Primäre Anzeige: 318 €/Monat oder 38.065 € */
export function formatDisplayPrice(amount, payment) {
  const mode = normalizePaymentMode(payment);
  if (mode === 'cash') return formatCurrency(amount);
  return `${formatCurrency(amount)}/Monat`;
}

export function buildDisplayPriceFromEngine(enginePricing, payment) {
  const amount = getAmountFromEnginePricing(enginePricing, payment);
  return {
    payment: normalizePaymentMode(payment),
    amount,
    priceLabel: formatDisplayPrice(amount, payment),
  };
}

export function buildPaymentSubtitleFull({
  payment,
  termMonths = 48,
  mileagePerYear = 10000,
  downPayment = 0,
  financeDown = 0,
  financeBalloon = 0,
}) {
  const mode = normalizePaymentMode(payment);
  if (mode === 'cash') return 'Kaufpreis';
  if (mode === 'finance') {
    const down = financeDown > 0
      ? `${formatCurrency(financeDown)} Anzahlung`
      : '0 € Anzahlung';
    const balloon = financeBalloon > 0
      ? ` · Schlussrate ${formatCurrency(financeBalloon)}`
      : '';
    return `Finanzierung · ${termMonths} Monate · ${down}${balloon}`;
  }
  const km = Number(mileagePerYear).toLocaleString('de-DE');
  const down = downPayment > 0
    ? `${formatCurrency(downPayment)} Anzahlung`
    : '0 € Anzahlung';
  return `Leasing · ${termMonths} Monate · ${km} km · ${down}`;
}

/** Delta passend zur Zahlungsart */
export function getPriceDeltaLabel({
  payment,
  previousAmount,
  newAmount,
  reason,
}) {
  const mode = normalizePaymentMode(payment);
  const prev = Number(previousAmount) || 0;
  const next = Number(newAmount) || 0;
  const delta = next - prev;
  if (!delta) return null;
  const sign = delta > 0 ? '+' : '−';
  const suffix = reason ? ` ${reason}` : '';
  if (mode === 'cash') {
    return `${sign}${formatCurrency(Math.abs(delta))}${suffix}`;
  }
  return `${sign}${formatCurrency(Math.abs(delta))}/Monat${suffix}`;
}

export function getPackagePriceImpactLabel({
  payment,
  rateDelta = 0,
  priceGross = 0,
  packageName,
}) {
  const mode = normalizePaymentMode(payment);
  const ctx = packageName ? `durch ${packageName}` : '';
  if (mode === 'cash' && priceGross > 0) {
    return `+${formatCurrency(priceGross)}${ctx ? ` ${ctx}` : ''}`;
  }
  if (rateDelta > 0) {
    return `+${formatCurrency(rateDelta)}/Monat${ctx ? ` ${ctx}` : ''}`;
  }
  return null;
}

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

  const mode = normalizePaymentMode(payment);
  const paymentLabel = PAYMENT_LABELS[mode] ?? mode;
  const priceLabel = formatDisplayPrice(amount, mode);

  const subtitle = buildPaymentSubtitleFull({
    payment: mode,
    termMonths,
    mileagePerYear,
    downPayment,
    financeDown,
    financeBalloon,
  });

  return {
    payment: mode,
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
