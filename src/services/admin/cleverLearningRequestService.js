/**
 * Clever Lernfragen – Verkäufer-Feedback bei unsicheren Antworten.
 * Persistenz: localStorage + Memory (Tests).
 */
import { getSearchableGlobalFeatures } from '../../data/features/globalFeatureCatalog.js';
import { resolveGlobalFeatureFromQuery } from '../configuration/globalFeatureResolver.js';
import { normalizeEquipmentQuery, scoreSearchPattern } from '../configuration/equipmentQueryUtils.js';

export const LEARNING_REQUEST_STORAGE_KEY = 'clever-learning-requests';

export const LEARNING_REQUEST_STATUSES = {
  OPEN: 'open',
  IN_REVIEW: 'in_review',
  RESOLVED: 'resolved',
  IGNORED: 'ignored',
};

export const LEARNING_SOURCE_AREAS = {
  LEXICON: 'lexicon',
  CUSTOMER_EQUIPMENT_SEARCH: 'customer_equipment_search',
  DEALER_EQUIPMENT_SEARCH: 'dealer_equipment_search',
  CONFIGURATOR: 'configurator',
  CUSTOMER_AKTE: 'customer_akte',
};

/** @type {object[] | null} */
let memoryStore = null;

function uid() {
  return `clr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function readLocalStorage() {
  if (typeof window === 'undefined') return memoryStore ? [...memoryStore] : [];
  try {
    const raw = window.localStorage.getItem(LEARNING_REQUEST_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function readAll() {
  if (memoryStore) return [...memoryStore];
  return readLocalStorage();
}

function writeAll(items) {
  const next = [...items];
  if (typeof window === 'undefined') {
    memoryStore = next;
    return;
  }
  try {
    window.localStorage.setItem(LEARNING_REQUEST_STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent('clever-learning-requests-changed'));
  } catch {
    memoryStore = next;
  }
}

/** Nur für Tests. */
export function resetLearningRequestsStore() {
  memoryStore = [];
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(LEARNING_REQUEST_STORAGE_KEY);
    } catch {
      // ignore
    }
  }
}

/** @param {string} query */
export function buildPossibleFeatureCandidates(query, limit = 5) {
  const normalized = normalizeEquipmentQuery(query);
  const recognition = resolveGlobalFeatureFromQuery(query);

  if (recognition.type === 'match' && recognition.feature) {
    return [{
      id: recognition.feature.id,
      label: recognition.feature.label,
      score: recognition.score ?? 100,
      source: 'recognition',
    }];
  }

  if (recognition.type === 'ambiguous' && recognition.suggestions?.length) {
    return recognition.suggestions.slice(0, limit).map((f) => ({
      id: f.id,
      label: f.label,
      score: 80,
      source: 'ambiguous',
    }));
  }

  return getSearchableGlobalFeatures()
    .map((feature) => {
      const patterns = [feature.label, ...(feature.synonyms ?? [])];
      let best = 0;
      for (const pattern of patterns) {
        best = Math.max(best, scoreSearchPattern(normalized, pattern));
      }
      return { id: feature.id, label: feature.label, score: best, source: 'catalog' };
    })
    .filter((hit) => hit.score >= 45)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function buildDedupeKey({ normalizedQuery, modelKey, sourceArea }) {
  return [
    String(normalizedQuery ?? '').toLowerCase(),
    modelKey ?? '',
    sourceArea ?? '',
  ].join('::');
}

/**
 * @param {object} input
 */
export function findExistingLearningRequest(input) {
  const normalizedQuery = normalizeEquipmentQuery(input.query ?? '');
  const key = buildDedupeKey({
    normalizedQuery,
    modelKey: input.modelKey ?? null,
    sourceArea: input.sourceArea ?? null,
  });

  return readAll().find((item) => {
    if (item.dedupeKey !== key) return false;
    return item.status === LEARNING_REQUEST_STATUSES.OPEN
      || item.status === LEARNING_REQUEST_STATUSES.IN_REVIEW;
  }) ?? null;
}

/**
 * @param {object} input
 * @returns {{ created: boolean, duplicate: boolean, request: object, message: string }}
 */
export function createLearningRequest(input = {}) {
  const query = String(input.query ?? '').trim();
  if (!query) {
    return { created: false, duplicate: false, request: null, message: 'Keine Anfrage angegeben.' };
  }

  const normalizedQuery = normalizeEquipmentQuery(query);
  const candidates = input.possibleFeatureCandidates
    ?? buildPossibleFeatureCandidates(query);
  const suggestedGlobalFeatureIds = input.suggestedGlobalFeatureIds
    ?? candidates.map((c) => c.id).filter(Boolean);

  const existing = findExistingLearningRequest({
    query,
    modelKey: input.modelKey ?? null,
    sourceArea: input.sourceArea ?? null,
  });

  const reporterId = input.userId ?? input.reporterId ?? 'anonymous';
  const now = new Date().toISOString();

  if (existing) {
    const items = readAll();
    const next = items.map((item) => {
      if (item.id !== existing.id) return item;
      const reporterIds = [...new Set([...(item.reporterIds ?? []), reporterId])];
      return {
        ...item,
        existingRequestCount: (item.existingRequestCount ?? 1) + 1,
        lastReportedAt: now,
        reporterIds,
        possibleFeatureCandidates: candidates.length ? candidates : item.possibleFeatureCandidates,
        suggestedGlobalFeatureIds: suggestedGlobalFeatureIds.length
          ? suggestedGlobalFeatureIds
          : item.suggestedGlobalFeatureIds,
      };
    });
    writeAll(next);
    const updated = next.find((item) => item.id === existing.id);
    return {
      created: false,
      duplicate: true,
      request: updated,
      message: 'Danke – diese Frage wurde bereits vorgemerkt.',
    };
  }

  const request = {
    id: uid(),
    createdAt: now,
    lastReportedAt: now,
    query,
    rawQuery: query,
    normalizedQuery,
    dedupeKey: buildDedupeKey({
      normalizedQuery,
      modelKey: input.modelKey ?? null,
      sourceArea: input.sourceArea ?? null,
    }),
    modelKey: input.modelKey ?? null,
    modelLabel: input.modelLabel ?? null,
    detectedIntent: input.detectedIntent ?? null,
    detectedFeatureId: input.detectedFeatureId ?? null,
    pageContext: input.pageContext ?? null,
    sourceArea: input.sourceArea ?? null,
    dealerId: input.dealerId ?? null,
    dealerName: input.dealerName ?? null,
    userId: input.userId ?? null,
    userName: input.userName ?? null,
    leadId: input.leadId ?? null,
    customerId: input.customerId ?? null,
    status: LEARNING_REQUEST_STATUSES.OPEN,
    notes: input.notes ?? null,
    existingRequestCount: 1,
    reporterIds: [reporterId],
    possibleFeatureCandidates: candidates,
    suggestedGlobalFeatureIds,
  };

  writeAll([request, ...readAll()]);
  return {
    created: true,
    duplicate: false,
    request,
    message: 'Danke – wurde zur Prüfung vorgemerkt.',
  };
}

/**
 * @param {{ status?: string, sourceArea?: string, modelKey?: string }} [filter]
 */
export function listLearningRequests(filter = {}) {
  let items = readAll();
  if (filter.status) {
    items = items.filter((item) => item.status === filter.status);
  }
  if (filter.sourceArea) {
    items = items.filter((item) => item.sourceArea === filter.sourceArea);
  }
  if (filter.modelKey) {
    items = items.filter((item) => item.modelKey === filter.modelKey);
  }
  return items.sort(
    (a, b) => new Date(b.lastReportedAt ?? b.createdAt) - new Date(a.lastReportedAt ?? a.createdAt),
  );
}

export function updateLearningRequestStatus(id, status, extra = {}) {
  const items = readAll();
  const next = items.map((item) => (
    item.id === id
      ? {
        ...item,
        status,
        ...extra,
        resolvedAt: status === LEARNING_REQUEST_STATUSES.RESOLVED
          ? (extra.resolvedAt ?? new Date().toISOString())
          : item.resolvedAt,
      }
      : item
  ));
  writeAll(next);
  return next.find((item) => item.id === id) ?? null;
}

export function markLearningRequestResolved(id, notes = null) {
  return updateLearningRequestStatus(id, LEARNING_REQUEST_STATUSES.RESOLVED, { notes });
}

export function ignoreLearningRequest(id, notes = null) {
  return updateLearningRequestStatus(id, LEARNING_REQUEST_STATUSES.IGNORED, { notes });
}

export function countOpenLearningRequests() {
  return listLearningRequests().filter(
    (item) => item.status === LEARNING_REQUEST_STATUSES.OPEN
      || item.status === LEARNING_REQUEST_STATUSES.IN_REVIEW,
  ).length;
}

/** Lexikon: unsichere oder fehlende Antwort */
export function lexiconNeedsLearningFeedback(searchState) {
  if (!searchState) return false;
  if (!searchState.ok) return true;
  const result = searchState.result ?? {};
  if (result.confidence === 'low') return true;
  if (result.warnings?.length > 0 && !result.primaryFacts?.length && !result.availabilityByTrim?.length) {
    return true;
  }
  if (
    ['equipment', 'package'].includes(result.intentType)
    && !result.availabilityByTrim?.length
    && result.confidence !== 'high'
  ) {
    return true;
  }
  return false;
}

/** Verkäufer-Ausstattungssuche */
export function dealerEquipmentSearchNeedsLearningFeedback(result) {
  if (!result) return false;
  if (['not_recognized', 'needs_model'].includes(result.type)) return true;
  if (result.type === 'pending') return true;
  return false;
}

/** Kunden-Ausstattungssuche (Konfigurator) */
export function customerEquipmentSearchNeedsLearningFeedback(searchState) {
  if (!searchState) return false;
  return ['not_found', 'unconfirmed'].includes(searchState.type);
}
