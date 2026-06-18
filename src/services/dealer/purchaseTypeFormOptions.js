/**
 * Auswahloptionen für den Zahlungsart-Schritt.
 */

export const LEASING_TERM_OPTIONS = [
  { id: 'term_24', months: 24, label: '24 Monate' },
  { id: 'term_36', months: 36, label: '36 Monate' },
  { id: 'term_48', months: 48, label: '48 Monate' },
];

export const LEASING_MILEAGE_OPTIONS = [
  { id: 'km_10000', value: 10000, label: '10.000 km' },
  { id: 'km_15000', value: 15000, label: '15.000 km' },
  { id: 'km_20000', value: 20000, label: '20.000 km' },
  { id: 'km_25000', value: 25000, label: '25.000 km' },
];

export const DOWN_PAYMENT_OPTIONS = [
  { id: 'dp_0', label: 'Keine Anzahlung' },
  { id: 'dp_1000', label: '1.000 €' },
  { id: 'dp_3000', label: '3.000 €' },
  { id: 'dp_5000', label: '5.000 €' },
  { id: 'dp_open', label: 'Noch offen' },
];

export const FINANCE_TERM_OPTIONS = LEASING_TERM_OPTIONS;

export const FINANCE_BALLOON_OPTIONS = [
  { id: 'balloon_yes', value: 'yes', label: 'Ja' },
  { id: 'balloon_no', value: 'no', label: 'Nein' },
  { id: 'balloon_unknown', value: 'unknown', label: 'Weiß ich nicht' },
];

export const CASH_TIMING_OPTIONS = [
  { id: 'timing_now', label: 'Sofort / in Kürze' },
  { id: 'timing_1m', label: 'Innerhalb 1 Monat' },
  { id: 'timing_3m', label: 'In den nächsten 3 Monaten' },
  { id: 'timing_open', label: 'Noch unklar' },
];

export const TRADE_IN_OPTIONS = [
  { id: 'trade_yes', value: 'yes', label: 'Ja' },
  { id: 'trade_maybe', value: 'maybe', label: 'Vielleicht' },
  { id: 'trade_no', value: 'no', label: 'Nein' },
];

export const PAYMENT_TYPE_CARDS = [
  { id: 'leasing', label: 'Leasing', subline: 'monatlich fahren' },
  { id: 'finance', label: 'Finanzierung', subline: 'in Raten kaufen' },
  { id: 'cash', label: 'Barzahlung', subline: 'einmalig kaufen' },
];

export function getPaymentStepCta(purchaseType) {
  if (purchaseType === 'leasing') return 'Leasingrate berechnen';
  if (purchaseType === 'finance') return 'Finanzierung berechnen';
  if (purchaseType === 'cash') return 'Kaufangebot anfragen';
  return 'Weiter';
}

/**
 * @param {import('./purchaseTypeOptions.js').PurchaseTypeId} purchaseType
 * @param {object} details
 */
export function mapPurchaseDetailsToBudget(purchaseType, details = {}) {
  if (purchaseType === 'cash') {
    return {
      maxMonthlyRate: null,
      label: details.wantsBindingOffer ? 'Verbindliches Kaufangebot gewünscht' : 'Kaufangebot',
      purchaseDetails: details,
    };
  }
  if (purchaseType === 'finance' && details.desiredRate) {
    return {
      maxMonthlyRate: Number(details.desiredRate) || null,
      label: details.desiredRate ? `Wunschrate ${details.desiredRate} €` : null,
      purchaseDetails: details,
    };
  }
  return {
    maxMonthlyRate: null,
    label: purchaseType === 'leasing' ? 'Leasing-Konditionen hinterlegt' : null,
    purchaseDetails: details,
  };
}
