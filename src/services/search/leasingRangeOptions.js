/**
 * Kanonische Leasing-Spannen: Laufzeit & Jahreskilometer
 */

export const TERM_MONTHS_MIN = 6;
export const TERM_MONTHS_MAX = 84;
/** Laufzeit-Auswahl in 6-Monats-Schritten (6, 12, 18, 24, …) */
export const TERM_MONTHS_STEP = 6;

/** Häufige Laufzeiten für Schnell-Chips (Ergebnisseite) */
export const CUSTOMER_TERM_CHIP_VALUES = [24, 36, 48, 60];

export function normalizeCustomerTermMonths(term) {
  const n = Number(term);
  if (buildTermMonthValues().includes(n)) return n;
  if (CUSTOMER_TERM_CHIP_VALUES.includes(n)) return n;
  return 48;
}

export function shouldShowTermChip(term) {
  const n = Number(term);
  return buildTermMonthValues().includes(n) || CUSTOMER_TERM_CHIP_VALUES.includes(n);
}

export const MILEAGE_KM_MIN = 5000;
export const MILEAGE_KM_MAX = 50000;
export const MILEAGE_KM_STEP = 2500;

/** Rohwerte für Chip-Editor, Magic Lens & Dropdowns */
export function buildTermMonthValues() {
  const values = [];
  for (let m = TERM_MONTHS_MIN; m <= TERM_MONTHS_MAX; m += TERM_MONTHS_STEP) {
    values.push(m);
  }
  return values;
}

export function buildMileageKmValues() {
  const values = [];
  for (let km = MILEAGE_KM_MIN; km <= MILEAGE_KM_MAX; km += MILEAGE_KM_STEP) {
    values.push(km);
  }
  return values;
}

export function buildTermSelectOptions() {
  return buildTermMonthValues().map((value) => ({
    label: `${value} Monate`,
    value,
  }));
}

/** Kilometer-Chips auf der Ergebnisseite */
export const CUSTOMER_MILEAGE_CHIP_VALUES = [5000, 10000, 15000, 20000, 25000, 30000];

export function buildMileageChipSelectOptions() {
  return CUSTOMER_MILEAGE_CHIP_VALUES.map((value) => ({
    label: `${value.toLocaleString('de-DE')} km/Jahr`,
    value,
  }));
}

export function buildDurationChipSelectOptions() {
  return CUSTOMER_TERM_CHIP_VALUES.map((value) => ({
    label: `${value} Monate`,
    value,
  }));
}

export function buildMileageSelectOptions({ perYear = false } = {}) {
  return buildMileageKmValues().map((value) => ({
    label: perYear
      ? `${value.toLocaleString('de-DE')} km/Jahr`
      : `${value.toLocaleString('de-DE')} km`,
    value,
  }));
}
