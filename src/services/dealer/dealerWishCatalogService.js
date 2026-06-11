/**
 * Wunsch-Chips pro Modell – filtern, sortieren, Popular picks.
 */
import {
  DEALER_WISH_GROUPS,
  MODEL_POPULAR_WISH_CHIP_IDS,
  findDealerWishChip,
} from '../../data/dealer/dealerWishCatalog.js';
import { KIA_MODEL_ATTRIBUTES } from '../../data/kia/kiaModelAttributes.js';
import { KIA_TECHNICAL_SPECS } from '../../data/kia/kiaTechnicalSpecs.js';
import { getModelTrims, normalizeModelKey } from '../../data/features/trimFeatureMapping.js';

const DEFAULT_GROUP_ORDER = ['comfort', 'safety', 'electro', 'family', 'transport', 'business'];

/** Hero-Suchchips → Wunsch-Chips (gleiche ID wo möglich). */
const HERO_CHIP_TO_WISH_CHIP = {
  range_400: 'range_400',
  towbar: 'towbar',
  seats_7: 'seats_7',
  isofix_3: 'isofix_3',
  tow_2000: 'tow_capacity_2000',
  large_trunk: 'large_trunk',
  heat_pump: 'heat_pump',
  camera_360: 'camera_360',
  heated_seats: 'heated_seats',
};

/** Feature-IDs aus Suchprofil → Wunsch-Chip. */
const FEATURE_TO_WISH_CHIP = {
  heat_pump: 'heat_pump',
  camera_360: 'camera_360',
  towbar: 'towbar',
  tow_capacity_2000: 'tow_capacity_2000',
  seats_7: 'seats_7',
  range_400: 'range_400',
  large_trunk: 'large_trunk',
  family_suv: 'stroller',
  blind_spot: 'blind_spot',
  heated_seats: 'heated_seats',
  head_up_display: 'head_up_display',
  ventilated_seats: 'ventilated_seats',
  panorama_roof: 'panorama_roof',
  power_tailgate: 'power_tailgate',
};

const SEARCH_CHIP_TO_GROUPS = {
  fuel_elektro: ['electro'],
  seats_7: ['family'],
  towbar: ['transport'],
  tow_2000: ['transport'],
  tow_braked: ['transport'],
  type_familie: ['family'],
  daily_family: ['family'],
  heat_pump: ['electro', 'comfort'],
  camera_360: ['safety'],
  range_400: ['electro'],
  large_trunk: ['family', 'transport'],
};

function resolveModelContext(modelKey) {
  const mappingKey = normalizeModelKey('Kia', modelKey);
  const attrs = KIA_MODEL_ATTRIBUTES[mappingKey] ?? KIA_MODEL_ATTRIBUTES[modelKey];
  const specs = KIA_TECHNICAL_SPECS[mappingKey] ?? KIA_TECHNICAL_SPECS[modelKey];
  const trims = getModelTrims(mappingKey);
  return { mappingKey, attrs, specs, trims };
}

function trimHasFeature(trims, featureId) {
  return trims.some((trim) => (
    trim.standardFeatures?.includes(featureId)
    || trim.availableViaPackage?.includes(featureId)
  ));
}

function isChipRelevant(chip, { attrs, specs, trims }) {
  if (chip.electricOnly && attrs?.fuel !== 'electric') return false;

  if (chip.id === 'seats_7' || chip.id === 'isofix_3') {
    return Boolean(attrs?.isSevenSeater || (attrs?.seats ?? 0) >= 7);
  }

  if (chip.id === 'range_500') {
    const range = specs?.electricRangeKm ?? attrs?.typicalRangeKm ?? 0;
    return range >= 450;
  }

  if (chip.id === 'tow_1500' || chip.id === 'tow_capacity_2000') {
    const tow = attrs?.towCapacityKg ?? 0;
    if (chip.id === 'tow_capacity_2000') return tow >= 2000 || trimHasFeature(trims, 'tow_capacity_2000');
    return tow >= 1500 || trimHasFeature(trims, 'towbar');
  }

  if (chip.id === 'large_trunk' || chip.id === 'stroller') {
    return (specs?.trunkL ?? 0) >= 400
      || attrs?.bodyClass === 'family_suv'
      || attrs?.bodyClass === 'large_suv'
      || trimHasFeature(trims, 'large_trunk')
      || trimHasFeature(trims, 'family_suv');
  }

  if (!trims.length) {
    return chip.features?.some((f) => (
      f === 'range_400' ? attrs?.fuel === 'electric' : true
    )) ?? true;
  }

  return chip.features.some((featureId) => trimHasFeature(trims, featureId));
}

/**
 * @param {object|null} searchProfile
 * @param {object|null} searchFilters
 * @param {string[]} [searchChipIds]
 */
export function scoreWishGroupForSearch(groupId, searchProfile, searchFilters, searchChipIds = []) {
  let score = 0;

  if (groupId === 'electro') {
    if (searchProfile?.fuel === 'electric') score += 12;
    if (searchFilters?.fuel === 'elektro') score += 12;
    if (searchProfile?.requiredFeatures?.includes('range_400')) score += 8;
    if (searchProfile?.requiredFeatures?.includes('heat_pump')) score += 6;
  }

  if (groupId === 'family') {
    if ((searchProfile?.seatsMin ?? 0) >= 7) score += 14;
    if (searchProfile?.requiredFeatures?.includes('seats_7')) score += 14;
    if (searchProfile?.requiredFeatures?.includes('family_suv')) score += 8;
    if (searchFilters?.seatsMin >= 7) score += 14;
  }

  if (groupId === 'transport') {
    if (searchProfile?.requiredFeatures?.includes('towbar')) score += 10;
    if (searchProfile?.requiredFeatures?.includes('tow_capacity_2000')) score += 16;
    if ((searchFilters?.towCapacityKg ?? 0) >= 2000) score += 18;
    if ((searchFilters?.towCapacityKg ?? 0) >= 1500) score += 12;
  }

  if (groupId === 'safety') {
    if (searchProfile?.requiredFeatures?.includes('camera_360')) score += 8;
    if (searchProfile?.requiredFeatures?.includes('blind_spot')) score += 6;
  }

  if (groupId === 'comfort') {
    if (searchProfile?.requiredFeatures?.includes('heated_seats')) score += 6;
  }

  for (const chipId of searchChipIds) {
    const boosted = SEARCH_CHIP_TO_GROUPS[chipId] ?? [];
    if (boosted.includes(groupId)) score += 10;
  }

  for (const featureId of searchProfile?.requiredFeatures ?? []) {
    if (groupId === 'electro' && ['heat_pump', 'range_400', 'elektro'].includes(featureId)) score += 5;
    if (groupId === 'transport' && ['towbar', 'tow_capacity_2000'].includes(featureId)) score += 5;
    if (groupId === 'family' && ['seats_7', 'family_suv', 'large_trunk'].includes(featureId)) score += 5;
  }

  return score;
}

function resolveSmartGroupPriority(searchProfile, searchFilters, searchChipIds) {
  const hasTow = (searchFilters?.towCapacityKg ?? 0) >= 1500
    || searchChipIds.some((id) => ['tow_2000', 'towbar', 'tow_braked'].includes(id))
    || searchProfile?.requiredFeatures?.includes('towbar');
  const hasFamily = (searchProfile?.seatsMin ?? 0) >= 7
    || (searchFilters?.seatsMin ?? 0) >= 7
    || searchChipIds.includes('seats_7');
  const hasElectric = searchProfile?.fuel === 'electric'
    || searchFilters?.fuel === 'elektro'
    || searchChipIds.includes('fuel_elektro');

  if (hasTow && hasFamily && hasElectric) {
    return ['transport', 'family', 'electro', 'comfort', 'safety', 'business'];
  }
  if (hasTow && hasFamily) {
    return ['transport', 'family', 'electro', 'comfort', 'safety', 'business'];
  }
  if (hasElectric && hasFamily) {
    return ['family', 'electro', 'transport', 'comfort', 'safety', 'business'];
  }
  if (hasTow) {
    return ['transport', 'electro', 'family', 'comfort', 'safety', 'business'];
  }
  if (hasElectric) {
    return ['electro', 'comfort', 'safety', 'family', 'transport', 'business'];
  }
  return DEFAULT_GROUP_ORDER;
}

function sortGroupsBySearch(groups, searchProfile, searchFilters, searchChipIds) {
  const priority = resolveSmartGroupPriority(searchProfile, searchFilters, searchChipIds);
  const hasSearchIntent = priority !== DEFAULT_GROUP_ORDER;

  return [...groups].sort((a, b) => {
    if (hasSearchIntent) {
      const idxA = priority.indexOf(a.id);
      const idxB = priority.indexOf(b.id);
      if (idxA !== idxB) return idxA - idxB;
    }
    const scoreA = scoreWishGroupForSearch(a.id, searchProfile, searchFilters, searchChipIds);
    const scoreB = scoreWishGroupForSearch(b.id, searchProfile, searchFilters, searchChipIds);
    if (scoreB !== scoreA) return scoreB - scoreA;
    return DEFAULT_GROUP_ORDER.indexOf(a.id) - DEFAULT_GROUP_ORDER.indexOf(b.id);
  });
}

/**
 * @param {string} modelKey
 * @param {object} [options]
 */
export function getDealerWishGroupsForModel(modelKey, options = {}) {
  const { searchProfile = null, searchFilters = null, searchChipIds = [] } = options;
  const ctx = resolveModelContext(modelKey);

  const groups = DEALER_WISH_GROUPS
    .map((group) => ({
      ...group,
      chips: group.chips.filter((chip) => isChipRelevant(chip, ctx)),
    }))
    .filter((group) => group.chips.length > 0);

  return sortGroupsBySearch(groups, searchProfile, searchFilters, searchChipIds);
}

/**
 * @param {string} modelKey
 * @param {object} [options]
 */
/**
 * Wunsch-Chips aus Suche ableiten – nur modellrelevante Chips.
 * @param {string} modelKey
 * @param {object} [options]
 */
export function inferWishChipsFromSearch(modelKey, options = {}) {
  const { searchProfile = null, searchFilters = null, searchChipIds = [] } = options;
  const ctx = resolveModelContext(modelKey);
  const candidates = new Set();

  for (const chipId of searchChipIds) {
    const wishId = HERO_CHIP_TO_WISH_CHIP[chipId];
    if (wishId) candidates.add(wishId);
  }

  for (const featureId of [
    ...(searchProfile?.requiredFeatures ?? []),
    ...(searchProfile?.softPreferences ?? []),
  ]) {
    const wishId = FEATURE_TO_WISH_CHIP[featureId];
    if (wishId) candidates.add(wishId);
  }

  if ((searchProfile?.seatsMin ?? 0) >= 7 || (searchFilters?.seatsMin ?? 0) >= 7) {
    candidates.add('seats_7');
  }

  const towKg = searchFilters?.towCapacityKg ?? 0;
  if (towKg >= 2000 || searchProfile?.requiredFeatures?.includes('tow_capacity_2000')) {
    candidates.add('tow_capacity_2000');
    candidates.add('towbar');
  } else if (towKg >= 1500 || searchProfile?.requiredFeatures?.includes('towbar')) {
    if (towKg >= 1500) candidates.add('tow_1500');
    candidates.add('towbar');
  }

  if ((searchFilters?.rangeKmMin ?? 0) >= 400) candidates.add('range_400');
  if (searchFilters?.trunkLMin) candidates.add('large_trunk');
  if ((searchFilters?.isofixRearMin ?? 0) >= 3) candidates.add('isofix_3');

  return [...candidates].filter((id) => {
    const chip = findDealerWishChip(id);
    return chip && isChipRelevant(chip, ctx);
  });
}

export function getPopularWishesForModel(modelKey, options = {}) {
  const mappingKey = normalizeModelKey('Kia', modelKey);
  const chipIds = MODEL_POPULAR_WISH_CHIP_IDS[mappingKey]
    ?? MODEL_POPULAR_WISH_CHIP_IDS[modelKey]
    ?? [];

  if (!chipIds.length) return null;

  const ctx = resolveModelContext(modelKey);
  const attrs = ctx.attrs;
  const modelLabel = attrs?.label ?? mappingKey.toUpperCase();

  const chips = chipIds
    .map((id) => findDealerWishChip(id))
    .filter((chip) => chip && isChipRelevant(chip, ctx));

  if (!chips.length) return null;

  return {
    modelKey: mappingKey,
    modelLabel,
    title: `Häufig gewählte Wünsche beim ${modelLabel}`,
    chips,
  };
}
