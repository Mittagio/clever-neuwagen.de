/**
 * Customer Journey für Informationsmodus – Orientierung vor Angebot.
 */
import { KIA_MODEL_ATTRIBUTES } from '../../data/kia/kiaModelAttributes.js';
import { enrichModelLineGroupWithProfileQuote } from '../cleverQuote/cleverQuoteService.js';
import { buildInterestOptions, hasConfigurator } from './modelConfiguratorCatalog.js';
import { enrichFitGroups } from './modelFitRecommendation.js';

/** @typedef {{ id: string, label: string, query: string }} RelatedTopic */

const FOLLOW_UP_QUERIES = {
  batteryKwh: (label) => `${label} Batterie`,
  wltpRange: (label) => `${label} Reichweite`,
  length: (label) => `Wie lang ist der ${label}?`,
  height: (label) => `Wie hoch ist der ${label}?`,
  width: (label) => `Wie breit ist der ${label}?`,
  towingCapacity: (label) => `${label} Anhängelast`,
  trunkVolume: (label) => `${label} Kofferraum`,
  charging: (label) => `${label} Ladezeit`,
  seats: (label) => `${label} Sitze`,
  price: (label) => `Was kostet der ${label}?`,
};

const RELATED_BY_FIELD = {
  batteryKwh: ['wltpRange', 'charging', 'trunkVolume', 'towingCapacity'],
  wltpRange: ['batteryKwh', 'charging', 'towingCapacity', 'trunkVolume'],
  length: ['trunkVolume', 'wltpRange', 'towingCapacity', 'height'],
  height: ['length', 'trunkVolume', 'wltpRange'],
  width: ['length', 'trunkVolume'],
  towingCapacity: ['wltpRange', 'batteryKwh', 'trunkVolume', 'length'],
  trunkVolume: ['length', 'wltpRange', 'towingCapacity', 'seats'],
  charging: ['batteryKwh', 'wltpRange'],
  seats: ['trunkVolume', 'length', 'towingCapacity'],
  price: ['wltpRange', 'trunkVolume', 'length'],
  dimensionsOverview: ['length', 'trunkVolume', 'wltpRange', 'towingCapacity'],
};

const TOPIC_LABELS = {
  batteryKwh: 'Batterie',
  wltpRange: 'Reichweite',
  length: 'Länge',
  height: 'Höhe',
  width: 'Breite',
  towingCapacity: 'Anhängelast',
  trunkVolume: 'Kofferraum',
  charging: 'Ladezeit',
  seats: 'Sitze',
  price: 'Preis',
};

/**
 * @param {string} modelKey
 * @param {string} [currentField]
 * @returns {RelatedTopic[]}
 */
export function buildRelatedTopics(modelKey, currentField) {
  const label = KIA_MODEL_ATTRIBUTES[modelKey]?.label;
  if (!label) return [];

  const fields = RELATED_BY_FIELD[currentField] ?? ['wltpRange', 'trunkVolume', 'towingCapacity', 'length'];
  return fields
    .filter((field) => field !== currentField)
    .map((field) => ({
      id: field,
      label: TOPIC_LABELS[field] ?? field,
      query: FOLLOW_UP_QUERIES[field]?.(label) ?? `${label} ${TOPIC_LABELS[field] ?? field}`,
    }))
    .slice(0, 4);
}

/**
 * @param {object} answer
 * @param {object} analysis
 */
export function resolvePrimaryModelKey(answer, analysis) {
  if (analysis?.fact?.modelKey) return analysis.fact.modelKey;
  if (analysis?.advisory?.modelKey) return analysis.advisory.modelKey;
  if (answer?.highlights?.length === 1) return answer.highlights[0].modelKey;
  if (answer?.modelCards?.length === 1) return answer.modelCards[0].modelKey;
  return null;
}

export function resolveCompareModelKeys(analysis) {
  if (!analysis?.compare) return [];
  return [analysis.compare.modelKeyA, analysis.compare.modelKeyB].filter(Boolean);
}

/**
 * @param {object} answer
 * @param {object} analysis
 */
export function enrichSmartAnswerJourney(answer, analysis) {
  if (!answer) return null;

  const journeyKind = analysis?.intent === 'vehicle_compare_question'
    ? 'compare'
    : answer.highlights?.length > 1 && !analysis?.fact?.modelKey
      ? 'ranking'
      : 'fact';

  const primaryModelKey = resolvePrimaryModelKey(answer, analysis);
  const compareModelKeys = journeyKind === 'compare' ? resolveCompareModelKeys(analysis) : [];
  const primaryLabel = primaryModelKey
    ? KIA_MODEL_ATTRIBUTES[primaryModelKey]?.label ?? primaryModelKey.toUpperCase()
    : null;

  const relatedTopics = primaryModelKey && journeyKind === 'fact'
    ? buildRelatedTopics(primaryModelKey, analysis?.fact?.field)
    : [];

  let fitPrompt = null;
  if (journeyKind === 'compare') {
    const names = compareModelKeys.map((k) => KIA_MODEL_ATTRIBUTES[k]?.label ?? k).join(' oder ');
    fitPrompt = names ? `Welches Modell passt besser zu Ihnen – ${names}?` : 'Welches Modell passt besser zu Ihnen?';
  } else if (primaryLabel) {
    fitPrompt = `Passt der ${primaryLabel} zu Ihnen?`;
  }

  const bodyType = primaryModelKey
    ? KIA_MODEL_ATTRIBUTES[primaryModelKey]?.bodyType ?? 'suv'
    : null;

  const interestOptions = buildInterestOptions({
    ...answer,
    compareModelKeys,
    primaryModelKey,
  });

  const primaryHasConfigurator = primaryModelKey ? hasConfigurator(primaryModelKey) : false;

  return {
    ...answer,
    journeyKind,
    primaryModelKey,
    primaryModelLabel: primaryLabel,
    compareModelKeys,
    relatedTopics,
    interestOptions,
    fitPrompt,
    bodyType,
    showFitCheck: (journeyKind === 'compare' || Boolean(primaryModelKey)) && !primaryHasConfigurator,
    showConfiguratorCta: primaryHasConfigurator && journeyKind !== 'compare',
    configuratorCta: primaryHasConfigurator && primaryLabel
      ? `${primaryLabel} konfigurieren`
      : null,
    showOffersCta: false,
  };
}

/**
 * @param {object} bundle
 * @param {string} modelKey
 */
export function findModelLineGroup(bundle, modelKey) {
  const groups = bundle?.exact?.modelLineGroups ?? [];
  return groups.find((g) => (
    g.primaryMatch?.vehicle?.modelKey === modelKey
    || g.modelLineKey === modelKey
    || String(g.label ?? '').toLowerCase().includes(modelKey)
  )) ?? null;
}

/**
 * @param {object} bundle
 * @param {string[]} modelKeys
 * @param {object} [searchProfile]
 */
export function buildFitPreviewGroups(bundle, modelKeys, searchProfile, smartAnswer = null) {
  const groups = modelKeys
    .map((key) => findModelLineGroup(bundle, key))
    .filter(Boolean)
    .map((group) => (
      searchProfile ? enrichModelLineGroupWithProfileQuote(group, searchProfile) : group
    ));

  return enrichFitGroups(groups, smartAnswer);
}

/**
 * @param {object} bundle
 * @param {string|string[]} modelKeys
 */
export function filterSearchBundleToModels(bundle, modelKeys) {
  if (!bundle || !modelKeys) return bundle;
  const keys = Array.isArray(modelKeys) ? modelKeys : [modelKeys];
  const filterList = (groups = []) => groups.filter((g) => keys.some((key) => (
    g.primaryMatch?.vehicle?.modelKey === key
    || g.modelLineKey === key
    || String(g.label ?? '').toLowerCase().includes(key)
  )));

  const exactGroups = filterList(bundle.exact?.modelLineGroups);
  const altGroups = filterList(bundle.alternatives);

  return {
    ...bundle,
    hasExactMatch: exactGroups.length > 0,
    exact: exactGroups.length
      ? { ...bundle.exact, modelLineGroups: exactGroups }
      : null,
    alternatives: altGroups,
  };
}
