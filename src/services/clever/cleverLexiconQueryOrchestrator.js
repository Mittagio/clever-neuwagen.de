/**
 * Hybrid-Orchestrierung Clever-Lexikon (Verkäufer):
 * Regeln zuerst → freigegebenes Wissen → OpenAI-Normalisierung → Verkäufer-Formulierung.
 */
import { searchCleverLexicon } from '../lexicon/cleverLexiconSearchService.js';
import { findApprovedKnowledgeAnswer } from '../admin/cleverKnowledgeAnswerService.js';
import { isOpenAiConfigured } from './openAiQueryClassifier.js';
import { normalizeLexiconQueryWithOpenAi } from './openAiLexiconNormalizer.js';
import { formulateLexiconWithOpenAi } from './openAiLexiconFormulator.js';

function shouldUseOpenAi(options = {}) {
  if (options.useOpenAi === false) return false;
  if (options.useOpenAi === true) return isOpenAiConfigured();
  return process.env.ADVISOR_USE_OPENAI === 'true' && isOpenAiConfigured();
}

function confidenceRank(confidence) {
  if (confidence === 'high') return 3;
  if (confidence === 'medium') return 2;
  return 1;
}

function pickBetterSearchState(a, b) {
  if (!a) return b;
  if (!b) return a;
  if (a.ok && !b.ok) return a;
  if (!a.ok && b.ok) return b;
  const rankA = confidenceRank(a.result?.confidence);
  const rankB = confidenceRank(b.result?.confidence);
  if (rankA !== rankB) return rankA > rankB ? a : b;
  return a.ok ? a : b;
}

function isHighConfidenceLexiconResult(searchState) {
  return Boolean(searchState?.ok && searchState.result?.confidence === 'high');
}

function shouldFormulateLexiconResult(searchState) {
  if (!searchState?.ok) return false;
  const result = searchState.result ?? {};
  if (result.needsReview && result.intentType === 'technical') return false;
  if (result.dataConfidence === 'needs_review') return false;
  const confidence = result.confidence;
  return confidence === 'low' || confidence === 'medium';
}

function buildKnowledgeSearchState(query, approved) {
  const modelLabel = approved.modelLabel
    ?? (approved.modelKey ? `Kia ${String(approved.modelKey).toUpperCase()}` : 'Clever Wissen');

  return {
    ok: true,
    question: query,
    result: {
      query,
      intentType: 'knowledge',
      title: modelLabel,
      modelTitle: modelLabel,
      fieldLabel: approved.category ?? 'Freigegebene Antwort',
      shortAnswer: approved.answerText,
      answer: approved.answerText,
      primaryFacts: [{ label: 'Antwort', value: approved.answerText }],
      availabilityByTrim: [],
      relatedFacts: [],
      extras: [],
      source: 'Clever Wissensdatenbank',
      confidence: 'high',
      warnings: [],
      modelKey: approved.modelKey ?? null,
      featureId: approved.relatedFeatureIds?.[0] ?? null,
      knowledgeAnswerId: approved.id,
    },
  };
}

function enrichSearchState(searchState, { pipelineSource, normalizedQuery = null, formulated = false } = {}) {
  if (!searchState?.result) return searchState;
  return {
    ...searchState,
    result: {
      ...searchState.result,
      pipelineSource,
      normalizedQuery,
      formulated,
    },
  };
}

/**
 * @param {object} input
 */
export async function orchestrateLexiconQuery(input = {}) {
  const query = String(input.query ?? '').trim();

  if (!query) {
    return { ok: false, error: 'query_required' };
  }

  let pipelineSource = 'rules';
  let normalizedQuery = null;

  const ruleSearch = searchCleverLexicon(query);

  if (isHighConfidenceLexiconResult(ruleSearch)) {
    return {
      ok: true,
      source: pipelineSource,
      searchState: enrichSearchState(ruleSearch, { pipelineSource }),
    };
  }

  const modelKeyHint = ruleSearch.result?.modelKey ?? null;
  const approved = findApprovedKnowledgeAnswer(query, modelKeyHint);
  if (approved) {
    pipelineSource = 'approved_knowledge';
    return {
      ok: true,
      source: pipelineSource,
      searchState: enrichSearchState(
        buildKnowledgeSearchState(query, approved),
        { pipelineSource },
      ),
    };
  }

  let bestSearch = ruleSearch;

  if (shouldUseOpenAi(input)) {
    try {
      const normalization = await normalizeLexiconQueryWithOpenAi(query);
      if (normalization?.normalizedQuery) {
        normalizedQuery = normalization.normalizedQuery;
        if (normalizedQuery.toLowerCase() !== query.toLowerCase()) {
          const retrySearch = searchCleverLexicon(normalizedQuery);
          bestSearch = pickBetterSearchState(bestSearch, retrySearch);
          if (bestSearch !== ruleSearch) {
            pipelineSource = 'openai_normalize';
          }
        }
      }
    } catch {
      /* Regel-Ergebnis bleibt */
    }
  }

  if (isHighConfidenceLexiconResult(bestSearch)) {
    return {
      ok: true,
      source: pipelineSource,
      searchState: enrichSearchState(bestSearch, { pipelineSource, normalizedQuery }),
    };
  }

  if (shouldFormulateLexiconResult(bestSearch) && shouldUseOpenAi(input)) {
    try {
      const formulated = await formulateLexiconWithOpenAi({
        query,
        result: bestSearch.result,
      });
      if (formulated?.summary) {
        pipelineSource = pipelineSource === 'rules' ? 'openai_formulate' : `${pipelineSource}+formulate`;
        bestSearch = {
          ...bestSearch,
          result: {
            ...bestSearch.result,
            shortAnswer: formulated.summary,
            answer: formulated.summary,
            formulated: true,
          },
        };
      }
    } catch {
      /* Template-Antwort bleibt */
    }
  }

  return {
    ok: true,
    source: pipelineSource,
    searchState: enrichSearchState(bestSearch, {
      pipelineSource,
      normalizedQuery,
      formulated: Boolean(bestSearch.result?.formulated),
    }),
  };
}
