/**
 * Kontextuelle Folgefragen auflösen – Kurzformen im Beratungsverlauf verstehen.
 */
import { detectModelKeyInQuery } from '../search/modelAttributeQuestion.js';
import { KIA_MODEL_ATTRIBUTES } from '../../data/kia/kiaModelAttributes.js';

function modelLabel(modelKey) {
  return KIA_MODEL_ATTRIBUTES[modelKey]?.label ?? modelKey?.toUpperCase();
}

function detectSorentoVariant(text) {
  if (/plug-?in|phev/i.test(text)) return 'sorento-phev';
  if (/hybrid/i.test(text) && !/diesel/i.test(text)) return 'sorento-hybrid';
  return 'sorento';
}

/**
 * @param {string} rawQuery
 * @param {object} [sessionContext]
 */
export function resolveContextualQuery(rawQuery = '', sessionContext = {}) {
  const text = String(rawQuery).trim();
  if (!text) return { query: text, enriched: false };

  const focus = sessionContext.modelKey
    ?? sessionContext.modelsInFocus?.[sessionContext.modelsInFocus.length - 1]
    ?? null;
  const compared = sessionContext.comparedModels ?? [];
  const lastAdviceTopic = sessionContext.adviceTopicIds?.[sessionContext.adviceTopicIds.length - 1]
    ?? sessionContext.topics?.[sessionContext.topics.length - 1]
    ?? null;
  const explicitModel = detectModelKeyInQuery(text);

  if (!explicitModel && /^mehr\s+infos/i.test(text) && focus) {
    return {
      query: `Mehr Infos zum Kia ${modelLabel(focus)}`,
      enriched: true,
      resolvedFrom: 'models_in_focus',
      modelKey: focus,
      intentHint: 'model_detail_question',
    };
  }

  if (/^(und\s+)?(wenn\s+ich\s+)?(einen?\s+)?/i.test(text) && /sorento/i.test(text) && focus) {
    const sorentoKey = detectSorentoVariant(text);
    return {
      query: `${modelLabel(focus)} mit ${modelLabel(sorentoKey)} vergleichen`,
      enriched: true,
      resolvedFrom: 'contextual_comparison',
      comparisonModels: [focus, sorentoKey],
      intentHint: 'comparison_question',
    };
  }

  if (/^und\s+(wenn\s+ich\s+)?(einen?\s+)?/i.test(text) && explicitModel && focus && explicitModel !== focus) {
    return {
      query: `${modelLabel(focus)} mit ${modelLabel(explicitModel)} vergleichen`,
      enriched: true,
      resolvedFrom: 'contextual_comparison',
      comparisonModels: [focus, explicitModel],
      intentHint: 'comparison_question',
    };
  }

  if (/^und\s+im\s+winter/i.test(text)) {
    if (focus && lastAdviceTopic !== 'ev_towing_range') {
      return {
        query: `${modelLabel(focus)} Reichweite im Winter`,
        enriched: true,
        resolvedFrom: 'winter_follow_up',
        modelKey: focus,
        adviceTopicId: 'winter_range',
      };
    }
    if (lastAdviceTopic === 'ev_towing_range') {
      return {
        query: 'Reichweite mit Anhänger im Winter',
        enriched: true,
        resolvedFrom: 'towing_winter',
        adviceTopicId: 'ev_towing_range',
      };
    }
    return {
      query: 'Wie stark sinkt die Reichweite im Winter?',
      enriched: true,
      resolvedFrom: 'winter_general',
      adviceTopicId: 'winter_range',
    };
  }

  if (/wohnwagen|anhänger/i.test(text) && lastAdviceTopic === 'ev_towing_range') {
    return {
      query: 'Wie weit komme ich mit Wohnwagen?',
      enriched: true,
      resolvedFrom: 'towing_depth',
      adviceTopicId: 'ev_towing_range',
    };
  }

  if (/^und\s+/i.test(text) && focus && !explicitModel) {
    const rest = text.replace(/^und\s+/i, '').trim();
    if (rest.length > 3) {
      return {
        query: `${modelLabel(focus)}: ${rest}`,
        enriched: true,
        resolvedFrom: 'focus_prefix',
        modelKey: focus,
      };
    }
  }

  if (compared.length >= 2 && /kosten|preis|teurer/i.test(text)) {
    return {
      query: `Kosten ${modelLabel(compared[0])} vs ${modelLabel(compared[1])} vergleichen`,
      enriched: true,
      resolvedFrom: 'comparison_cost',
      comparisonModels: compared,
      intentHint: 'comparison_question',
    };
  }

  return {
    query: text,
    enriched: false,
    modelKey: explicitModel ?? focus ?? null,
    comparisonModels: null,
  };
}

/**
 * @param {string} text
 */
export function detectAmbiguousLargestEvQuery(text = '') {
  const q = String(text).trim();
  const hasDisambiguator = /\b(welch(er|es|e)|sortier|nach|kofferraum|sitze|länge|laenge|außenmaße|aussenmasse)\b/i.test(q);
  return !hasDisambiguator
    && /\b(größte[nr]?|groesste[nr]?|größtes|groesstes)\b/i.test(q)
    && /\b(e-?auto|elektroauto|elektro|elektrofahrzeug)\b/i.test(q)
    && !/\b(kofferraum|reichweite|sitze|sitzer|außenmaße|aussenmasse|länge|laenge|7.?sitzer)\b/i.test(q);
}

/**
 * @param {string} text
 */
export function detectModelDetailQuery(text = '') {
  const q = String(text).trim();
  const modelKey = detectModelKeyInQuery(q);
  if (!modelKey) return null;
  if (/mehr\s+infos|übersicht|uebersicht|details|steckbrief|kurzprofil/i.test(q)) {
    return { modelKey, kind: 'model_detail' };
  }
  if (/beste[nr]?\s+variante|für\s+familie|familien/i.test(q) && modelKey) {
    return { modelKey, kind: 'family_variant' };
  }
  return null;
}
