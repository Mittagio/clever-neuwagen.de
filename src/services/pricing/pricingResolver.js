import {
  computeDetailPricing,
  normalizePaymentMode,
  getPriceDeltaLabel,
  buildPaymentTeaserLine,
  buildInquirySummary,
} from '../../logic/vehicleDetailPricing.js';

const PAYMENT_LABELS = {
  leasing: 'Leasing',
  finance: 'Finanzierung',
  financing: 'Finanzierung',
  cash: 'Kaufpreis',
};

/** leasing | finance | cash (intern) */
export function normalizePaymentModeInput(mode) {
  if (mode === 'financing') return 'finance';
  return normalizePaymentMode(mode ?? 'leasing');
}

/**
 * @param {object} selection detailSelection
 * @param {object} offer activeDealer / pricing context
 * @param {object} [context] basePricing, vehicle
 */
export function getDisplayPrice(selection, offer, context = {}) {
  const paymentMode = normalizePaymentModeInput(selection.paymentMode ?? selection.payment);
  const pricing = computeDetailPricing({
    payment: paymentMode,
    termMonths: selection.termMonths ?? 48,
    mileagePerYear: selection.mileagePerYear ?? 10000,
    downPayment: selection.downPayment ?? 0,
    financeDown: selection.financeDown ?? 0,
    financeBalloon: selection.financeBalloon ?? 0,
    basePricing: context.basePricing ?? null,
    activeDealer: offer ?? null,
    vehicle: context.vehicle ?? null,
  });

  return {
    value: pricing.amount,
    label: pricing.priceLabel,
    type: paymentMode === 'cash' ? 'cash' : 'monthly',
    subtitle: pricing.subtitle,
    paymentMode,
    raw: pricing,
  };
}

export function getPricingSubtitle(selection) {
  const price = getDisplayPrice(selection, null, {});
  if (selection?.displayPrice?.raw) {
    return selection.displayPrice.raw.subtitle;
  }
  return price.subtitle;
}

export function getDeltaPrice(oldSelection, newSelection, offer, context = {}) {
  const prev = getDisplayPrice(oldSelection, offer, context);
  const next = getDisplayPrice(newSelection, offer, context);
  const deltaLabel = getPriceDeltaLabel({
    payment: normalizePaymentModeInput(newSelection.paymentMode ?? newSelection.payment),
    previousAmount: prev.value,
    newAmount: next.value,
  });
  return {
    previous: prev,
    next,
    delta: (next.value ?? 0) - (prev.value ?? 0),
    deltaLabel,
  };
}

export function getPaymentLabel(paymentMode) {
  const mode = normalizePaymentModeInput(paymentMode);
  return PAYMENT_LABELS[mode] ?? mode;
}

export function getPaymentTeaserLine(displayPrice) {
  return buildPaymentTeaserLine(displayPrice?.raw ?? displayPrice);
}

export { buildInquirySummary, computeDetailPricing };
