/**
 * NeedProfile – digitale DNA des Kunden (alle Welten lesen, Welt 1 schreibt primär).
 */

export const NEED_FIELD_CONFIDENCE = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
};

export const NEED_PRIORITY_KEYS = [
  'budget',
  'family',
  'range',
  'charging',
  'towing',
  'space',
  'design',
  'technology',
  'usage',
];

/**
 * @returns {import('./needProfileTypes.js').NeedProfile}
 */
export function createEmptyNeedProfile(initialText = '') {
  const now = new Date().toISOString();
  return {
    version: 1,
    rawMessages: initialText ? [initialText.trim()] : [],
    initialWish: initialText.trim(),
    persons: null,
    children: null,
    dog: false,
    budget: {
      paymentType: null,
      maxMonthlyRate: null,
      maxPrice: null,
    },
    fuel: null,
    bodyType: null,
    drive: null,
    transmission: null,
    towbar: false,
    equipmentWishes: [],
    modelHint: null,
    annualKm: null,
    longDistance: null,
    chargingAtHome: null,
    towing: null,
    design: [],
    technology: [],
    usage: [],
    priorities: [],
    openQuestions: [],
    understoodLabels: [],
    missingFields: [],
    confidence: 0,
    selectedModelKey: null,
    world: 'need_consultation',
    updatedAt: now,
    createdAt: now,
  };
}
