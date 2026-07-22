/**
 * Tool 4 – Erlaubte Angebotsparameter aus dem bestehenden System.
 */
import { NEED_CONSULTATION_QUESTIONS } from '../../../consultation/consultationQuestions.js';

export const SUPPORTED_PURCHASE_TYPES = [
  { value: 'leasing', label: 'Leasing' },
  { value: 'finance', label: 'Finanzierung' },
  { value: 'cash', label: 'Kauf' },
];

export const SUPPORTED_ANNUAL_MILEAGE = [
  5000, 10000, 15000, 20000, 25000, 30000,
];

export const SUPPORTED_DURATION_MONTHS = [
  24, 36, 48, 60,
];

export const SUPPORTED_NEEDED_BY = [
  { value: 'asap', label: 'möglichst bald' },
  { value: '8weeks', label: 'innerhalb der nächsten 8 Wochen' },
  { value: '1-3months', label: 'in 1–3 Monaten' },
  { value: 'later', label: 'mein aktuelles Fahrzeug läuft später aus' },
  { value: 'open', label: 'noch offen' },
];

/**
 * @param {{ field?: string|null }} [params]
 */
export function getSupportedOfferParameters(params = {}) {
  const timingQuestion = NEED_CONSULTATION_QUESTIONS.find((q) => q.id === 'vehicleNeedTiming');

  const all = {
    purchaseType: SUPPORTED_PURCHASE_TYPES,
    annualMileage: SUPPORTED_ANNUAL_MILEAGE.map((km) => ({
      value: String(km),
      label: `${km.toLocaleString('de-DE')} km/Jahr`,
    })),
    durationMonths: SUPPORTED_DURATION_MONTHS.map((months) => ({
      value: String(months),
      label: `${months} Monate`,
    })),
    downPayment: {
      min: 0,
      step: 500,
      note: '0 € ist ein gültiger Wert.',
    },
    neededBy: SUPPORTED_NEEDED_BY.length
      ? SUPPORTED_NEEDED_BY
      : (timingQuestion?.options ?? []).map((o) => ({ value: o.id, label: o.label })),
  };

  const field = params.field ?? null;
  if (field && all[field]) {
    return { field, options: all[field] };
  }

  return { parameters: all };
}

export function isAllowedOfferOption(field, value) {
  const params = getSupportedOfferParameters({ field });
  const options = params.options;
  if (field === 'downPayment') {
    const num = Number(value);
    return Number.isFinite(num) && num >= 0;
  }
  if (field === 'annualMileage' || field === 'durationMonths') {
    const num = Number(value);
    const allowed = field === 'annualMileage' ? SUPPORTED_ANNUAL_MILEAGE : SUPPORTED_DURATION_MONTHS;
    return allowed.includes(num);
  }
  if (field === 'purchaseType') {
    return SUPPORTED_PURCHASE_TYPES.some((o) => o.value === value);
  }
  if (field === 'neededBy') {
    return SUPPORTED_NEEDED_BY.some((o) => o.value === value)
      || ['asap', '8weeks', 'later', 'open', '1-3months'].includes(String(value));
  }
  if (Array.isArray(options)) {
    return options.some((o) => String(o.value) === String(value));
  }
  return false;
}

/**
 * Entfernt ungültige Offer-Optionen (z. B. downPayment: "other"),
 * statt den ganzen AI-Turn an Grounding scheitern zu lassen.
 * @param {object} turnResult
 */
export function sanitizeCleverTurnOfferOptions(turnResult) {
  if (!turnResult || turnResult.nextAction?.type !== 'ask_offer_parameter') {
    return turnResult;
  }

  const field = turnResult.nextAction.targetField;
  const rawOptions = turnResult.nextAction.options ?? [];
  const options = rawOptions.filter((opt) => isAllowedOfferOption(field, opt?.value));

  if (options.length === rawOptions.length) {
    return turnResult;
  }

  // Keine gültigen Chips → Freitext-Frage behalten oder Anschluss streichen
  if (options.length === 0) {
    if (turnResult.nextAction.question) {
      return {
        ...turnResult,
        nextAction: {
          ...turnResult.nextAction,
          options: [],
        },
      };
    }
    return {
      ...turnResult,
      nextAction: {
        type: 'none',
        targetField: null,
        question: null,
        options: [],
        reason: null,
      },
    };
  }

  return {
    ...turnResult,
    nextAction: {
      ...turnResult.nextAction,
      options,
    },
  };
}
