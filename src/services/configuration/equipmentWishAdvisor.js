/**
 * Ausstattungsberatung – dynamisch aus Herstellerdaten (markenübergreifend).
 */
import { getFeatureLabel } from '../../data/features/featureCatalog.js';
import { getGlobalFeatureById, GLOBAL_FEATURE_CATALOG } from '../../data/features/globalFeatureCatalog.js';
import { FEATURE_AVAILABILITY_STATUS as S } from '../../data/features/modelEquipmentSchema.js';
import { getEquipmentWishChip } from '../../data/features/equipmentWishChips.js';
import { getPackagesForTrim } from '../../data/dealer/dealerTrimPackages.js';
import { getModelTrims, normalizeModelKey, TRIM_FEATURE_MAP } from '../../data/features/trimFeatureMapping.js';
import {
  getManufacturerModel,
  getManufacturerPackages,
  getManufacturerTrims,
} from '../../data/manufacturer/manufacturerRegistry.js';
import { resolveWishConfiguration } from '../configurator/wishPackageResolver.js';
import { mergeSearchedIntoFeatureIds, searchedFeatureToWishFeature } from './equipmentFeatureSearch.js';
import { resolveModelFeatureAvailability } from './modelEquipmentData.js';
import { buildEquipmentChipsForModel, resolveChipToScoringFeatureIds } from './equipmentChipBuilder.js';
import {
  buildCustomerAdvisorChipGroups,
  resolveCustomerAdvisorChipFeatureIds,
} from '../../data/features/customerAdvisorChipGroups.js';
import { priceConfiguration } from '../pricing/pricingEngine.js';

function getGlobalFeatureByLegacyId(legacyId) {
  if (!legacyId) return null;
  return GLOBAL_FEATURE_CATALOG.find((feature) => feature.legacyFeatureId === legacyId) ?? null;
}

function resolveMappingTrimFeatureStatus(trim, legacyFeatureId) {
  if (!trim || !legacyFeatureId) return S.UNKNOWN;
  if (trim.standardFeatures?.includes(legacyFeatureId)) return S.STANDARD;
  if (trim.availableViaPackage?.includes(legacyFeatureId)) return S.PACKAGE_REQUIRED;
  if (trim.notAvailable?.includes(legacyFeatureId)) return S.NOT_AVAILABLE;
  return S.UNKNOWN;
}

/** @returns {'fulfilled' | 'missing' | 'uncertain'} */
export function resolveWishOnTrim({
  featureId = null,
  catalogId = null,
  trimId,
  brand = 'Kia',
  model,
  modelKey,
}) {
  const globalFeature = catalogId
    ? getGlobalFeatureById(catalogId)
    : getGlobalFeatureByLegacyId(featureId);
  const globalId = globalFeature?.id ?? catalogId;
  const legacyId = featureId ?? globalFeature?.legacyFeatureId ?? null;

  if (globalId) {
    const availability = resolveModelFeatureAvailability(brand, model, modelKey, globalId);
    const entry = availability?.entries?.find((item) => item.trimId === trimId);
    if (entry) {
      if ([S.STANDARD, S.AVAILABLE, S.OPTIONAL, S.PACKAGE_REQUIRED].includes(entry.status)) {
        return 'fulfilled';
      }
      if (entry.status === S.NOT_AVAILABLE) return 'missing';
    } else if (availability?.entries?.length) {
      return 'missing';
    }
  }

  if (legacyId && modelKey) {
    const trim = getModelTrims(modelKey).find((item) => item.id === trimId);
    const mapped = resolveMappingTrimFeatureStatus(trim, legacyId);
    if ([S.STANDARD, S.AVAILABLE, S.PACKAGE_REQUIRED].includes(mapped)) return 'fulfilled';
    if (mapped === S.NOT_AVAILABLE) return 'missing';
  }

  return 'uncertain';
}

function applyCatalogWishesForTrim({
  trimId,
  brand,
  model,
  modelKey,
  confirmedCatalogWishes = [],
  fulfilled,
  missing,
  uncertain,
}) {
  let matchedDelta = 0;
  for (const wish of confirmedCatalogWishes) {
    const result = resolveWishOnTrim({
      featureId: null,
      catalogId: wish.catalogId,
      trimId,
      brand,
      model,
      modelKey,
    });
    if (result === 'fulfilled' && !fulfilled.includes(wish.label)) {
      fulfilled.push(wish.label);
      matchedDelta += 1;
    } else if (result === 'missing' && !missing.includes(wish.label)) {
      missing.push(wish.label);
    } else if (result === 'uncertain' && !uncertain.includes(wish.label)) {
      uncertain.push(wish.label);
      matchedDelta += 0.5;
    }
  }
  return matchedDelta;
}

function applyPendingSearchedWishesForTrim({
  trimId,
  brand,
  model,
  modelKey,
  searchedFeatures = [],
  fulfilled,
  missing,
  uncertain,
}) {
  let matchedDelta = 0;
  for (const item of searchedFeatures) {
    const wish = searchedFeatureToWishFeature(item);
    if (!wish?.advisorRelevant || wish.missing) continue;
    if (wish.catalogOnly) continue;
    const result = resolveWishOnTrim({
      featureId: wish.featureId,
      catalogId: wish.globalFeatureId ?? wish.catalogId,
      trimId,
      brand,
      model,
      modelKey,
    });
    if (result === 'fulfilled' && !fulfilled.includes(wish.label)) {
      fulfilled.push(wish.label);
      matchedDelta += 1;
    } else if (result === 'missing' && !missing.includes(wish.label)) {
      missing.push(wish.label);
    } else if (result === 'uncertain' && !uncertain.includes(wish.label)) {
      uncertain.push(wish.label);
      matchedDelta += 0.5;
    }
  }
  return matchedDelta;
}

const BADGE_LABELS = {
  basis: 'Günstigste Rate',
  günstig: 'Günstigste Rate',
  preis_leistung: 'Clever Empfehlung',
  preis_leistung_alt: 'Preis-Leistung',
  komfort: 'Mehr Komfort',
  premium: 'Premium',
  sportlich: 'Sportlicher Look',
  design: 'Premium',
  assistenz: 'Mehr Assistenz',
  technik: 'Mehr Technik',
  winter: 'Wintertauglich',
  alltag: 'Guter Allrounder',
};

const DESCRIPTION_BY_TAG = {
  basis: 'Solide Basis – möglichst preiswert unterwegs.',
  günstig: 'Für alle, die bewusst sparen möchten.',
  preis_leistung: 'Gute Mischung aus Komfort, Alltag und Preis.',
  komfort: 'Mehr Komfort für den täglichen Einsatz.',
  premium: 'Mehr Design, Technik und Assistenz.',
  sportlich: 'Sportlicher Look mit zusätzlicher Ausstattung.',
  assistenz: 'Mehr Unterstützung im Alltagsverkehr.',
  technik: 'Zusätzliche Technik und digitale Features.',
  winter: 'Besser gerüstet für kalte Tage.',
  alltag: 'Praktisch für den Alltag.',
};

function uniqueFeatureIds(chipIds = []) {
  const ids = new Set();
  for (const chipId of chipIds) {
    const chip = getEquipmentWishChip(chipId);
    if (chip?.advisorMeta) continue;
    if (chip?.advisorRelevant === false) continue;
    const global = getGlobalFeatureById(chipId);
    if (global?.advisorRelevant === false) continue;
    resolveCustomerAdvisorChipFeatureIds(chipId).forEach((id) => ids.add(id));
  }
  return [...ids];
}

function resolveAdvisorContext(brand, model, modelKey) {
  const mfg = getManufacturerModel(brand, model);
  if (mfg) return { type: 'manufacturer', mfg };

  const key = modelKey ?? normalizeModelKey(brand, model);
  if (key && TRIM_FEATURE_MAP[key]) {
    return { type: 'mapping', modelKey: key, mapping: TRIM_FEATURE_MAP[key] };
  }
  return null;
}

export function getEquipmentWishChipGroups(brand, model, modelKey, options = {}) {
  if (options.customerJourney) {
    return buildCustomerAdvisorChipGroups();
  }
  return buildEquipmentChipsForModel(brand, model, modelKey);
}

export function modelHasEquipmentPackages(brand, model, modelKey) {
  const ctx = resolveAdvisorContext(brand, model, modelKey);
  if (!ctx) return false;
  if (ctx.type === 'manufacturer') {
    return getManufacturerPackages(ctx.mfg.key).length > 0;
  }
  const trims = getModelTrims(ctx.modelKey);
  return trims.some((trim) => getPackagesForTrim(ctx.modelKey, trim.id).length > 0);
}

function deriveTrimTags(trim, index, total) {
  if (trim.tags?.length) return trim.tags;
  if (index === 0) return ['basis', 'günstig'];
  if (index === total - 1) return ['premium', 'design'];
  if (total >= 3 && index === 1) return ['komfort', 'preis_leistung', 'alltag'];
  return ['komfort', 'alltag'];
}

function resolveTrimBadge(trim, { index, total, recommendedId }) {
  if (trim.badge) return trim.badge;
  if (trim.id === recommendedId) return 'Clever Empfehlung';
  const tags = deriveTrimTags(trim, index, total);
  for (const tag of ['günstig', 'basis', 'preis_leistung', 'premium', 'komfort', 'sportlich']) {
    if (tags.includes(tag) && BADGE_LABELS[tag]) return BADGE_LABELS[tag];
  }
  if (index === 0) return 'Günstigste Rate';
  if (index === total - 1) return 'Premium';
  return 'Mehr Komfort';
}

function resolveTrimDescription(trim, index, total) {
  if (trim.description) return trim.description;
  const tags = deriveTrimTags(trim, index, total);
  for (const tag of tags) {
    if (DESCRIPTION_BY_TAG[tag]) return DESCRIPTION_BY_TAG[tag];
  }
  return 'Passende Ausstattungslinie für Ihren Wunsch.';
}

function getTrimRate(brand, model, trimId, paymentType = 'leasing', modelKey) {
  const prices = getTrimPrices(brand, model, trimId, modelKey);
  if (paymentType === 'cash') return prices.cashPrice;
  return prices.rate;
}

function getTrimPrices(brand, model, trimId, modelKey) {
  const mfg = getManufacturerModel(brand, model);
  if (mfg) {
    try {
      const leasing = priceConfiguration({
        brand,
        model,
        trimId,
        wishFeatureIds: [],
        packageIds: [],
        paymentType: 'leasing',
      });
      const cash = priceConfiguration({
        brand,
        model,
        trimId,
        wishFeatureIds: [],
        packageIds: [],
        paymentType: 'cash',
      });
      return {
        rate: leasing?.leasingRate ?? leasing?.rate ?? null,
        cashPrice: cash?.cashPrice ?? cash?.totalPrice ?? null,
      };
    } catch {
      const variant = mfg.data.variants?.find((v) => v.trimId === trimId);
      return {
        rate: variant?.baseLeasingRate ?? null,
        cashPrice: variant?.listPriceGross ?? null,
      };
    }
  }

  const key = modelKey ?? normalizeModelKey(brand, model);
  const baseRate = TRIM_FEATURE_MAP[key]?.baseRate?.[trimId] ?? null;
  const baseCash = TRIM_FEATURE_MAP[key]?.baseCashPrice?.[trimId] ?? null;
  return { rate: baseRate, cashPrice: baseCash };
}

function analyzeMappingSelection(modelKey, selectedChipIds, featureIds, options = {}) {
  const mapping = TRIM_FEATURE_MAP[modelKey];
  const rawTrims = getModelTrims(modelKey);
  const pendingLabels = options.pendingUncertainLabels ?? [];
  const missingLabels = options.pendingMissingLabels ?? [];
  const confirmedCatalogWishes = options.confirmedCatalogWishes ?? [];
  const hasSearched = (options.searchedFeatures?.length ?? 0) > 0;
  if (!mapping || !rawTrims.length) {
    return {
      empty: false,
      hasWishes: featureIds.length > 0 || hasSearched,
      hasPackages: false,
      uncertain: true,
      chipGroups: getEquipmentWishChipGroups('Kia', modelKey, modelKey),
      trimLines: [],
      packages: [],
      recommendation: null,
    };
  }

  const trims = rawTrims.map((trim) => ({ id: trim.id, name: trim.name, ...trim }));
  const paymentType = options.paymentType ?? 'leasing';
  const hasWishes = featureIds.length > 0 || hasSearched;

  const scored = trims.map((trim, index) => {
    const score = scoreTrimForWishesMapping(
      trim,
      featureIds,
      pendingLabels,
      {
        missingLabels,
        confirmedCatalogWishes,
        searchedFeatures: options.searchedFeatures ?? [],
        brand: 'Kia',
        model: mapping.modelLabel?.replace(/^Kia\s+/i, '') ?? modelKey,
        modelKey,
      },
    );
    const prices = getTrimPrices('Kia', mapping.modelLabel?.replace('Kia ', '') ?? modelKey, trim.id, modelKey);
    return { ...score, trim, index, rate: prices.rate, cashPrice: prices.cashPrice };
  });

  const recommendedTrimId = pickRecommendedTrimId(
    scored.map((s) => ({ trimId: s.trimId, matchPercent: s.matchPercent, rate: s.rate })),
    trims,
    hasWishes,
  );

  const trimLines = buildTrimLineEntries(
    scored,
    trims,
    recommendedTrimId,
    paymentType,
    'Kia',
    mapping.modelLabel?.replace(/^Kia\s+/i, '') ?? modelKey,
    modelKey,
  );

  const activeTrimId = options.selectedTrimId ?? recommendedTrimId ?? trimLines[0]?.trimId;
  const modelLabel = mapping.modelLabel?.replace(/^Kia\s+/i, '') ?? modelKey.toUpperCase();
  const allPackages = getPackagesForTrim(modelKey, activeTrimId).map((pkg) => ({
    id: pkg.id,
    name: pkg.label,
    description: pkg.highlights?.join(', ') ?? '',
    availableTrims: pkg.trimIds,
  }));

  const packages = hasWishes
    ? allPackages
      .map((pkg) => ({
        ...pkg,
        score: scorePackageForWishes(pkg, selectedChipIds, activeTrimId),
        tags: inferPackageTags(pkg),
      }))
      .filter((pkg) => pkg.availableTrims?.includes(activeTrimId) && pkg.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
    : [];

  const recommendedPackages = packages.filter((p) => p.score >= 2).slice(0, 2);
  const trimLine = trimLines.find((t) => t.trimId === activeTrimId) ?? trimLines[0];
  const hasUncertain = trimLines.some((t) => t.uncertain?.length > 0);

  return {
    empty: false,
    hasWishes,
    hasPackages: modelHasEquipmentPackages('Kia', modelLabel, modelKey),
    uncertain: hasUncertain,
    chipGroups: getEquipmentWishChipGroups('Kia', modelLabel, modelKey),
    trimLines,
    packages: recommendedPackages,
    recommendation: {
      trimId: activeTrimId,
      trimName: trimLine?.trimName,
      packageIds: recommendedPackages.map((p) => p.id),
      packageNames: recommendedPackages.map((p) => p.name),
      label: [trimLine?.trimName, ...recommendedPackages.map((p) => p.name)].filter(Boolean).join(' + '),
      reasons: buildRecommendationReasons({
        trimLine,
        packages: recommendedPackages,
        chipIds: selectedChipIds,
        hasUncertain,
        hasWishes,
      }),
      uncertainNote: hasUncertain
        ? 'Einige Ausstattungsdetails müssen vom Autohaus bestätigt werden.'
        : null,
    },
  };
}

function scoreTrimForWishesMapping(trim, featureIds, pendingLabels = [], extras = {}) {
  const missingLabels = extras.missingLabels ?? [];
  const confirmedCatalogWishes = extras.confirmedCatalogWishes ?? [];
  const searchedFeatures = extras.searchedFeatures ?? [];
  const brand = extras.brand ?? 'Kia';
  const model = extras.model ?? '';
  const modelKey = extras.modelKey ?? '';
  const catalogWishCount = confirmedCatalogWishes.length + missingLabels.length;
  const pendingSearchCount = searchedFeatures.filter((item) => {
    const wish = searchedFeatureToWishFeature(item);
    return wish?.advisorRelevant && !wish.missing && !wish.catalogOnly;
  }).length;

  if (!featureIds.length && !pendingLabels.length && !catalogWishCount && !pendingSearchCount) {
    return {
      trimId: trim.id,
      matchPercent: 0,
      fulfilled: [],
      missing: [],
      uncertain: [],
      packageNeeded: [],
    };
  }

  const fulfilled = [];
  const missing = [...missingLabels];
  const uncertain = [];
  let matched = 0;

  matched += applyCatalogWishesForTrim({
    trimId: trim.id,
    brand,
    model,
    modelKey,
    confirmedCatalogWishes,
    fulfilled,
    missing,
    uncertain,
  });

  for (const fid of featureIds) {
    const label = getFeatureLabel(fid);
    if (trim.standardFeatures?.includes(fid)) {
      fulfilled.push(label);
      matched += 1;
    } else if (trim.availableViaPackage?.includes(fid)) {
      fulfilled.push(label);
      matched += 1;
    } else if (trim.notAvailable?.includes(fid)) {
      if (!missing.includes(label)) missing.push(label);
    } else {
      const result = resolveWishOnTrim({
        featureId: fid,
        trimId: trim.id,
        brand,
        model,
        modelKey,
      });
      if (result === 'fulfilled' && !fulfilled.includes(label)) {
        fulfilled.push(label);
        matched += 1;
      } else if (result === 'missing' && !missing.includes(label)) {
        missing.push(label);
      } else if (!uncertain.includes(label)) {
        uncertain.push(label);
        matched += 0.5;
      }
    }
  }

  matched += applyPendingSearchedWishesForTrim({
    trimId: trim.id,
    brand,
    model,
    modelKey,
    searchedFeatures,
    fulfilled,
    missing,
    uncertain,
  });

  for (const label of pendingLabels) {
    if (fulfilled.includes(label) || missing.includes(label) || uncertain.includes(label)) continue;
    uncertain.push(label);
    matched += 0.5;
  }

  const total = featureIds.length + pendingLabels.length + catalogWishCount + pendingSearchCount;

  return {
    trimId: trim.id,
    matchPercent: total ? Math.round((matched / total) * 100) : 0,
    fulfilled,
    missing,
    uncertain: [...new Set(uncertain)],
    packageNeeded: [],
  };
}

function scoreTrimForWishes(brand, model, trimId, featureIds, modelKey, pendingLabels = [], extras = {}) {
  const missingLabels = extras.missingLabels ?? [];
  const confirmedCatalogWishes = extras.confirmedCatalogWishes ?? [];
  const searchedFeatures = extras.searchedFeatures ?? [];
  const catalogWishCount = confirmedCatalogWishes.length + missingLabels.length;
  const pendingSearchCount = searchedFeatures.filter((item) => {
    const wish = searchedFeatureToWishFeature(item);
    return wish?.advisorRelevant && !wish.missing && !wish.catalogOnly;
  }).length;

  if (!featureIds.length && !pendingLabels.length && !catalogWishCount && !pendingSearchCount) {
    return {
      trimId,
      matchPercent: 0,
      fulfilled: [],
      missing: [],
      uncertain: [],
      packageNeeded: [],
    };
  }

  const ctx = resolveAdvisorContext(brand, model, modelKey);
  if (ctx?.type === 'mapping') {
    const trim = getModelTrims(ctx.modelKey).find((entry) => entry.id === trimId);
    return scoreTrimForWishesMapping(trim ?? { id: trimId }, featureIds, pendingLabels, {
      ...extras,
      brand,
      model,
      modelKey,
      searchedFeatures,
    });
  }

  const res = resolveWishConfiguration({
    brand,
    model,
    trimId,
    wishFeatureIds: featureIds,
  });

  const fulfilled = [];
  const missing = [...missingLabels];
  const uncertain = [];
  const packageNeeded = [];
  let matched = 0;

  matched += applyCatalogWishesForTrim({
    trimId,
    brand,
    model,
    modelKey,
    confirmedCatalogWishes,
    fulfilled,
    missing,
    uncertain,
  });

  if (!res) {
    for (const fid of featureIds) {
      const label = getFeatureLabel(fid);
      if (!missing.includes(label)) missing.push(label);
    }
    matched += applyPendingSearchedWishesForTrim({
      trimId,
      brand,
      model,
      modelKey,
      searchedFeatures,
      fulfilled,
      missing,
      uncertain,
    });
    const total = featureIds.length + pendingLabels.length + catalogWishCount + pendingSearchCount;
    return {
      trimId,
      matchPercent: total ? Math.round((matched / total) * 100) : 0,
      fulfilled,
      missing,
      uncertain: [...new Set(uncertain)],
      packageNeeded: [],
    };
  }

  for (const fid of featureIds) {
    const label = getFeatureLabel(fid);
    if (res.matchedFeatures.includes(fid)) {
      fulfilled.push(label);
      matched += 1;
    } else if (res.uncertainFeatures.includes(fid)) {
      uncertain.push(label);
      matched += 0.5;
    } else if (res.missingFeatures.includes(fid)) {
      if (!missing.includes(label)) missing.push(label);
    } else if (res.viaPackageFeatures?.some((v) => v.wishId === fid)) {
      const pkg = res.viaPackageFeatures.find((v) => v.wishId === fid);
      packageNeeded.push(pkg?.label ?? label);
      fulfilled.push(label);
      matched += 1;
    } else {
      if (!missing.includes(label)) missing.push(label);
    }
  }

  matched += applyPendingSearchedWishesForTrim({
    trimId,
    brand,
    model,
    modelKey,
    searchedFeatures,
    fulfilled,
    missing,
    uncertain,
  });

  for (const label of pendingLabels) {
    if (fulfilled.includes(label) || missing.includes(label) || uncertain.includes(label)) continue;
    uncertain.push(label);
    matched += 0.5;
  }

  const total = featureIds.length + pendingLabels.length + catalogWishCount + pendingSearchCount;
  const matchPercent = total ? Math.round((matched / total) * 100) : 0;

  return {
    trimId,
    matchPercent,
    fulfilled,
    missing,
    uncertain: [...new Set(uncertain)],
    packageNeeded: [...new Set(packageNeeded)],
    resolution: res,
  };
}

function pickDefaultTrimId(trims) {
  if (!trims.length) return null;
  const valuePick = trims.find((trim, index) => {
    const tags = deriveTrimTags(trim, index, trims.length);
    return tags.includes('preis_leistung');
  });
  if (valuePick) return valuePick.id;
  if (trims.length >= 2) return trims[1].id;
  return trims[0].id;
}

function pickRecommendedTrimId(scored, trims, hasWishes) {
  if (!scored.length) return null;
  if (!hasWishes) return pickDefaultTrimId(trims);
  const sorted = [...scored].sort((a, b) => {
    if (b.matchPercent !== a.matchPercent) return b.matchPercent - a.matchPercent;
    return (a.rate ?? 9999) - (b.rate ?? 9999);
  });
  const best = sorted[0];
  const valuePick = sorted.find((entry) => {
    const tags = deriveTrimTags(
      trims.find((t) => t.id === entry.trimId) ?? {},
      trims.findIndex((t) => t.id === entry.trimId),
      trims.length,
    );
    return tags.includes('preis_leistung');
  });
  if (valuePick && best.matchPercent - valuePick.matchPercent <= 15) {
    return valuePick.trimId;
  }
  return best.trimId;
}

function inferPackageTags(pkg) {
  if (pkg.tags?.length) return pkg.tags;
  const hay = `${pkg.id} ${pkg.name} ${pkg.description ?? ''}`.toLowerCase();
  const tags = new Set();
  if (/winter|komfort|comfort|heiz|sitz/.test(hay)) tags.add('winter').add('komfort');
  if (/connect|technik|tech|digital|navi|online/.test(hay)) tags.add('technik').add('connect');
  if (/assistenz|safety|sicher|kamera|park|totwinkel/.test(hay)) tags.add('assistenz');
  if (/design|premium|style|sport|led|ambiente/.test(hay)) tags.add('design').add('premium');
  return [...tags];
}

const CHIP_TAG_HINTS = {
  heated_seats: ['winter', 'komfort'],
  steering_heat: ['winter', 'komfort'],
  heat_pump: ['winter', 'technik'],
  heated_rear_seats: ['winter', 'komfort'],
  rear_camera: ['assistenz', 'alltag'],
  camera_360: ['assistenz'],
  parking_rear: ['assistenz', 'alltag'],
  remote_parking: ['assistenz'],
  power_tailgate: ['komfort', 'alltag'],
  navigation: ['technik', 'connect'],
  harman_kardon: ['technik', 'premium'],
  blind_spot: ['assistenz'],
  head_up_display: ['technik', 'premium'],
  panorama_roof: ['design', 'premium'],
  ventilated_seats: ['premium', 'komfort'],
};

function scorePackageForWishes(pkg, chipIds, trimId) {
  if (!pkg.availableTrims?.includes(trimId)) return 0;
  const pkgTags = inferPackageTags(pkg);
  let score = 0;
  for (const chipId of chipIds) {
    const hints = CHIP_TAG_HINTS[chipId] ?? [];
    if (hints.some((h) => pkgTags.includes(h))) score += 2;
  }
  const hay = `${pkg.name} ${pkg.description ?? ''}`.toLowerCase();
  for (const chipId of chipIds) {
    const chip = getEquipmentWishChip(chipId);
    if (chip?.label && hay.includes(chip.label.toLowerCase().split(' ')[0])) {
      score += 1;
    }
  }
  return score;
}

function buildTrimLineEntries(scored, trims, recommendedTrimId, paymentMode, brand, model, modelKey) {
  const rates = scored.map((s) => s.rate).filter((r) => r != null);
  const cashPrices = scored.map((s) => s.cashPrice).filter((r) => r != null);
  const minRate = rates.length ? Math.min(...rates) : null;
  const minCash = cashPrices.length ? Math.min(...cashPrices) : null;

  return scored.map((entry) => {
    const {
      trim, index, matchPercent, fulfilled, missing, uncertain, packageNeeded, rate, cashPrice,
    } = entry;
    const tags = deriveTrimTags(trim, index, trims.length);
    const rateDelta = rate != null && minRate != null ? rate - minRate : null;
    const cashDelta = cashPrice != null && minCash != null ? cashPrice - minCash : null;
    return {
      trimId: trim.id,
      trimName: trim.name,
      tags,
      badge: resolveTrimBadge(trim, { index, total: trims.length, recommendedId: recommendedTrimId }),
      description: resolveTrimDescription(trim, index, trims.length),
      matchPercent,
      fulfilled,
      missing,
      uncertain,
      packageNeeded,
      rate,
      rateDelta,
      cashPrice,
      cashDelta,
      recommended: trim.id === recommendedTrimId,
    };
  }).sort((a, b) => {
    if (b.matchPercent !== a.matchPercent) return b.matchPercent - a.matchPercent;
    if (a.recommended) return -1;
    if (b.recommended) return 1;
    return (a.rate ?? 9999) - (b.rate ?? 9999);
  });
}

function buildRecommendationReasons({ trimLine, packages, chipIds, hasUncertain, hasWishes }) {
  const reasons = [];
  if (hasWishes) {
    reasons.push('erfüllt Ihre wichtigsten Wünsche');
  }
  if (trimLine?.badge === 'Clever Empfehlung' || trimLine?.tags?.includes('preis_leistung')) {
    reasons.push('bessere Alltagsausstattung als die Basisvariante');
  }
  if (packages.length) {
    reasons.push('passende Pakete statt unnötiger Vollausstattung');
  }
  if (trimLine?.badge === 'Günstigste Rate' || (trimLine?.rateDelta === 0 && trimLine?.tags?.includes('günstig'))) {
    reasons.push('sinnvoller als die höchste Ausstattung, wenn der Preis wichtig ist');
  } else if (!hasWishes) {
    reasons.push('sinnvolle Ausstattung für den Alltag');
  }
  if (hasUncertain) {
    reasons.push('Verfügbarkeit einzelner Details wird im Angebot geprüft');
  }
  return reasons.slice(0, 3);
}

/**
 * @param {string} brand
 * @param {string} model
 * @param {string[]} selectedChipIds
 * @param {{ paymentType?: string, selectedTrimId?: string }} options
 */
export function analyzeEquipmentWishSelection(brand, model, selectedChipIds = [], options = {}) {
  const chipFeatureIds = uniqueFeatureIds(selectedChipIds);
  const searchedFeatures = options.searchedFeatures ?? [];
  const { featureIds, uncertainLabels: pendingLabels, missingLabels, confirmedCatalogWishes } = mergeSearchedIntoFeatureIds(
    chipFeatureIds,
    searchedFeatures,
  );
  const modelKey = options.modelKey ?? normalizeModelKey(brand, model);
  const hasWishes = selectedChipIds.length > 0 || searchedFeatures.length > 0;
  const scoringOptions = {
    ...options,
    searchedFeatures,
    pendingUncertainLabels: pendingLabels,
    pendingMissingLabels: missingLabels,
    confirmedCatalogWishes,
  };

  const ctx = resolveAdvisorContext(brand, model, modelKey);
  if (!ctx) {
    return {
      empty: false,
      hasWishes,
      hasPackages: false,
      uncertain: true,
      chipGroups: getEquipmentWishChipGroups(brand, model, modelKey),
      trimLines: [],
      packages: [],
      recommendation: null,
    };
  }

  if (ctx.type === 'mapping') {
    return analyzeMappingSelection(ctx.modelKey, selectedChipIds, featureIds, scoringOptions);
  }

  const mfg = ctx.mfg;
  const trims = getManufacturerTrims(mfg.key);
  const paymentType = options.paymentType ?? 'leasing';

  const scored = trims.map((trim, index) => {
    const score = scoreTrimForWishes(
      brand,
      model,
      trim.id,
      featureIds,
      modelKey,
      pendingLabels,
      { missingLabels, confirmedCatalogWishes, searchedFeatures },
    );
    const prices = getTrimPrices(brand, model, trim.id, modelKey);
    return {
      ...score,
      trim,
      index,
      rate: prices.rate,
      cashPrice: prices.cashPrice,
    };
  });

  const recommendedTrimId = pickRecommendedTrimId(
    scored.map((s) => ({ trimId: s.trimId, matchPercent: s.matchPercent, rate: s.rate })),
    trims,
    hasWishes,
  );

  const trimLines = buildTrimLineEntries(
    scored,
    trims,
    recommendedTrimId,
    paymentType,
    brand,
    model,
    modelKey,
  );

  const activeTrimId = options.selectedTrimId ?? recommendedTrimId ?? trimLines[0]?.trimId;
  const allPackages = getManufacturerPackages(mfg.key);
  const packages = hasWishes
    ? allPackages
      .map((pkg) => ({
        ...pkg,
        score: scorePackageForWishes(pkg, selectedChipIds, activeTrimId),
        tags: inferPackageTags(pkg),
      }))
      .filter((pkg) => pkg.availableTrims?.includes(activeTrimId) && pkg.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
    : [];

  const recommendedPackages = packages.filter((p) => p.score >= 2).slice(0, 2);
  const trimLine = trimLines.find((t) => t.trimId === activeTrimId) ?? trimLines[0];
  const hasUncertain = trimLines.some((t) => t.uncertain?.length > 0);

  const recommendationLabel = [
    trimLine?.trimName,
    ...recommendedPackages.map((p) => p.name),
  ].filter(Boolean).join(' + ');

  return {
    empty: false,
    hasWishes,
    hasPackages: modelHasEquipmentPackages(brand, model, modelKey),
    uncertain: hasUncertain,
    chipGroups: getEquipmentWishChipGroups(brand, model, modelKey),
    trimLines,
    packages: recommendedPackages,
    recommendation: {
      trimId: activeTrimId,
      trimName: trimLine?.trimName,
      packageIds: recommendedPackages.map((p) => p.id),
      packageNames: recommendedPackages.map((p) => p.name),
      label: recommendationLabel,
      reasons: buildRecommendationReasons({
        trimLine,
        packages: recommendedPackages,
        chipIds: selectedChipIds,
        hasUncertain,
        hasWishes,
      }),
      uncertainNote: hasUncertain
        ? 'Einige Ausstattungsdetails müssen vom Autohaus bestätigt werden.'
        : null,
    },
  };
}

function buildFallbackReasons(trimLine, hasWishes = false) {
  const reasons = [];
  if (trimLine?.badge) {
    reasons.push(`${trimLine.badge} – ${trimLine.trimName}`);
  }
  if (hasWishes && trimLine?.matchPercent > 0) {
    reasons.push(`Passt zu ${trimLine.matchPercent} % Ihrer gewählten Wünsche`);
  } else if (trimLine?.description) {
    reasons.push(trimLine.description);
  } else {
    reasons.push('Passende Ausstattungslinie für Ihren Wunsch');
  }
  return reasons.slice(0, 3);
}

/**
 * Aktive Empfehlung für gewählte Ausstattungslinie (Core, Vision, GT-Line …).
 */
export function resolveActiveEquipmentRecommendation(analysis = {}, activeTrimId = null) {
  const rec = analysis.recommendation;
  const trimLine = analysis.trimLines?.find((line) => line.trimId === activeTrimId)
    ?? analysis.trimLines?.[0];
  if (!trimLine) return rec ?? null;

  const sameAsRecommended = rec?.trimId === trimLine.trimId;
  return {
    trimId: trimLine.trimId,
    trimName: trimLine.trimName,
    packageIds: sameAsRecommended ? (rec?.packageIds ?? []) : [],
    packageNames: sameAsRecommended ? (rec?.packageNames ?? []) : [],
    label: sameAsRecommended && rec?.label ? rec.label : trimLine.trimName,
    reasons: sameAsRecommended && rec?.reasons?.length
      ? rec.reasons
      : buildFallbackReasons(trimLine, analysis.hasWishes),
    uncertainNote: rec?.uncertainNote ?? null,
    matchPercent: trimLine.matchPercent ?? null,
  };
}

export function toggleEquipmentChip(currentFeatureIds, chipId) {
  const chip = getEquipmentWishChip(chipId);
  const globalId = chip?.globalFeatureId ?? chip?.id ?? chipId;
  const legacyIds = chip?.featureIds ?? [];
  const isSelected = currentFeatureIds.includes(globalId)
    || (legacyIds.length > 0 && legacyIds.every((id) => currentFeatureIds.includes(id)));

  if (isSelected) {
    return currentFeatureIds.filter((id) => id !== globalId && !legacyIds.includes(id));
  }
  return [...new Set([...currentFeatureIds, globalId])];
}
