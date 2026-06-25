/**
 * Bedürfnis-Antwort – erkannte Wünsche + Top-Modelle in Verkäufersprache.
 */
import { KIA_MODEL_ATTRIBUTES } from '../../data/kia/kiaModelAttributes.js';
import { resolveDealerModelTitle } from './dealerAdvisorPresentation.js';
import { buildVehicleFitReasons } from './vehicleSalesJourney.js';
import { getCleverAskQuestions } from '../search/chipConfig.js';

const MEDALS = ['🥇', '🥈', '🥉'];

function formatTon(kg) {
  if (!kg) return null;
  const tons = kg / 1000;
  return `${tons.toFixed(1).replace('.', ',')} t`;
}

function fuelLabelForModel(modelKey) {
  const fuel = KIA_MODEL_ATTRIBUTES[modelKey]?.fuel;
  if (fuel === 'electric') return 'Elektro';
  if (fuel === 'hybrid') return 'Hybrid';
  if (fuel === 'plugin_hybrid') return 'Plug-in-Hybrid';
  if (fuel === 'diesel') return 'Diesel';
  return 'Verbrenner';
}

function resolveMatchPercent(group) {
  const quote = group?.modelQuote ?? group?.primaryMatch?.cleverQuote;
  return quote?.percent ?? group?.primaryMatch?.score ?? null;
}

/**
 * @param {object} group
 * @param {object} [profile]
 * @param {object} [options]
 */
export function buildNeedSearchModelLines(group, profile = null, options = {}) {
  const modelKey = group?.modelLineKey;
  const attrs = modelKey ? KIA_MODEL_ATTRIBUTES[modelKey] : null;
  const lines = [];

  const reasons = buildVehicleFitReasons(group, options);
  if (reasons.length) {
    return reasons.slice(0, 4);
  }

  const towKg = attrs?.towCapacityKg;
  if (towKg && (!profile?.towCapacityKg || towKg >= profile.towCapacityKg)) {
    lines.push(`${formatTon(towKg)} Anhängelast`);
  }

  lines.push(fuelLabelForModel(modelKey));

  if (profile?.availability === 'sofort' || profile?.softPreferences?.includes('availability_sofort')) {
    lines.push('kurzfristig verfügbar');
  }

  return lines.filter(Boolean);
}

/**
 * @param {object} group
 * @param {number} index
 * @param {object} [context]
 */
export function buildAdvisorModelPick(group, index = 0, context = {}) {
  const { searchProfile = null, searchWishes = null, chipIds = [] } = context;
  const modelKey = group?.modelLineKey;
  const matchPercent = resolveMatchPercent(group);

  return {
    medal: index === 0 ? null : (MEDALS[index] ?? `${index + 1}.`),
    badge: null,
    title: resolveDealerModelTitle(group),
    shortTitle: KIA_MODEL_ATTRIBUTES[modelKey]?.label ?? resolveDealerModelTitle(group).replace(/^Kia\s+/i, ''),
    lines: buildNeedSearchModelLines(group, searchProfile, { searchProfile, searchWishes, chipIds }),
    modelKey,
    matchPercent,
    group,
  };
}

/**
 * @param {object} params
 */
export function buildNeedSearchAnswer({
  recognizedWishes = [],
  modelLineGroups = [],
  searchProfile = null,
  filters = {},
  wishes = {},
  chipIds = [],
  advisorMode = false,
}) {
  const context = { searchProfile, searchWishes: wishes, chipIds };
  const picks = modelLineGroups.slice(0, 3).map((group, index) => (
    buildAdvisorModelPick(group, index, context)
  ));

  const questions = getCleverAskQuestions(filters, wishes, { excludePayment: advisorMode });

  return {
    wishCount: recognizedWishes.length,
    modelCount: modelLineGroups.length,
    picks,
    clarification: questions[0] ?? null,
  };
}
