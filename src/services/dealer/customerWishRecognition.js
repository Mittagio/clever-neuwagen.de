/**
 * Bedürfnis-Erkennung aus Freitext – Verkäufer-Sprache, nicht nur Feature-IDs.
 */
import { buildCustomerStatedChips } from '../search/chipConfig.js';
import { parseSearchIntent } from '../search/searchIntentParser.js';

/** @typedef {'budget'|'family'|'transport'|'antrieb'|'verfuegbarkeit'|'komfort'|'service'|'nutzung'} WishCategory */

/** @type {Record<string, WishCategory>} */
const CHIP_CATEGORY = {
  maxRate: 'budget',
  maxPrice: 'budget',
  payment: 'budget',
  mileagePerYear: 'nutzung',
  termMonths: 'nutzung',
  seats_7: 'family',
  seatsMin: 'family',
  isofixRearMin: 'family',
  tow_braked: 'transport',
  towbar: 'transport',
  tow_1500: 'transport',
  tow_2000: 'transport',
  trunkLMin: 'transport',
  maxLengthMm: 'transport',
  maxHeightMm: 'transport',
  fuel: 'antrieb',
  fuel_alternatives: 'antrieb',
  availability: 'verfuegbarkeit',
  existing_lead: 'service',
  charging_home: 'nutzung',
  fast_charge: 'nutzung',
  charge_800v: 'nutzung',
  finance_zero: 'budget',
  heat_pump: 'komfort',
  isofix: 'family',
  camera_360: 'komfort',
  heated_seats: 'komfort',
  rear_camera: 'komfort',
  blind_spot: 'komfort',
  panorama_roof: 'komfort',
  automatic: 'komfort',
};

function formatTowLabel(kg) {
  if (!kg) return null;
  const tons = kg / 1000;
  const label = Number.isInteger(tons) ? String(tons) : tons.toFixed(1).replace('.', ',');
  return `Anhängelast ≥ ${label} t`;
}

function fuelAlternativesLabel(alternatives = []) {
  const labels = alternatives.map((fuel) => {
    if (fuel === 'elektro' || fuel === 'electric') return 'Elektro';
    if (fuel === 'hybrid') return 'Hybrid';
    if (fuel === 'plugin-hybrid' || fuel === 'plugin_hybrid') return 'Plug-in-Hybrid';
    if (fuel === 'diesel') return 'Diesel';
    if (fuel === 'verbrenner' || fuel === 'combustion') return 'Benzin';
    return fuel;
  });
  const unique = [...new Set(labels)];
  if (unique.length >= 2) return `${unique.join(' oder ')}`;
  return unique[0] ?? null;
}

/**
 * @param {object} params
 * @param {object} [params.intent]
 * @param {object} [params.filters]
 * @param {object} [params.profile]
 */
export function buildRecognizedCustomerWishes({ intent = null, filters = {}, profile = null } = {}) {
  const parsed = intent ?? parseSearchIntent(filters.query ?? '');
  const chips = buildCustomerStatedChips(filters, { rawQuery: parsed.rawQuery });
  /** @type {Map<string, { id: string, label: string, category: WishCategory }>} */
  const wishes = new Map();

  for (const chip of chips) {
    const category = CHIP_CATEGORY[chip.id] ?? CHIP_CATEGORY[chip.featureId] ?? 'nutzung';
    wishes.set(chip.id, {
      id: chip.id,
      label: chip.label,
      category,
    });
  }

  const towKg = parsed.towCapacityKg ?? filters.towCapacityKg ?? profile?.towCapacityKg ?? null;
  if (towKg && !wishes.has('tow_braked')) {
    wishes.set('tow_braked', {
      id: 'tow_braked',
      label: formatTowLabel(towKg),
      category: 'transport',
    });
  }

  const fuelAlts = parsed.fuelAlternatives ?? filters.fuelAlternatives ?? profile?.fuelAlternatives ?? null;
  if (fuelAlts?.length >= 2) {
    wishes.set('fuel_alternatives', {
      id: 'fuel_alternatives',
      label: fuelAlternativesLabel(fuelAlts),
      category: 'antrieb',
    });
    wishes.delete('fuel');
  }

  if (parsed.existingLead) {
    wishes.set('existing_lead', {
      id: 'existing_lead',
      label: 'Bereits Anfrage gestellt',
      category: 'service',
    });
  }

  if (parsed.familyHint && !wishes.has('seats_7') && !wishes.has('seatsMin')) {
    wishes.set('family_hint', {
      id: 'family_hint',
      label: parsed.familyHint,
      category: 'family',
    });
  }

  if (parsed.dogBoxHint && !wishes.has('trunkLMin')) {
    wishes.set('dog_box', {
      id: 'dog_box',
      label: parsed.dogBoxHint,
      category: 'transport',
    });
  }

  if (parsed.chargingHomeHint) {
    wishes.set('charging_home', {
      id: 'charging_home',
      label: parsed.chargingHomeHint,
      category: 'nutzung',
    });
  }

  if (parsed.financeZeroPercent) {
    wishes.set('finance_zero', {
      id: 'finance_zero',
      label: '0 % Finanzierung',
      category: 'budget',
    });
  }

  if (parsed.features?.includes('fast_charge')) {
    wishes.set('fast_charge', {
      id: 'fast_charge',
      label: 'Schnellladen / CCS',
      category: 'nutzung',
    });
  }

  if (parsed.features?.includes('charge_800v')) {
    wishes.set('charge_800v', {
      id: 'charge_800v',
      label: '800V Schnellladen',
      category: 'nutzung',
    });
  }

  return [...wishes.values()];
}

/**
 * @param {object[]} wishes
 * @param {object} [options]
 * @param {boolean} [options.existingLeadMentioned]
 */
export function hasNeedBasedSearch(wishes = [], options = {}) {
  if (options.existingLeadMentioned && wishes.length >= 1) return true;
  return wishes.length >= 2;
}

/**
 * @param {object[]} wishes
 * @param {object} [options]
 */
export function shouldShowNeedAnswer(wishes = [], options = {}) {
  return hasNeedBasedSearch(wishes, options);
}
