/**
 * Bedürfnis-Antwort – erkannte Wünsche + Top-Modelle in Verkäufersprache.
 */
import { KIA_MODEL_ATTRIBUTES } from '../../data/kia/kiaModelAttributes.js';
import { resolveDealerModelTitle } from './dealerAdvisorPresentation.js';
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

/**
 * @param {object} group
 * @param {object} [profile]
 */
export function buildNeedSearchModelLines(group, profile = null) {
  const modelKey = group?.modelLineKey;
  const attrs = modelKey ? KIA_MODEL_ATTRIBUTES[modelKey] : null;
  const lines = [fuelLabelForModel(modelKey)];

  const towKg = attrs?.towCapacityKg;
  if (towKg && (!profile?.towCapacityKg || towKg >= profile.towCapacityKg)) {
    lines.push(`${formatTon(towKg)} Anhängelast`);
  }

  if (profile?.availability === 'sofort') {
    lines.push('kurzfristig verfügbar');
  }

  return lines.filter(Boolean);
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
}) {
  const picks = modelLineGroups.slice(0, 3).map((group, index) => ({
    medal: MEDALS[index] ?? `${index + 1}.`,
    title: resolveDealerModelTitle(group),
    lines: buildNeedSearchModelLines(group, searchProfile),
    modelKey: group.modelLineKey,
  }));

  const questions = getCleverAskQuestions(filters, wishes);

  return {
    wishCount: recognizedWishes.length,
    modelCount: modelLineGroups.length,
    picks,
    clarification: questions[0] ?? null,
  };
}
