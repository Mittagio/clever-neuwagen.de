/**
 * NeedProfile-Patch – nur erlaubte Felder aus dem bestehenden Profil.
 */

const ALLOWED_TOP_LEVEL = new Set([
  'persons',
  'children',
  'dog',
  'fuel',
  'bodyType',
  'drive',
  'transmission',
  'towbar',
  'equipmentWishes',
  'modelHint',
  'selectedModelKey',
  'annualKm',
  'leaseDurationMonths',
  'longDistance',
  'chargingAtHome',
  'towing',
  'towCapacityKg',
  'driverHint',
  'design',
  'technology',
  'usage',
  'priorities',
  'trimHint',
  'colorHint',
  'timelineLabel',
  'allradNeed',
  'comfortVsSpace',
  'hybridPowertrain',
]);

const ALLOWED_BUDGET_KEYS = new Set([
  'paymentType',
  'maxMonthlyRate',
  'maxPrice',
  'downPayment',
  'paymentExplicit',
  'monthlyBudgetStyle',
]);

function isPlainObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function sanitizeArray(value) {
  if (!Array.isArray(value)) return null;
  return value.filter((item) => item != null && item !== '');
}

/**
 * @param {object} patch
 * @returns {{ patch: object, rejectedKeys: string[] }}
 */
export function sanitizeNeedProfilePatch(patch = {}) {
  if (!isPlainObject(patch)) {
    return { patch: {}, rejectedKeys: ['__invalid__'] };
  }

  const rejectedKeys = [];
  const out = {};

  for (const [key, value] of Object.entries(patch)) {
    if (key === 'budget') {
      if (!isPlainObject(value)) {
        rejectedKeys.push(key);
        continue;
      }
      const budget = {};
      for (const [bKey, bVal] of Object.entries(value)) {
        if (!ALLOWED_BUDGET_KEYS.has(bKey)) {
          rejectedKeys.push(`budget.${bKey}`);
          continue;
        }
        if (bVal === undefined) continue;
        budget[bKey] = bVal;
      }
      if (Object.keys(budget).length) out.budget = budget;
      continue;
    }

    if (!ALLOWED_TOP_LEVEL.has(key)) {
      rejectedKeys.push(key);
      continue;
    }

    if (value === undefined) continue;

    if (['equipmentWishes', 'design', 'technology', 'usage', 'priorities'].includes(key)) {
      const arr = sanitizeArray(value);
      if (arr) out[key] = arr;
      continue;
    }

    out[key] = value;
  }

  return { patch: out, rejectedKeys };
}

/**
 * @param {object} needProfile
 * @param {object} patch
 */
export function applyNeedProfilePatch(needProfile = {}, patch = {}) {
  const { patch: safePatch } = sanitizeNeedProfilePatch(patch);
  if (!Object.keys(safePatch).length) {
    return { ...needProfile, updatedAt: new Date().toISOString() };
  }

  let next = { ...needProfile };

  if (safePatch.budget) {
    next.budget = { ...(next.budget ?? {}), ...safePatch.budget };
  }

  for (const [key, value] of Object.entries(safePatch)) {
    if (key === 'budget') continue;
    next[key] = value;
  }

  next.updatedAt = new Date().toISOString();
  return next;
}

export function buildNeedProfilePatchJsonSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      persons: { type: ['integer', 'null'] },
      children: { type: ['integer', 'boolean', 'null'] },
      dog: { type: 'boolean' },
      fuel: { type: ['string', 'null'] },
      bodyType: { type: ['string', 'null'] },
      drive: { type: ['string', 'null'] },
      transmission: { type: ['string', 'null'] },
      towbar: { type: 'boolean' },
      equipmentWishes: { type: 'array', items: { type: 'string' } },
      modelHint: { type: ['string', 'null'] },
      selectedModelKey: { type: ['string', 'null'] },
      annualKm: { type: ['integer', 'null'] },
      leaseDurationMonths: { type: ['integer', 'null'] },
      longDistance: { type: ['string', 'null'] },
      chargingAtHome: { type: ['string', 'null'] },
      towing: { type: ['string', 'null'] },
      towCapacityKg: { type: ['integer', 'null'] },
      driverHint: { type: ['string', 'null'] },
      design: { type: 'array', items: { type: 'string' } },
      technology: { type: 'array', items: { type: 'string' } },
      usage: { type: 'array', items: { type: 'string' } },
      priorities: { type: 'array', items: { type: 'string' } },
      trimHint: { type: ['string', 'null'] },
      colorHint: { type: ['string', 'null'] },
      timelineLabel: { type: ['string', 'null'] },
      allradNeed: { type: ['string', 'null'] },
      comfortVsSpace: { type: ['string', 'null'] },
      hybridPowertrain: { type: ['string', 'null'] },
      budget: {
        type: 'object',
        additionalProperties: false,
        properties: {
          paymentType: { type: ['string', 'null'] },
          maxMonthlyRate: { type: ['number', 'null'] },
          maxPrice: { type: ['number', 'null'] },
          downPayment: { type: ['number', 'null'] },
          paymentExplicit: { type: 'boolean' },
          monthlyBudgetStyle: { type: ['string', 'null'] },
        },
      },
    },
  };
}
