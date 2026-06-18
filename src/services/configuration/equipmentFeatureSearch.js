/**
 * Layer 3: Kundenlogik für Ausstattungssuche.
 * Normalisieren → globales Feature → Modell-Verfügbarkeit → kundenfreundliche Anzeige.
 */
import { getEquipmentWishChip } from '../../data/features/equipmentWishChips.js';
import { getGlobalFeatureById, resolveLegacyFeatureId } from '../../data/features/globalFeatureCatalog.js';
import { FEATURE_AVAILABILITY_STATUS as S } from '../../data/features/modelEquipmentSchema.js';
import { resolveGlobalFeatureFromQuery } from './globalFeatureResolver.js';
import { resolveModelFeatureAvailability } from './modelEquipmentData.js';
import { searchModelEquipmentIndex, stripQuestionPhrases } from './modelEquipmentSearchIndex.js';
import { normalizeEquipmentQuery } from './equipmentQueryUtils.js';

function createSearchId() {
  return `search-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function mapSearchStatusToModelStatus(indexStatus) {
  if (indexStatus === 'standard') return 'standard';
  if (indexStatus === 'package') return 'package';
  if (indexStatus === 'not_available') return 'not_available';
  if (indexStatus === 'available') return 'available';
  if (indexStatus === 'optional') return 'optional';
  return 'unknown';
}

function buildSearchItemFromHit(hit, query, { reserved = false, globalFeatureId = null } = {}) {
  const entry = hit.entry;
  const modelStatus = reserved ? 'reserved' : mapSearchStatusToModelStatus(entry.status);
  return {
    id: createSearchId(),
    globalFeatureId: globalFeatureId ?? entry.globalFeatureId ?? entry.catalogId ?? null,
    featureId: entry.featureId ?? resolveLegacyFeatureId(getGlobalFeatureById(entry.catalogId)),
    catalogId: entry.catalogId ?? entry.globalFeatureId ?? null,
    label: entry.label,
    rawQuery: query,
    modelStatus,
    reserved,
    confidence: reserved ? 'low' : (entry.confidence ?? 'high'),
    availableTrims: entry.availableTrims ?? [],
    availablePackages: entry.availablePackages ?? [],
    packageIds: entry.packageIds ?? [],
    score: hit.score,
    sourceRefs: entry.source ? [entry.source] : [],
  };
}

function formatCustomerWishLabel(query) {
  const label = stripQuestionPhrases(query).trim() || query.trim();
  if (!label) return '';
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function buildReservedItem(query, globalFeature = null) {
  const label = globalFeature?.label ?? formatCustomerWishLabel(query);
  return {
    id: createSearchId(),
    globalFeatureId: globalFeature?.id ?? null,
    featureId: globalFeature ? resolveLegacyFeatureId(globalFeature) : null,
    catalogId: globalFeature?.id ?? null,
    label,
    rawQuery: query,
    modelStatus: 'reserved',
    reserved: true,
    confidence: 'low',
    availableTrims: [],
    availablePackages: [],
    packageIds: [],
  };
}

/**
 * @param {object} hit
 * @param {{ selectedFeatureIds?: string[], searchedFeatures?: object[], selectedChipIds?: string[] }} ctx
 */
export function isEquipmentWishAlreadySelected(hit, ctx = {}) {
  const entry = hit?.entry ?? hit;
  const {
    selectedFeatureIds = [],
    searchedFeatures = [],
    selectedChipIds = [],
  } = ctx;

  const legacyId = entry.featureId;
  const globalId = entry.globalFeatureId ?? entry.catalogId;

  if (globalId && selectedFeatureIds.includes(globalId)) return true;
  if (legacyId && selectedFeatureIds.includes(legacyId)) return true;

  for (const chipId of selectedChipIds) {
    const chip = getEquipmentWishChip(chipId);
    if (chipId === globalId) return true;
    if (globalId && chip?.globalFeatureId === globalId) return true;
    if (legacyId && chip?.featureIds?.includes(legacyId)) return true;
  }

  const labelKey = (entry.label ?? '').toLowerCase();

  return searchedFeatures.some((item) => {
    if (globalId && (item.globalFeatureId === globalId || item.catalogId === globalId)) return true;
    if (legacyId && item.featureId === legacyId) return true;
    if (labelKey && item.label?.toLowerCase() === labelKey) return true;
  });
}

/**
 * Hauptsuche – erkennt Features global, prüft Verfügbarkeit im Modell.
 */
export function searchEquipmentFeature(query, brand, model, modelKey, ctx = {}) {
  const rawQuery = query?.trim() ?? '';
  if (!rawQuery) return { type: 'empty', query: rawQuery };

  const modelResult = searchModelEquipmentIndex(rawQuery, brand, model, modelKey);

  if (modelResult.type === 'catalog_unconfirmed') {
    const feature = modelResult.feature;
    if (isEquipmentWishAlreadySelected(modelResult.hit, ctx)) {
      return {
        type: 'duplicate',
        query: rawQuery,
        message: 'Diese Ausstattung ist bereits ausgewählt.',
      };
    }
    return {
      type: 'unconfirmed',
      query: rawQuery,
      feature,
      message: 'Für dieses Modell aktuell nicht eindeutig gefunden.',
      hint: 'Sie können den Wunsch trotzdem vormerken. Das Autohaus prüft die Verfügbarkeit im Angebot.',
      item: buildSearchItemFromHit(modelResult.hit, rawQuery, { globalFeatureId: feature.id }),
    };
  }

  if (modelResult.type === 'match') {
    if (isEquipmentWishAlreadySelected(modelResult.hit, ctx)) {
      return {
        type: 'duplicate',
        query: rawQuery,
        message: 'Diese Ausstattung ist bereits ausgewählt.',
      };
    }
    return {
      type: 'match',
      query: rawQuery,
      item: buildSearchItemFromHit(modelResult.hit, rawQuery),
    };
  }

  if (modelResult.type === 'ambiguous') {
    const suggestions = modelResult.suggestions
      .filter((hit) => !isEquipmentWishAlreadySelected(hit, ctx))
      .map((hit) => buildSearchItemFromHit(hit, rawQuery));
    if (!suggestions.length) {
      return {
        type: 'duplicate',
        query: rawQuery,
        message: 'Diese Ausstattung ist bereits ausgewählt.',
      };
    }
    return {
      type: 'ambiguous',
      query: rawQuery,
      message: 'Was meinen Sie genau?',
      suggestions,
    };
  }

  const recognition = resolveGlobalFeatureFromQuery(rawQuery);
  if (recognition.type === 'match' || recognition.type === 'ambiguous') {
    return {
      type: 'not_found',
      query: rawQuery,
      message: 'Dazu finden wir aktuell keinen eindeutigen Treffer.',
      hint: 'Sie können den Wunsch trotzdem vormerken. Das Autohaus prüft die Verfügbarkeit im Angebot.',
    };
  }

  return {
    type: 'not_found',
    query: rawQuery,
    message: 'Dazu finden wir aktuell keinen eindeutigen Treffer.',
    hint: 'Sie können den Wunsch trotzdem vormerken. Das Autohaus prüft die Verfügbarkeit im Angebot.',
  };
}

export function createReservedSearchItem(query, globalFeature = null) {
  return buildReservedItem(query, globalFeature);
}

/** @deprecated Nur für Tests */
export function findEquipmentCatalogMatch(query) {
  const normalized = normalizeEquipmentQuery(query);
  if (!normalized.normalized || normalized.normalized.length < 3) return null;

  const result = resolveGlobalFeatureFromQuery(query);
  if (result.type !== 'match') return null;
  return { entry: result.feature, score: result.score };
}

export {
  resolveFeatureAvailabilityForModel,
  resolveModelFeatureAvailability,
  getModelEquipmentProfile,
} from './modelEquipmentData.js';

export function isSearchItemConfirmed(item) {
  return ['standard', 'available', 'package', 'optional'].includes(item?.modelStatus);
}

export function isSearchItemPending(item) {
  return Boolean(
    item?.reserved
    || item?.modelStatus === 'reserved'
    || item?.modelStatus === 'unknown',
  );
}

export function isSearchItemUnavailable(item) {
  return item?.modelStatus === 'not_available';
}

export function searchedFeatureToWishFeature(searchItem) {
  if (!searchItem) return null;

  if (searchItem.reserved || searchItem.modelStatus === 'reserved') {
    return {
      featureId: searchItem.featureId,
      globalFeatureId: searchItem.globalFeatureId ?? searchItem.catalogId,
      label: searchItem.label,
      uncertain: true,
      pending: true,
      missing: false,
      catalogOnly: false,
      advisorRelevant: false,
    };
  }

  if (searchItem.modelStatus === 'not_available') {
    return {
      featureId: searchItem.featureId,
      globalFeatureId: searchItem.globalFeatureId ?? searchItem.catalogId,
      label: searchItem.label,
      uncertain: false,
      pending: false,
      missing: true,
      catalogOnly: false,
      advisorRelevant: false,
    };
  }

  const feature = getGlobalFeatureById(searchItem.globalFeatureId ?? searchItem.catalogId);
  const advisorRelevant = feature?.advisorRelevant ?? true;

  const countable = isSearchItemConfirmed(searchItem);
  if (countable && searchItem.featureId) {
    return {
      featureId: searchItem.featureId,
      globalFeatureId: searchItem.globalFeatureId ?? searchItem.catalogId,
      label: searchItem.label,
      uncertain: false,
      pending: false,
      missing: false,
      catalogOnly: false,
      advisorRelevant,
    };
  }

  if (countable && (searchItem.catalogId || searchItem.globalFeatureId)) {
    return {
      featureId: searchItem.featureId,
      globalFeatureId: searchItem.globalFeatureId ?? searchItem.catalogId,
      catalogId: searchItem.catalogId ?? searchItem.globalFeatureId,
      label: searchItem.label,
      uncertain: false,
      pending: false,
      missing: false,
      catalogOnly: !searchItem.featureId,
      modelStatus: searchItem.modelStatus,
      advisorRelevant,
    };
  }

  return {
    featureId: searchItem.featureId,
    globalFeatureId: searchItem.globalFeatureId ?? searchItem.catalogId,
    label: searchItem.label,
    uncertain: true,
    pending: true,
    missing: false,
    catalogOnly: false,
    advisorRelevant: false,
  };
}

export function mergeSearchedIntoFeatureIds(chipFeatureIds = [], searchedItems = []) {
  const ids = new Set(chipFeatureIds);
  const uncertainLabels = [];
  const missingLabels = [];
  const confirmedCatalogWishes = [];

  for (const item of searchedItems) {
    const wish = searchedFeatureToWishFeature(item);
    if (!wish) continue;
    if (!wish.advisorRelevant) continue;
    if (wish.missing) {
      missingLabels.push(wish.label);
    } else if (wish.catalogOnly) {
      confirmedCatalogWishes.push({
        catalogId: wish.catalogId ?? wish.globalFeatureId,
        label: wish.label,
        modelStatus: wish.modelStatus,
      });
    } else if (wish.featureId) {
      ids.add(wish.featureId);
      if (wish.pending || wish.uncertain) {
        uncertainLabels.push(wish.label);
      }
    } else if (wish.pending) {
      uncertainLabels.push(wish.label);
    }
  }

  return {
    featureIds: [...ids],
    uncertainLabels: [...new Set(uncertainLabels)],
    missingLabels: [...new Set(missingLabels)],
    confirmedCatalogWishes,
  };
}

export function getSearchedFeatureStatusCopy(item) {
  if (!item) return { statusLine: 'wird geprüft', hint: null };

  const trimNames = [...new Set(item.availableTrims?.map((t) => t.trimName) ?? [])];
  const pkgNames = [...new Set(item.availablePackages?.map((p) => p.name) ?? [])];

  if (isSearchItemPending(item)) {
    return {
      statusLine: 'wird geprüft',
      hint: 'Das Autohaus bestätigt die Verfügbarkeit im Angebot.',
    };
  }

  if (isSearchItemUnavailable(item)) {
    return {
      statusLine: 'nicht verfügbar',
      hint: 'Diese Ausstattung ist bei diesem Modell nicht verfügbar.',
    };
  }

  if (item.modelStatus === 'package') {
    const pkgLabel = pkgNames[0];
    return {
      statusLine: pkgLabel ? `über ${pkgLabel} erhältlich` : 'über ein Paket erhältlich',
      hint: trimNames.length
        ? `Verfügbar bei: ${trimNames.join(', ')}`
        : 'Das Paket enthält diese Ausstattung.',
    };
  }

  if (isSearchItemConfirmed(item)) {
    if (trimNames.length === 1) {
      return {
        statusLine: `verfügbar ab ${trimNames[0]}`,
        hint: 'Diese Ausstattung ist in der genannten Ausstattungslinie enthalten.',
      };
    }
    if (trimNames.length > 1) {
      return {
        statusLine: 'verfügbar',
        hint: `Verfügbar bei: ${trimNames.join(', ')}`,
      };
    }
    if (item.modelStatus === 'optional') {
      return {
        statusLine: 'optional verfügbar',
        hint: 'Diese Ausstattung kann bei diesem Modell ergänzt werden.',
      };
    }
    return {
      statusLine: 'verfügbar',
      hint: 'Diese Ausstattung ist verfügbar.',
    };
  }

  return {
    statusLine: 'wird geprüft',
    hint: 'Das Autohaus bestätigt die Verfügbarkeit im Angebot.',
  };
}
