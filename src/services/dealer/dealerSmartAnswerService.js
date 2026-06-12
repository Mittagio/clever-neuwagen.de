/**
 * Smart-Answer vor der Fahrzeugsuche – Intent → kompakte Clever-Antwort.
 */
import { answerVehicleLexiconQuery } from '../lexicon/vehicleLexiconService.js';
import { parseSearchIntent } from '../search/searchIntentParser.js';
import { buildSearchProfile } from '../search/searchProfile.js';
import { analyzeVehicleQuery } from '../search/vehicleQueryIntent.js';
import { buildAdvisoryAnswer } from './dealerAdvisoryAnswerService.js';
import { pickHighlightDetail } from './dealerSmartAnswerHelpers.js';
import { withNarrativeDefaults } from './smartAnswerNarrative.js';
import {
  buildVehicleCompareAnswer,
  buildVehicleFactAnswer,
} from './vehicleFactAnswerService.js';
import { buildVehicleEstimateAnswer } from './vehicleEstimateAnswerService.js';
import { enrichSmartAnswerJourney } from './smartAnswerJourney.js';
import { resolveQueryRoutingLayer } from '../search/vehicleQueryRouting.js';

const MAX_HIGHLIGHTS = 3;

function buildLexiconSmartAnswer(query, vehicles) {
  const intent = parseSearchIntent(query);
  const profile = buildSearchProfile({ intent, query });
  const lexicon = answerVehicleLexiconQuery(query, vehicles);

  if (lexicon.kind === 'data_gap') {
    return withNarrativeDefaults({
      intent: 'vehicle_fact_question',
      mode: 'info',
      query,
      title: lexicon.headline,
      lead: lexicon.explanation,
      tip: lexicon.suggestion ?? null,
      facts: [],
      highlights: (lexicon.topByVolume ?? []).slice(0, 2).map((item) => ({
        modelKey: item.modelKey,
        label: item.label,
        detail: item.detail?.split(' · ')[0] ?? null,
      })),
      matchCount: lexicon.topByVolume?.length ?? 0,
      canShowOffers: true,
    });
  }

  const matches = lexicon.matches ?? [];
  if (!matches.length) {
    return {
      intent: 'vehicle_fact_question',
      mode: 'info',
      query,
      title: 'Kein Kia-Modell erfüllt alle genannten Kriterien',
      summary: lexicon.queryInterpretation || null,
      tip: 'Passen Sie die Anfrage an oder sehen Sie alle verfügbaren Angebote.',
      facts: [],
      highlights: [],
      matchCount: 0,
      canShowOffers: true,
    };
  }

  const highlights = matches.slice(0, MAX_HIGHLIGHTS).map((m) => ({
    modelKey: m.modelKey,
    label: m.label,
    detail: pickHighlightDetail(m, profile),
  }));

  let summary = lexicon.queryInterpretation || null;
  if (lexicon.kind === 'ranking') {
    summary = matches.length > 1
      ? `Danach folgen ${matches[1].label} (${pickHighlightDetail(matches[1], profile)}) und weitere Elektro-Modelle.`
      : null;
  } else if (matches.length > MAX_HIGHLIGHTS) {
    summary = `${matches.length} Modelllinien erfüllen Ihre Kriterien – hier die besten Treffer.`;
  }

  return withNarrativeDefaults({
    intent: 'vehicle_fact_question',
    mode: 'info',
    query,
    title: lexicon.headline,
    lead: summary,
    tip: null,
    facts: [],
    highlights,
    matchCount: matches.length,
    canShowOffers: true,
  });
}

/**
 * @param {string} query
 * @param {object[]} [vehicles]
 */
export function buildDealerSmartAnswer(query, vehicles = []) {
  const trimmed = String(query ?? '').trim();
  if (!trimmed) return null;

  const intent = parseSearchIntent(trimmed);
  const profile = buildSearchProfile({ intent, query: trimmed });
  const analysis = analyzeVehicleQuery(trimmed, intent, profile);

  let answer = null;

  if (analysis.intent === 'vehicle_compare_question' && analysis.compare) {
    answer = buildVehicleCompareAnswer(analysis.compare, trimmed, vehicles);
  } else if (analysis.intent === 'vehicle_fact_question') {
    if (analysis.estimate) {
      answer = buildVehicleEstimateAnswer(analysis.estimate, trimmed);
    } else if (analysis.fact?.field) {
      answer = buildVehicleFactAnswer(analysis.fact, trimmed, analysis.catalog ?? null);
    } else if (analysis.advisory) {
      answer = { ...buildAdvisoryAnswer(analysis.advisory, vehicles), intent: 'vehicle_fact_question' };
    } else if (analysis.lexiconRanking) {
      answer = buildLexiconSmartAnswer(trimmed, vehicles);
    }
  }

  if (answer) {
    answer.routingLayer = resolveQueryRoutingLayer(analysis, answer);
  }

  return enrichSmartAnswerJourney(answer, analysis);
}
