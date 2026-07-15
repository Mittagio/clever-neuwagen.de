/**
 * Knowledge Conversation v1.0 – ERST ANTWORTEN, DANN WEITERFÜHREN.
 * Read-only: nutzt verifizierte Fahrzeugdaten, schreibt nichts.
 */
import { buildDealerSmartAnswer } from '../dealer/dealerSmartAnswerService.js';
import { getCleverRecordForModelKey } from '../admin/vehicleStammdatenOverrideService.js';
import { resolveElectricSpecs } from '../../data/kia/pricelistBatteryLookup.js';
import { KIA_MODEL_ATTRIBUTES } from '../../data/kia/kiaModelAttributes.js';
import { analyzeVehicleQuery } from '../search/vehicleQueryIntent.js';
import { parseSearchIntent } from '../search/searchIntentParser.js';
import { buildSearchProfile } from '../search/searchProfile.js';

const QUESTION_SIGNAL = /\?|^(wie|welche|was|wo|wann|warum|kann|hat|haben|gibt|schaff|reicht|bietet)\b/i;

function formatKwh(kwh) {
  if (kwh == null) return null;
  return (Math.round(kwh * 10) / 10).toString().replace('.', ',');
}

function looksLikeKnowledgeQuestion(text = '') {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) return false;
  return QUESTION_SIGNAL.test(trimmed);
}

function matchesElectricKleinwagenIntent(text = '') {
  return /\belektro[\s-]*kleinwagen\b|\bkleinwagen[\s-]*elektro\b|\belektro[\s-]*klein\b/i.test(text)
    || (/\bkleinwagen\b/i.test(text) && /\belektro\b/i.test(text));
}

function buildCompactElectricKleinwagenAnswer(query) {
  const ev2Record = getCleverRecordForModelKey('ev2');
  const ev2Specs = resolveElectricSpecs(ev2Record ?? {});

  const lines = [
    'Bei Kia würde ich bei einem echten Elektro-Kleinwagen zuerst den EV2 ansehen.',
    'EV3 und EV5 sind bereits deutlich größer – eher Kompakt-SUV, nicht Kleinwagen.',
  ];

  const facts = [];
  if (ev2Specs.wltpRangeKm) {
    facts.push({ label: 'EV2 WLTP', value: `${ev2Specs.wltpRangeKm} km` });
  }
  if (ev2Specs.batteryGrossKwh ?? ev2Specs.batteryNetKwh) {
    facts.push({
      label: 'EV2 Batterie',
      value: `${formatKwh(ev2Specs.batteryGrossKwh ?? ev2Specs.batteryNetKwh)} kWh`,
    });
  }

  return {
    text: lines.join('\n\n'),
    answerKind: 'knowledge',
    facts,
    modelCards: [
      {
        modelKey: 'ev2',
        name: KIA_MODEL_ATTRIBUTES.ev2?.label ?? 'EV2',
        bullets: [
          'Elektro-Kleinwagen',
          ...(ev2Specs.wltpRangeKm ? [`${ev2Specs.wltpRangeKm} km WLTP`] : []),
        ].filter(Boolean),
      },
    ],
    primaryModelKey: 'ev2',
    query,
  };
}

function formatSmartAnswerForConversation(smartAnswer, query) {
  const parts = [];
  if (smartAnswer.lead) parts.push(String(smartAnswer.lead).trim());
  if (smartAnswer.narrative?.length) {
    parts.push(...smartAnswer.narrative.map((line) => String(line).trim()).filter(Boolean));
  }
  if (!parts.length && smartAnswer.title) {
    parts.push(String(smartAnswer.title).trim());
  }

  const text = parts.join('\n\n').trim();
  if (!text) return null;

  return {
    text,
    answerKind: 'knowledge',
    facts: smartAnswer.facts ?? [],
    modelCards: smartAnswer.modelCards ?? [],
    primaryModelKey: smartAnswer.primaryModelKey ?? smartAnswer.modelCards?.[0]?.modelKey ?? null,
    query,
  };
}

/**
 * @param {string} text
 * @param {object} [needProfile]
 * @returns {object|null}
 */
export function tryConversationKnowledgeAnswer(text = '', needProfile = {}) {
  const query = String(text ?? '').trim();
  if (!query) return null;

  if (matchesElectricKleinwagenIntent(query)) {
    return buildCompactElectricKleinwagenAnswer(query);
  }

  if (!looksLikeKnowledgeQuestion(query)) return null;

  const intent = parseSearchIntent(query);
  const profile = buildSearchProfile({ intent, query });
  const analysis = analyzeVehicleQuery(query, intent, profile);

  if (analysis.intent === 'vehicle_search') return null;

  const smartAnswer = buildDealerSmartAnswer(query, []);
  if (!smartAnswer) return null;

  if (smartAnswer.intent !== 'vehicle_fact_question'
    && smartAnswer.intent !== 'vehicle_compare_question') {
    return null;
  }

  return formatSmartAnswerForConversation(smartAnswer, query);
}

export function detectConversationKnowledgeIntent(text = '') {
  return tryConversationKnowledgeAnswer(text) != null;
}
