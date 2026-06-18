/**
 * Verkäufer-Suche: Modell + Feature in einem Feld erkennen und prüfen.
 */
import { SALES_EQUIPMENT_MODELS } from '../../data/equipment/equipmentSalesModelCatalog.js';
import { FEATURE_AVAILABILITY_STATUS as S } from '../../data/features/modelEquipmentSchema.js';
import { resolveGlobalFeatureFromQuery } from '../configuration/globalFeatureResolver.js';
import { normalizeEquipmentQuery, scoreSearchPattern } from '../configuration/equipmentQueryUtils.js';
import { resolveModelFeatureAvailability } from '../configuration/modelEquipmentData.js';
import { getImportedModelEquipmentProfile } from '../configuration/equipmentImportRegistry.js';
import { getSearchedFeatureStatusCopy } from '../configuration/equipmentFeatureSearch.js';
import {
  buildFeatureSourceDetailFromSearch,
  hasInspectableSource,
  normalizeInspectorSourceRef,
} from './equipmentInspectorSourcePresenter.js';
import { loadInspectorModelContext } from './equipmentInspectorPresenter.js';

const SALES_STATUS_HEADLINES = {
  [S.STANDARD]: 'serienmäßig',
  [S.AVAILABLE]: 'verfügbar',
  [S.OPTIONAL]: 'optional verfügbar',
  [S.PACKAGE_REQUIRED]: 'über Paket erhältlich',
  [S.NOT_AVAILABLE]: 'nicht verfügbar',
  [S.UNKNOWN]: 'wird geprüft',
};

/**
 * @param {import('../../data/equipment/equipmentSalesModelCatalog.js').typeof SALES_EQUIPMENT_MODELS[0]} modelEntry
 * @param {ReturnType<typeof normalizeEquipmentQuery>} normalizedQuery
 */
function scoreModelMatch(modelEntry, normalizedQuery) {
  const patterns = [
    `${modelEntry.brand} ${modelEntry.model}`,
    modelEntry.model,
    modelEntry.modelKey,
    ...(modelEntry.searchTerms ?? []),
  ];

  let best = 0;
  for (const pattern of patterns) {
    best = Math.max(best, scoreSearchPattern(normalizedQuery, pattern));
  }
  return best;
}

/**
 * @param {string} rawQuery
 * @param {object} modelEntry
 */
function extractFeatureQuery(rawQuery, modelEntry) {
  let remainder = rawQuery;
  const replacements = [
    `${modelEntry.brand} ${modelEntry.model}`,
    modelEntry.model,
    ...(modelEntry.searchTerms ?? []),
  ].sort((a, b) => b.length - a.length);

  for (const phrase of replacements) {
    if (!phrase) continue;
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    remainder = remainder.replace(new RegExp(escaped, 'ig'), ' ').replace(/\s+/g, ' ').trim();
  }

  return remainder || rawQuery.trim();
}

/**
 * @param {object} modelEntry
 */
function findModelMatches(normalizedQuery) {
  return SALES_EQUIPMENT_MODELS
    .map((modelEntry) => ({ modelEntry, score: scoreModelMatch(modelEntry, normalizedQuery) }))
    .filter((hit) => hit.score >= 55)
    .sort((a, b) => b.score - a.score);
}

/**
 * @param {import('../configuration/globalFeatureResolver.js').resolveGlobalFeatureFromQuery extends Function ? ReturnType<import('../configuration/globalFeatureResolver.js').resolveGlobalFeatureFromQuery> : never} recognition
 */
function mapRecognitionFeature(recognition) {
  if (recognition.type === 'match') return recognition.feature;
  if (recognition.type === 'ambiguous') return recognition.suggestions?.[0] ?? null;
  return null;
}

/**
 * @param {object} entry
 */
export function describeSalesTrimLine(entry) {
  const trimName = entry.trimName ?? entry.trimId ?? '—';
  if (entry.status === S.STANDARD) return `${trimName}: serienmäßig`;
  if (entry.status === S.AVAILABLE) return `${trimName}: verfügbar`;
  if (entry.status === S.OPTIONAL) return `${trimName}: optional verfügbar`;
  if (entry.status === S.PACKAGE_REQUIRED) {
    const pkg = entry.packageName ?? 'Paket';
    return `${trimName}: über ${pkg}`;
  }
  if (entry.status === S.NOT_AVAILABLE) return `${trimName}: nicht verfügbar`;
  return `${trimName}: wird geprüft`;
}

/**
 * @param {import('../../data/features/modelEquipmentSchema.js').ResolvedModelFeatureAvailability | null} availability
 */
export function buildSalesStatusHeadline(availability) {
  if (!availability) return 'wird geprüft';

  if (availability.modelStatus === S.PACKAGE_REQUIRED) {
    const pkg = availability.availablePackages?.[0]?.name;
    return pkg ? `über ${pkg} erhältlich` : SALES_STATUS_HEADLINES[S.PACKAGE_REQUIRED];
  }

  if (availability.modelStatus === S.AVAILABLE || availability.modelStatus === S.STANDARD) {
    const trims = [...new Set((availability.availableTrims ?? []).map((t) => t.trimName).filter(Boolean))];
    if (trims.length === 1) {
      const prefix = availability.modelStatus === S.STANDARD ? 'serienmäßig ab' : 'verfügbar ab';
      return `${prefix} ${trims[0]}`;
    }
  }

  return SALES_STATUS_HEADLINES[availability.modelStatus] ?? 'wird geprüft';
}

/**
 * @param {object} params
 */
export function buildSalesCustomerText({
  featureLabel,
  brand,
  model,
  availability,
}) {
  const vehicle = `${brand} ${model}`.trim();

  if (!availability || availability.modelStatus === S.UNKNOWN) {
    return `Das ${featureLabel} ist für den ${vehicle} optional verfügbar und wird je nach Ausstattungslinie bzw. Paket angeboten. Ich prüfe Ihnen gerne die passende Variante im Angebot.`;
  }

  if (availability.modelStatus === S.NOT_AVAILABLE) {
    return `Das ${featureLabel} ist für diese Variante nach aktuellem Datenstand nicht verfügbar.`;
  }

  if (availability.modelStatus === S.PACKAGE_REQUIRED) {
    const pkg = availability.availablePackages?.[0]?.name ?? 'passende Paket';
    return `Das ${featureLabel} ist beim ${vehicle} über das ${pkg} erhältlich.`;
  }

  if (availability.modelStatus === S.STANDARD) {
    const trims = [...new Set((availability.availableTrims ?? []).map((t) => t.trimName).filter(Boolean))];
    if (trims.length === 1) {
      return `Das ${featureLabel} ist beim ${vehicle} ab ${trims[0]} serienmäßig verfügbar.`;
    }
    return `Das ${featureLabel} ist beim ${vehicle} serienmäßig verfügbar.`;
  }

  const trims = [...new Set((availability.availableTrims ?? []).map((t) => t.trimName).filter(Boolean))];
  if (trims.length === 1) {
    return `Das ${featureLabel} ist beim ${vehicle} ab ${trims[0]} verfügbar.`;
  }

  if (availability.modelStatus === S.OPTIONAL) {
    return `Das ${featureLabel} ist beim ${vehicle} optional verfügbar.`;
  }

  return `Das ${featureLabel} ist beim ${vehicle} verfügbar.`;
}

/**
 * @param {object} params
 */
export function buildSalesOfferPayload({
  feature,
  modelEntry,
  availability,
  customerText,
  modelYear = null,
}) {
  const primaryEntry = availability?.entries?.[0] ?? null;
  return {
    featureId: feature.id,
    featureLabel: feature.label,
    modelKey: modelEntry.modelKey,
    brand: modelEntry.brand,
    model: modelEntry.model,
    modelYear,
    status: availability?.modelStatus ?? S.UNKNOWN,
    trimId: primaryEntry?.trimId ?? null,
    packageId: primaryEntry?.packageId ?? null,
    customerSafeText: customerText,
    sourceRef: normalizeInspectorSourceRef(primaryEntry?.sourceRef),
  };
}

/**
 * @param {object} modelEntry
 * @param {object} feature
 * @param {import('../../data/features/modelEquipmentSchema.js').ResolvedModelFeatureAvailability | null} availability
 */
function buildSalesMatchResult(modelEntry, feature, availability, featureQuery) {
  const profile = getImportedModelEquipmentProfile(modelEntry.modelKey);
  const modelYear = profile?.modelYear ?? null;
  const trimLines = (availability?.entries ?? []).map(describeSalesTrimLine);
  const customerText = buildSalesCustomerText({
    featureLabel: feature.label,
    brand: modelEntry.brand,
    model: modelEntry.model,
    availability,
  });

  const isPending = !availability || availability.modelStatus === S.UNKNOWN;
  const internalEntries = (availability?.entries ?? []).map((entry) => ({
    ...entry,
    sourceRef: normalizeInspectorSourceRef(entry.sourceRef),
  }));

  const searchLike = {
    type: 'match',
    feature,
    availability,
    internalEntries,
    customerCopy: availability
      ? getSearchedFeatureStatusCopy({
        label: feature.label,
        modelStatus: mapModelStatusToCustomer(availability.modelStatus),
        availableTrims: availability.availableTrims,
        availablePackages: availability.availablePackages,
      })
      : null,
    hasInspectableSource: internalEntries.some((entry) => hasInspectableSource(
      normalizeInspectorSourceRef(entry.sourceRef),
    )),
  };

  const ctx = loadInspectorModelContext(modelEntry.modelKey);
  const sourceDetail = buildFeatureSourceDetailFromSearch(searchLike, ctx);

  return {
    type: isPending ? 'pending' : 'match',
    featureQuery,
    modelEntry,
    feature,
    availability,
    modelYear,
    statusHeadline: buildSalesStatusHeadline(availability),
    trimLines,
    customerText,
    hasSource: sourceDetail.hasSource,
    sourceDetail,
    offerPayload: buildSalesOfferPayload({
      feature,
      modelEntry,
      availability,
      customerText,
      modelYear,
    }),
    pendingNote: isPending
      ? 'Clever hat das Feature erkannt, aber für dieses Modell noch keine sichere Zuordnung gefunden.'
      : null,
  };
}

function mapModelStatusToCustomer(modelStatus) {
  if (modelStatus === S.STANDARD) return 'standard';
  if (modelStatus === S.AVAILABLE) return 'available';
  if (modelStatus === S.OPTIONAL) return 'optional';
  if (modelStatus === S.PACKAGE_REQUIRED) return 'package';
  if (modelStatus === S.NOT_AVAILABLE) return 'not_available';
  return 'unknown';
}

/**
 * @param {string} query
 * @param {{ modelKey?: string }} [options] – festes Modell nach Auswahl
 */
export function searchSalesEquipment(query, options = {}) {
  const rawQuery = query?.trim() ?? '';
  if (!rawQuery) return { type: 'empty', query: rawQuery };

  const normalized = normalizeEquipmentQuery(rawQuery);

  if (options.modelKey) {
    const modelEntry = SALES_EQUIPMENT_MODELS.find((entry) => entry.modelKey === options.modelKey);
    if (!modelEntry) return { type: 'not_recognized', query: rawQuery };
    const featureQuery = extractFeatureQuery(rawQuery, modelEntry);
    const recognition = resolveGlobalFeatureFromQuery(featureQuery);
    if (recognition.type === 'not_recognized' || recognition.type === 'empty') {
      return { type: 'not_recognized', query: rawQuery, modelEntry, featureQuery };
    }
    const feature = mapRecognitionFeature(recognition);
    if (!feature) {
      return {
        type: 'ambiguous_feature',
        query: rawQuery,
        modelEntry,
        featureQuery,
        suggestions: recognition.suggestions ?? [],
      };
    }
    const availability = resolveModelFeatureAvailability(
      modelEntry.brand,
      modelEntry.model,
      modelEntry.modelKey,
      feature.id,
    );
    return buildSalesMatchResult(modelEntry, feature, availability, featureQuery);
  }

  const modelMatches = findModelMatches(normalized);

  if (modelMatches.length === 0) {
    const recognition = resolveGlobalFeatureFromQuery(rawQuery);
    if (recognition.type === 'not_recognized' || recognition.type === 'empty') {
      return { type: 'not_recognized', query: rawQuery };
    }
    const feature = mapRecognitionFeature(recognition);
    return {
      type: 'needs_model',
      query: rawQuery,
      feature,
      featureQuery: rawQuery,
      message: 'Bitte Modell auswählen',
      modelSuggestions: SALES_EQUIPMENT_MODELS.slice(0, 6),
    };
  }

  const top = modelMatches[0];
  const close = modelMatches.filter((hit) => hit.score >= top.score - 8 && hit.modelEntry.modelKey !== top.modelEntry.modelKey);

  if (close.length >= 1) {
    const featureQuery = extractFeatureQuery(rawQuery, top.modelEntry);
    const recognition = resolveGlobalFeatureFromQuery(featureQuery);
    const feature = mapRecognitionFeature(recognition);
    return {
      type: 'ambiguous_model',
      query: rawQuery,
      featureQuery,
      feature,
      message: 'Meinten Sie?',
      modelSuggestions: [top, ...close].map((hit) => hit.modelEntry),
    };
  }

  const modelEntry = top.modelEntry;
  const featureQuery = extractFeatureQuery(rawQuery, modelEntry);
  const recognition = resolveGlobalFeatureFromQuery(featureQuery);

  if (recognition.type === 'not_recognized' || recognition.type === 'empty') {
    return {
      type: 'not_recognized',
      query: rawQuery,
      modelEntry,
      featureQuery,
    };
  }

  if (recognition.type === 'ambiguous') {
    return {
      type: 'ambiguous_feature',
      query: rawQuery,
      modelEntry,
      featureQuery,
      suggestions: recognition.suggestions,
    };
  }

  const feature = recognition.feature;
  const availability = resolveModelFeatureAvailability(
    modelEntry.brand,
    modelEntry.model,
    modelEntry.modelKey,
    feature.id,
  );

  return buildSalesMatchResult(modelEntry, feature, availability, featureQuery);
}

/**
 * @param {object} payload
 * @deprecated Nutze equipmentOfferTransferService.transferEquipmentWishToLead
 */
export function transferSalesEquipmentToOffer(payload) {
  console.log('[equipmentSalesSearch] Legacy transfer payload', payload);
  return payload;
}

/**
 * @param {object} reviewCase
 */
export function markSalesEquipmentReviewCase(reviewCase) {
  console.log('[equipmentSalesSearch] Als Prüffall markieren', reviewCase);
  return reviewCase;
}

/**
 * @param {string} text
 */
export function salesCustomerTextIsClean(text) {
  if (!text) return true;
  const blob = text.toLowerCase();
  const forbidden = ['rawtext', 'pdf', 'seite', 'abschnitt', 'confidence', 'document:', 'source.ref'];
  return !forbidden.some((token) => blob.includes(token));
}
