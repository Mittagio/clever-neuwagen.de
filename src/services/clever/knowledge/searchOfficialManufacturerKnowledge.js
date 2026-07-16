/**
 * Offizielle Hersteller-Websuche (Stufe 2) – keine Registry-Persistenz.
 */
import {
  getAllowedDomainsForBrand,
  isAllowedOfficialDomain,
  resolveBrandKeyFromModelKey,
} from '../../../config/officialManufacturerDomains.js';
import { getVerifiedVehicleFacts } from '../openai/tools/getVerifiedVehicleFacts.js';
import { buildOfficialSearchQuery } from './redactVehicleQuery.js';
import {
  buildOfficialWebCacheKey,
  getOfficialWebCacheEntry,
  resolveOfficialWebCacheTtlMs,
  setOfficialWebCacheEntry,
} from './officialWebSearchCache.js';

function evidenceIdFor(brandKey, modelKey, variantKey, factKey, sourceUrl) {
  const hash = String(sourceUrl ?? 'unknown').slice(-24);
  return `evidence:web:${brandKey}:${modelKey}:${variantKey ?? 'default'}:${factKey}:${hash}`;
}

/**
 * @param {object} hit
 * @param {string} brandKey
 */
export function normalizeOfficialWebHit(hit, brandKey) {
  const sourceUrl = hit.sourceUrl ?? hit.url ?? null;
  if (!sourceUrl || !isAllowedOfficialDomain(sourceUrl, brandKey)) {
    return null;
  }
  const sourceDomain = new URL(sourceUrl).hostname.replace(/^www\./, '');
  return {
    evidenceId: evidenceIdFor(brandKey, hit.modelKey, hit.variantKey, hit.factKey, sourceUrl),
    sourceTier: 'official_web',
    brandKey,
    modelKey: hit.modelKey,
    variantKey: hit.variantKey ?? null,
    factKey: hit.factKey,
    value: hit.value,
    unit: hit.unit ?? null,
    sourceUrl,
    sourceTitle: hit.sourceTitle ?? hit.title ?? null,
    sourceDomain,
    retrievedAt: new Date().toISOString(),
    status: 'provisional_official_source',
  };
}

/**
 * Vergleicht interne und offizielle Werte – erkennt Konflikte.
 * @param {object[]} internalFacts
 * @param {object[]} officialEvidence
 */
export function detectInternalOfficialConflicts(internalFacts = [], officialEvidence = []) {
  const conflicts = [];
  for (const web of officialEvidence) {
    const internal = internalFacts.find((f) => f.key === web.factKey);
    if (!internal || internal.value == null) continue;
    const internalValue = typeof internal.value === 'object'
      ? JSON.stringify(internal.value)
      : String(internal.value);
    const webValue = typeof web.value === 'object'
      ? JSON.stringify(web.value)
      : String(web.value);
    if (internalValue !== webValue) {
      conflicts.push({
        factKey: web.factKey,
        internalValue: internal.value,
        officialValue: web.value,
        evidenceId: web.evidenceId,
      });
    }
  }
  return conflicts;
}

/**
 * @param {object} params
 * @param {string} params.brandKey
 * @param {string} params.modelKey
 * @param {string|null} [params.variantKey]
 * @param {string[]} [params.requestedFacts]
 * @param {string} [params.market]
 * @param {string} [params.locale]
 * @param {object} [deps]
 */
export async function searchOfficialManufacturerKnowledge(params = {}, deps = {}) {
  const {
    brandKey = resolveBrandKeyFromModelKey(params.modelKey),
    modelKey,
    variantKey = null,
    requestedFacts = [],
    market = 'DE',
    locale = 'de-DE',
  } = params;

  const env = deps.env ?? process.env;
  const webSearchEnabled = env.CLEVER_OFFICIAL_WEB_SEARCH_ENABLED === 'true';

  if (!modelKey || !requestedFacts.length) {
    return { status: 'not_found', evidence: [], skippedReason: 'missing_params' };
  }

  const internalResult = getVerifiedVehicleFacts({
    modelKey,
    variantKey,
    requestedFacts,
  });
  const internalFacts = internalResult.facts ?? [];
  const missingFacts = requestedFacts.filter(
    (factKey) => !internalFacts.some((f) => f.key === factKey),
  );

  if (!missingFacts.length) {
    return {
      status: 'found',
      evidence: [],
      skippedReason: 'internal_verified_available',
      internalFacts,
    };
  }

  if (!webSearchEnabled) {
    return {
      status: 'not_found',
      evidence: [],
      missingFacts,
      skippedReason: 'web_search_disabled',
      internalFacts,
    };
  }

  const cacheKey = buildOfficialWebCacheKey({
    brandKey,
    modelKey,
    variantKey,
    requestedFacts: missingFacts,
    market,
    locale,
  });
  const cached = getOfficialWebCacheEntry(cacheKey);
  if (cached) {
    return { ...cached, fromCache: true };
  }

  const allowedDomains = getAllowedDomainsForBrand(brandKey);
  if (!allowedDomains.length) {
    return {
      status: 'not_found',
      evidence: [],
      missingFacts,
      skippedReason: 'no_allowed_domains',
      internalFacts,
    };
  }

  const query = buildOfficialSearchQuery({
    brandKey,
    modelKey,
    variantKey,
    requestedFacts: missingFacts,
    market,
  });

  const performSearch = deps.performOfficialWebSearch
    ?? defaultPerformOfficialWebSearch;
  const rawHits = await performSearch({
    query,
    brandKey,
    modelKey,
    variantKey,
    requestedFacts: missingFacts,
    allowedDomains,
    market,
    locale,
    apiKey: env.OPENAI_API_KEY ?? null,
  }, deps);

  const evidence = (rawHits ?? [])
    .map((hit) => normalizeOfficialWebHit({ ...hit, modelKey, variantKey }, brandKey))
    .filter(Boolean);

  const conflicts = detectInternalOfficialConflicts(internalFacts, evidence);
  let status = 'not_found';
  if (evidence.length && conflicts.length) {
    status = 'conflicting';
  } else if (evidence.length) {
    status = 'found';
  }

  const result = {
    status,
    evidence,
    missingFacts,
    internalFacts,
    conflicts,
    query,
    allowedDomains,
  };

  if (status === 'found') {
    const ttlMs = resolveOfficialWebCacheTtlMs(missingFacts, env);
    setOfficialWebCacheEntry(cacheKey, result, ttlMs);
  }

  return result;
}

/**
 * Standard-Implementierung – delegiert an injizierbaren Web-Search-Provider.
 * Ohne Provider: not_found (sicherer Default, keine Live-API in Tests).
 */
async function defaultPerformOfficialWebSearch(params, deps = {}) {
  if (typeof deps.performOfficialWebSearch === 'function') {
    return deps.performOfficialWebSearch(params, deps);
  }
  return [];
}

export function buildEvidenceFromInternalFacts(facts = []) {
  return facts.map((fact) => ({
    evidenceId: fact.factId,
    sourceTier: 'internal_verified',
    status: 'verified',
    factKey: fact.key,
    modelKey: fact.modelKey,
    variantKey: fact.variantKey ?? null,
    sourceId: fact.sourceId ?? null,
    sourceUrl: null,
    value: fact.value,
    unit: fact.unit ?? null,
  }));
}
