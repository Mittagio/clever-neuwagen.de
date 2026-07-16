/**
 * Surface Adapter: Clever Lexikon – grounded Fahrzeugwissen ohne Lead-Kontext.
 */
import { CLEVER_SURFACES, getCleverIntelligenceConfig } from './cleverIntelligenceConfig.js';
import { buildCleverIntelligenceInstructions, CLEVER_INTELLIGENCE_PROMPT_VERSION } from './cleverBaseInstructions.js';
import { runCleverIntelligenceCore } from './runCleverIntelligenceCore.js';
import {
  CLEVER_LEXICON_RESULT_JSON_SCHEMA,
  validateCleverLexiconResult,
  assertGroundedLexiconResult,
} from './lexiconResultSchema.js';
import {
  buildLexiconCacheKey,
  getLexiconCacheEntry,
  setLexiconCacheEntry,
} from './lexiconQueryCache.js';
import { searchCleverLexicon } from '../../lexicon/cleverLexiconSearchService.js';
import { orchestrateLexiconQuery } from '../cleverLexiconQueryOrchestrator.js';

/**
 * @param {object} result
 */
export function buildLexiconSourceStatus(result = {}) {
  const evidence = result.evidence ?? [];
  const hasConflict = evidence.some((e) => e.status === 'provisional_official_source')
    && evidence.some((e) => e.status === 'verified')
    && result.knowledgeGap?.created;
  if (hasConflict || result.knowledgeGap?.reason === 'conflict') {
    return {
      code: 'conflict',
      label: 'Daten nicht eindeutig, Verkäuferprüfung erforderlich',
      icon: '⚠',
    };
  }
  if (evidence.some((e) => e.sourceTier === 'official_web')) {
    return {
      code: 'provisional',
      label: 'Aktuelle Herstellerangabe, intern noch nicht vollständig geprüft',
      icon: '◷',
    };
  }
  if (evidence.some((e) => e.sourceTier === 'internal_verified') || (result.usedFactIds ?? []).length) {
    return {
      code: 'verified',
      label: 'Intern verifizierte Clever-Stammdaten',
      icon: '✓',
    };
  }
  return {
    code: 'unknown',
    label: 'Quelle nicht abschließend verifiziert',
    icon: '⚠',
  };
}

/**
 * Mappt AI-Ergebnis auf bestehendes Lexikon-searchState-Format (UI-kompatibel).
 * @param {string} query
 * @param {object} lexiconResult
 */
export function mapLexiconResultToSearchState(query, lexiconResult) {
  const sourceStatus = buildLexiconSourceStatus(lexiconResult);
  return {
    ok: true,
    question: query,
    result: {
      query,
      intentType: lexiconResult.intent,
      title: lexiconResult.vehicleDirections?.[0]?.modelKey
        ? String(lexiconResult.vehicleDirections[0].modelKey).toUpperCase()
        : 'Clever Lexikon',
      modelTitle: lexiconResult.vehicleDirections?.[0]?.modelKey
        ? String(lexiconResult.vehicleDirections[0].modelKey).toUpperCase()
        : 'Clever Lexikon',
      fieldLabel: 'Antwort',
      shortAnswer: lexiconResult.answer,
      answer: lexiconResult.answer,
      primaryFacts: (lexiconResult.facts ?? []).map((f) => ({
        label: f.label,
        value: f.value,
      })),
      availabilityByTrim: [],
      relatedFacts: [],
      extras: [],
      source: `Quelle: ${sourceStatus.label}`,
      sourceStatus,
      confidence: sourceStatus.code === 'verified' ? 'high' : 'medium',
      warnings: sourceStatus.code === 'conflict' ? [sourceStatus.label] : [],
      modelKey: lexiconResult.vehicleDirections?.[0]?.modelKey ?? null,
      vehicleDirections: lexiconResult.vehicleDirections ?? [],
      evidence: lexiconResult.evidence ?? [],
      suggestedActions: lexiconResult.suggestedActions ?? [],
      knowledgeGap: lexiconResult.knowledgeGap ?? null,
      pipelineSource: 'shared_intelligence',
      aiLexicon: true,
    },
  };
}

function buildLexiconInput({ query, brandKey, market, locale }) {
  return [
    {
      role: 'user',
      content: JSON.stringify({
        surface: CLEVER_SURFACES.LEXICON,
        promptVersion: CLEVER_INTELLIGENCE_PROMPT_VERSION,
        brandKey,
        market,
        locale,
        query: String(query).slice(0, 2000),
        note: 'Kein Kundenkontext. Keine NeedProfile-Änderung. Nur Fahrzeugwissen.',
      }),
    },
  ];
}

/**
 * @param {object} params
 * @param {string} params.query
 * @param {string} [params.brandKey]
 * @param {string} [params.modelKey]
 * @param {string|null} [params.variantKey]
 * @param {string} [params.market]
 * @param {string} [params.locale]
 * @param {object} [deps]
 */
export async function runCleverLexiconQuery(params = {}, deps = {}) {
  const query = String(params.query ?? '').trim();
  if (!query) {
    return { ok: false, error: 'query_required', fallback: true };
  }

  const brandKey = params.brandKey ?? 'kia';
  const market = params.market ?? 'DE';
  const locale = params.locale ?? 'de-DE';
  const config = deps.config ?? getCleverIntelligenceConfig(CLEVER_SURFACES.LEXICON, deps.env);

  const cacheKey = buildLexiconCacheKey({
    query,
    brandKey,
    modelKey: params.modelKey ?? '',
    variantKey: params.variantKey ?? '',
    market,
    promptVersion: CLEVER_INTELLIGENCE_PROMPT_VERSION,
  });

  const cached = getLexiconCacheEntry(cacheKey);
  if (cached) {
    return { ...cached, fromCache: true };
  }

  if (!config.enabled) {
    const legacy = await orchestrateLexiconQuery({
      query,
      useOpenAi: false,
    });
    return {
      ok: legacy.ok === true,
      mode: 'legacy_rules',
      fallback: true,
      reason: 'lexicon_ai_disabled',
      searchState: legacy.searchState ?? searchCleverLexicon(query),
      lexiconResult: null,
      metrics: null,
    };
  }

  const core = await runCleverIntelligenceCore({
    surface: CLEVER_SURFACES.LEXICON,
    instructions: buildCleverIntelligenceInstructions(CLEVER_SURFACES.LEXICON),
    input: buildLexiconInput({ query, brandKey, market, locale }),
    jsonSchema: CLEVER_LEXICON_RESULT_JSON_SCHEMA,
    validate: validateCleverLexiconResult,
    assertGrounded: assertGroundedLexiconResult,
    userMessage: query,
    needProfile: null,
    dealerId: null,
    brandKey,
    config,
  }, deps);

  if (!core.ok) {
    const legacy = searchCleverLexicon(query);
    return {
      ok: true,
      mode: 'fallback_rules',
      fallback: true,
      reason: core.reason,
      searchState: legacy,
      lexiconResult: null,
      metrics: core.metrics,
      knowledgeGaps: core.knowledgeGaps ?? [],
    };
  }

  const searchState = mapLexiconResultToSearchState(query, core.result);
  const payload = {
    ok: true,
    mode: 'ai',
    fallback: false,
    searchState,
    lexiconResult: core.result,
    evidence: core.evidence,
    metrics: core.metrics,
    knowledgeGaps: core.knowledgeGaps ?? [],
    needProfileChanged: false,
  };

  setLexiconCacheEntry(cacheKey, payload);
  return payload;
}
