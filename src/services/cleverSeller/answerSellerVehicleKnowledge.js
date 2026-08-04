/**
 * Seller-Composer Lexikon – gleiche Pipeline wie Kundenberatung / Landing.
 * OpenAI schreibt nicht die Fakten; Stammdaten via buildAdvisoryAnswer / Smart Answer.
 */
import { parseAdvisoryQuestion } from '../search/advisoryQuestionParser.js';
import { detectModelKeyInQuery } from '../search/modelAttributeQuestion.js';
import { buildAdvisoryAnswer } from '../dealer/dealerAdvisoryAnswerService.js';
import { buildDealerSmartAnswer } from '../dealer/dealerSmartAnswerService.js';
import { lookupVehicleTechnicalFact } from './lookupVehicleTechnicalFact.js';

function joinNarrative(answer = {}) {
  const parts = [
    answer.lead,
    ...(Array.isArray(answer.narrative) ? answer.narrative : []),
    answer.summary,
  ].filter(Boolean);
  return parts.join('\n').trim() || null;
}

function formatFactsLine(facts = []) {
  return (Array.isArray(facts) ? facts : [])
    .slice(0, 8)
    .map((f) => `${f.label}: ${f.value}`)
    .filter(Boolean)
    .join('\n');
}

/** Nur Marke + Modell (z. B. „Kia EV6“) → Kurzprofil statt leerer Meta-Karte. */
function isBareModelKnowledgeQuery(text = '', modelKey = null) {
  if (!modelKey) return false;
  const keyParts = String(modelKey).split('-').filter(Boolean);
  const modelRe = keyParts.length > 1
    ? new RegExp(keyParts.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[-\\s]?'), 'i')
    : new RegExp(String(modelKey).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const stripped = String(text || '')
    .replace(/\bkia\b/gi, '')
    .replace(modelRe, '')
    .replace(/[?.!,]/g, '')
    .trim();
  return stripped.length === 0;
}

/**
 * @param {object} answer
 * @param {object|null} advisory
 */
export function mapAdvisoryAnswerToKnowledgeResult(answer, advisory = null) {
  if (!answer) {
    return {
      ok: false,
      status: 'missing',
      message: 'Dazu habe ich gerade keine verifizierte Angabe.',
      displayValue: null,
      factLabel: null,
      modelKey: null,
      modelLabel: null,
      sourceLabel: null,
      advisoryAnswer: null,
    };
  }

  const body = [joinNarrative(answer), formatFactsLine(answer.facts)].filter(Boolean).join('\n\n');
  const modelKey = advisory?.modelKey
    || advisory?.modelKeyA
    || answer.primaryModelKey
    || null;

  return {
    ok: true,
    status: 'advisory',
    modelKey,
    modelLabel: answer.title || null,
    factLabel: answer.title || 'Fahrzeugwissen',
    displayValue: answer.lead || answer.title || null,
    message: body || answer.lead || answer.title,
    body,
    facts: answer.facts || [],
    narrative: answer.narrative || [],
    sourceLabel: 'Clever Stammdaten (Beratung)',
    sourceId: 'dealer_advisory',
    advisoryAnswer: answer,
    warnings: [],
  };
}

/**
 * @param {{
 *   sellerInput?: string,
 *   modelKey?: string|null,
 *   factKey?: string|null,
 * }} params
 */
export function answerSellerVehicleKnowledge(params = {}) {
  const sellerInput = String(params.sellerInput || '').trim();
  if (!sellerInput) {
    return {
      ok: false,
      status: 'missing_input',
      message: 'Welche Fahrzeugfrage soll ich prüfen?',
      displayValue: null,
    };
  }

  const advisory = parseAdvisoryQuestion(sellerInput);
  if (advisory) {
    const answer = buildAdvisoryAnswer(advisory, []);
    if (answer) {
      return mapAdvisoryAnswerToKnowledgeResult(answer, advisory);
    }
  }

  const modelKey = params.modelKey || detectModelKeyInQuery(sellerInput);
  if (modelKey && isBareModelKnowledgeQuery(sellerInput, modelKey)) {
    const overview = buildAdvisoryAnswer({
      kind: 'advisory',
      topic: 'overview',
      modelKey,
      query: sellerInput,
    }, []);
    if (overview) {
      return mapAdvisoryAnswerToKnowledgeResult(overview, { modelKey, topic: 'overview', query: sellerInput });
    }
  }

  const smart = buildDealerSmartAnswer(sellerInput, []);
  if (smart?.title || smart?.lead || (smart?.facts || []).length) {
    return mapAdvisoryAnswerToKnowledgeResult(smart, advisory);
  }

  return lookupVehicleTechnicalFact({
    modelKey: params.modelKey,
    factKey: params.factKey,
    sellerInput,
  });
}

export function isSellerVehicleKnowledgeQuery(text = '') {
  const t = String(text || '').trim();
  if (!t) return false;
  if (parseAdvisoryQuestion(t)) return true;
  const modelKey = detectModelKeyInQuery(t);
  if (modelKey && isBareModelKnowledgeQuery(t, modelKey)) return true;
  if (/\b(anhängelast|reichweite|wltp|hud|batterie|kofferraum|sitze|dimension|vergleich|oder|vs\.?)\b/i.test(t)
    || /gr(?:ö|oe)(?:ß|ss)e|groß|\bgross\b/i.test(t)
    || /\b(l(?:ä|ae)nge|breite|h(?:ö|oe)he)\b/i.test(t)) {
    if (/\b(ev\s*[2-9]|sportage|xceed|ceed|picanto|niro|sorento)\b/i.test(t)) {
      return true;
    }
  }
  return false;
}
