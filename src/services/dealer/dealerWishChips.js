/**
 * Händler-Schnellchips – strukturierte Filter, Mehrfachauswahl (kein Freitext-Anhängen).
 */

import { LARGE_TRUNK_MIN_L } from '../cleverData/vehicleDimensions.js';

/** @typedef {object} DealerWishChip
 * @property {string} id
 * @property {string} label
 * @property {object} filters – Marketplace-Filter-Patch
 */

/** @type {DealerWishChip[]} */
export const DEALER_WISH_CHIPS = [
  {
    id: 'fuel_elektro_300',
    label: 'Elektro bis 300 €',
    filters: { fuel: 'elektro', type: 'elektro', maxRate: 300, features: ['elektro'] },
  },
  {
    id: 'range_400',
    label: 'Reichweite über 400 km',
    filters: { fuel: 'elektro', type: 'elektro', rangeKmMin: 400, features: ['reichweite', 'elektro'] },
  },
  {
    id: 'towbar',
    label: 'Anhängerkupplung',
    filters: { features: ['towbar'] },
  },
  {
    id: 'seats_7',
    label: '7-Sitzer',
    filters: { seatsMin: 7, features: ['seats_7'] },
  },
  {
    id: 'isofix_3',
    label: '3 Isofix',
    filters: { isofixRearMin: 3 },
  },
  {
    id: 'tow_2000',
    label: '2 t Anhängelast',
    filters: { towCapacityKg: 2000, features: ['towbar'] },
  },
  {
    id: 'length_4m',
    label: 'Bis 4 m lang',
    filters: { maxLengthMm: 4000, seatsMin: 5 },
  },
  {
    id: 'garage_2m',
    label: 'Garage 2 m',
    filters: { maxHeightMm: 2000 },
  },
  {
    id: 'large_trunk',
    label: 'Großer Kofferraum',
    filters: { trunkLMin: LARGE_TRUNK_MIN_L, features: ['large_trunk'] },
  },
  {
    id: 'heat_pump',
    label: 'Wärmepumpe',
    filters: { fuel: 'elektro', type: 'elektro', features: ['heat_pump', 'elektro'] },
  },
  {
    id: 'availability_sofort',
    label: 'Sofort verfügbar',
    filters: { availability: 'sofort', fuel: 'elektro', type: 'elektro', features: ['elektro'] },
  },
  {
    id: 'model_ev3_gt',
    label: 'EV3 GT-Line',
    filters: {
      brand: 'Kia',
      model: 'EV3',
      trim: 'GT-Line',
      modelExplicit: true,
      fuel: 'elektro',
      type: 'elektro',
    },
  },
];

const CHIP_BY_ID = Object.fromEntries(DEALER_WISH_CHIPS.map((c) => [c.id, c]));

export function getDealerWishChip(chipId) {
  return CHIP_BY_ID[chipId] ?? null;
}

function unionFeatures(a = [], b = []) {
  return [...new Set([...a, ...b])];
}

/** Mehrere Chip-Patches zu einem Filter-Objekt zusammenführen (UND-Verknüpfung). */
export function mergeDealerChipFilters(chipIds = []) {
  /** @type {Record<string, unknown>} */
  const merged = { features: [] };

  for (const id of chipIds) {
    const chip = getDealerWishChip(id);
    if (!chip?.filters) continue;
    const f = chip.filters;

    if (f.fuel) merged.fuel = f.fuel;
    if (f.type) merged.type = f.type;
    if (f.maxRate != null) {
      merged.maxRate = merged.maxRate == null ? f.maxRate : Math.min(merged.maxRate, f.maxRate);
    }
    if (f.maxPrice != null) {
      merged.maxPrice = merged.maxPrice == null ? f.maxPrice : Math.min(merged.maxPrice, f.maxPrice);
    }
    if (f.rangeKmMin != null) {
      merged.rangeKmMin = Math.max(merged.rangeKmMin ?? 0, f.rangeKmMin);
    }
    if (f.seatsMin != null) {
      merged.seatsMin = Math.max(merged.seatsMin ?? 0, f.seatsMin);
    }
    if (f.towCapacityKg != null) {
      merged.towCapacityKg = Math.max(merged.towCapacityKg ?? 0, f.towCapacityKg);
    }
    if (f.maxLengthMm != null) merged.maxLengthMm = f.maxLengthMm;
    if (f.maxHeightMm != null) merged.maxHeightMm = f.maxHeightMm;
    if (f.trunkLMin != null) merged.trunkLMin = f.trunkLMin;
    if (f.isofixRearMin != null) {
      merged.isofixRearMin = Math.max(merged.isofixRearMin ?? 0, f.isofixRearMin);
    }
    if (f.availability) merged.availability = f.availability;
    if (f.brand) merged.brand = f.brand;
    if (f.model) merged.model = f.model;
    if (f.trim) merged.trim = f.trim;
    if (f.modelExplicit) merged.modelExplicit = true;
    if (f.features?.length) {
      merged.features = unionFeatures(merged.features, f.features);
    }
  }

  return merged;
}

export function buildDealerSearchSummary(chipIds = [], freeText = '') {
  const labels = chipIds
    .map((id) => getDealerWishChip(id)?.label)
    .filter(Boolean);
  const text = freeText.trim();
  if (text && labels.length) return `${text} · ${labels.join(' · ')}`;
  if (text) return text;
  return labels.join(' · ');
}

export function toggleDealerChipId(chipIds = [], chipId) {
  if (chipIds.includes(chipId)) {
    return chipIds.filter((id) => id !== chipId);
  }
  return [...chipIds, chipId];
}

function maxOptional(a, b) {
  if (a == null) return b ?? null;
  if (b == null) return a;
  return Math.max(a, b);
}

function minOptional(a, b) {
  if (a == null) return b ?? null;
  if (b == null) return a;
  return Math.min(a, b);
}

/** Freitext-Filter + Chip-Filter zusammenführen. */
function chipMatchesFilters(chip, filters = {}) {
  const f = chip.filters ?? {};
  if (f.fuel && filters.fuel && f.fuel !== filters.fuel) return false;
  if (f.type && filters.type && f.type !== 'all' && filters.type !== f.type) return false;
  if (f.maxRate != null && filters.maxRate !== f.maxRate) return false;
  if (f.maxPrice != null && filters.maxPrice !== f.maxPrice) return false;
  if (f.rangeKmMin != null && (filters.rangeKmMin ?? 0) < f.rangeKmMin) return false;
  if (f.seatsMin != null && (filters.seatsMin ?? 0) < f.seatsMin) return false;
  if (f.towCapacityKg != null && (filters.towCapacityKg ?? 0) < f.towCapacityKg) return false;
  if (f.isofixRearMin != null && (filters.isofixRearMin ?? 0) < f.isofixRearMin) return false;
  if (f.maxLengthMm != null && filters.maxLengthMm !== f.maxLengthMm) return false;
  if (f.maxHeightMm != null && filters.maxHeightMm !== f.maxHeightMm) return false;
  if (f.trunkLMin != null && filters.trunkLMin !== f.trunkLMin) return false;
  if (f.availability && filters.availability !== f.availability) return false;
  if (f.modelExplicit && f.model && filters.model !== f.model) return false;
  if (f.trim && filters.trim !== f.trim) return false;

  for (const feat of f.features ?? []) {
    if (['elektro', 'reichweite'].includes(feat)) continue;
    if (!filters.features?.includes(feat)) return false;
  }
  return true;
}

/** Aktive Händler-Chips aus zusammengeführten Filtern ableiten (Sync mit „Ihre Suche“). */
export function matchDealerChipsFromFilters(filters = {}) {
  return DEALER_WISH_CHIPS.filter((chip) => chipMatchesFilters(chip, filters)).map((c) => c.id);
}

/** Stated-Chip-ID → Händler-Chip-ID (für Abwahl). */
export function dealerChipIdForStatedChip(statedChip = {}) {
  const map = {
    heat_pump: 'heat_pump',
    seats_7: 'seats_7',
    isofixRearMin: 'isofix_3',
    maxLengthMm: 'length_4m',
    maxHeightMm: 'garage_2m',
    trunkLMin: 'large_trunk',
    tow_braked: 'tow_2000',
    rangeKmMin: 'range_400',
    maxRate: 'fuel_elektro_300',
    availability: 'availability_sofort',
    model: 'model_ev3_gt',
  };
  if (statedChip.id === 'maxRate' && statedChip.value === 300) return 'fuel_elektro_300';
  if (statedChip.id === 'rangeKmMin' && statedChip.value >= 400) return 'range_400';
  return map[statedChip.id] ?? null;
}

export function mergeDealerSearchFilters(textFilters = {}, chipFilters = {}, refinements = {}) {
  const features = unionFeatures(textFilters.features, chipFilters.features);
  return {
    ...textFilters,
    ...chipFilters,
    ...refinements,
    features,
    fuel: chipFilters.fuel ?? textFilters.fuel ?? '',
    type: chipFilters.type ?? textFilters.type ?? 'all',
    rangeKmMin: maxOptional(textFilters.rangeKmMin, chipFilters.rangeKmMin),
    seatsMin: maxOptional(textFilters.seatsMin, chipFilters.seatsMin),
    towCapacityKg: maxOptional(textFilters.towCapacityKg, chipFilters.towCapacityKg),
    isofixRearMin: maxOptional(textFilters.isofixRearMin, chipFilters.isofixRearMin),
    maxRate: minOptional(textFilters.maxRate, chipFilters.maxRate),
    maxPrice: minOptional(textFilters.maxPrice, chipFilters.maxPrice),
    maxLengthMm: chipFilters.maxLengthMm ?? textFilters.maxLengthMm ?? null,
    maxHeightMm: chipFilters.maxHeightMm ?? textFilters.maxHeightMm ?? null,
    trunkLMin: chipFilters.trunkLMin ?? textFilters.trunkLMin ?? null,
    brand: chipFilters.brand ?? textFilters.brand ?? '',
    model: chipFilters.model ?? textFilters.model ?? '',
    trim: chipFilters.trim ?? textFilters.trim ?? '',
    modelExplicit: Boolean(chipFilters.modelExplicit || textFilters.modelExplicit),
    availability: chipFilters.availability ?? textFilters.availability ?? '',
    intentStructured: true,
  };
}
