/** Budget / Rate vs. Kaufpreis – abhängig von Angebotsart */

export const DEALER_AI_MONTHLY_BUDGET_VALUES = [250, 300, 400, 500, 600];

export const DEALER_AI_PURCHASE_BUDGET_VALUES = [20000, 25000, 30000, 35000, 40000, 45000, 50000];

export function isCashPaymentType(paymentType) {
  return paymentType === 'cash';
}

export function isMonthlyBudgetPaymentType(paymentType) {
  return paymentType === 'leasing'
    || paymentType === 'financing'
    || paymentType === 'threeWayFinancing';
}

export function paymentTypeFromChipId(chipId) {
  const map = {
    pay_cash: 'cash',
    pay_leasing: 'leasing',
    pay_financing: 'financing',
    pay_three_way: 'threeWayFinancing',
    pay_open: 'unknown',
  };
  return map[chipId] ?? null;
}

export function paymentTypeFromChipIds(chipIds = []) {
  for (const id of chipIds) {
    const pt = paymentTypeFromChipId(id);
    if (pt && pt !== 'unknown') return pt;
  }
  return 'unknown';
}

export function getBudgetFieldLabel(paymentType) {
  if (isCashPaymentType(paymentType)) return 'Budget / Kaufpreis';
  if (isMonthlyBudgetPaymentType(paymentType)) return 'Budget / Rate';
  return 'Budget / Rate';
}

export function getCleverBudgetSectionLabel(paymentType) {
  if (isCashPaymentType(paymentType)) return 'Budget / Kaufpreis';
  if (isMonthlyBudgetPaymentType(paymentType)) return 'Budget / Rate';
  return 'Budget';
}

export function getCleverBudgetStepTitle(paymentType) {
  if (isCashPaymentType(paymentType)) return 'Welcher Kaufpreis passt?';
  if (isMonthlyBudgetPaymentType(paymentType)) return 'Welche Monatsrate passt?';
  return 'Welches Budget hat der Kunde?';
}

export function getCleverBudgetStepHint(paymentType) {
  if (isCashPaymentType(paymentType)) return 'Kaufpreis oder Budgetrahmen für den Barkauf.';
  if (isMonthlyBudgetPaymentType(paymentType)) return 'Monatliche Rate für Leasing oder Finanzierung.';
  return 'Monatliche Rate oder Kaufpreis – je nach Angebotsart.';
}

function formatEuro(amount) {
  return `${amount.toLocaleString('de-DE')} €`;
}

export function buildMonthlyBudgetChips() {
  return [
    ...DEALER_AI_MONTHLY_BUDGET_VALUES.map((amount) => ({
      id: `budget_${amount}`,
      label: `bis ${amount} €`,
      emoji: '💰',
      budgetMax: amount,
    })),
    { id: 'budget_open', label: 'Noch offen', emoji: '❓', skip: true },
  ];
}

export function buildPurchaseBudgetChips() {
  return [
    ...DEALER_AI_PURCHASE_BUDGET_VALUES.map((amount) => ({
      id: `price_${amount}`,
      label: `bis ${formatEuro(amount)}`,
      emoji: '💰',
      purchaseMax: amount,
    })),
    { id: 'budget_open', label: 'Noch offen', emoji: '❓', skip: true },
  ];
}

export function getBudgetChipsForPaymentType(paymentType) {
  if (isCashPaymentType(paymentType)) return buildPurchaseBudgetChips();
  return buildMonthlyBudgetChips();
}

export function formatBudgetDisplay(fields = {}) {
  const pt = fields.paymentType ?? 'unknown';
  if (isCashPaymentType(pt)) {
    if (fields.desiredPrice) return `bis ${fields.desiredPrice.toLocaleString('de-DE')} €`;
    return 'offen';
  }
  if (fields.desiredRate) return `bis ${fields.desiredRate} €/Monat`;
  return 'offen';
}

export function formatBudgetSummaryForWish(fields = {}) {
  const pt = fields.paymentType ?? 'unknown';
  if (isCashPaymentType(pt) && fields.desiredPrice) {
    return `bis ${fields.desiredPrice.toLocaleString('de-DE')} €`;
  }
  if (fields.desiredRate) return `bis ${fields.desiredRate} €/Monat`;
  return null;
}
