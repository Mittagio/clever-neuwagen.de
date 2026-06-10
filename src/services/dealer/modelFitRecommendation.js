/**
 * Kurze Verkäufer-Empfehlung für die Fit-Phase – aus Stammdaten, nicht erfunden.
 */
import { KIA_CLEVER_RECORDS } from '../../data/clever/kiaCleverRecords.js';
import { KIA_MODEL_ATTRIBUTES } from '../../data/kia/kiaModelAttributes.js';

const SCORE_PHRASES = [
  { key: 'cityCar', min: 8, phrase: 'die Stadt' },
  { key: 'commuter', min: 8, phrase: 'Pendeln' },
  { key: 'familyVehicle', min: 8, phrase: 'den Familienalltag' },
  { key: 'longDistance', min: 8, phrase: 'lange Strecken' },
  { key: 'caravanReady', min: 7, phrase: 'Anhängerbetrieb' },
  { key: 'valuePick', min: 8, phrase: 'ein attraktives Preis-Leistungs-Verhältnis' },
  { key: 'dogFriendly', min: 7, phrase: 'Hund und Alltag' },
  { key: 'seniorFriendly', min: 7, phrase: 'komfortables Ein- und Aussteigen' },
];

function getCleverRecord(modelKey) {
  return KIA_CLEVER_RECORDS.find((r) => r.modelKey === modelKey && !r.trimId)
    ?? KIA_CLEVER_RECORDS.find((r) => r.modelKey === modelKey)
    ?? null;
}

function bodyClassFallback(attrs) {
  const body = attrs?.bodyClass;
  if (body === 'kleinwagen') return 'Kompakt und wendig – ideal für Stadt und Parkhaus.';
  if (body === 'compact' || body === 'compact_suv') return 'Alltagstauglich und vielseitig einsetzbar.';
  if (body === 'family_suv' || body === 'large_suv') return 'Geräumig und gut für Familien unterwegs.';
  if (body === 'kombi') return 'Viel Platz für Gepäck und Alltagsgegenstände.';
  if (body === 'limousine') return 'Komfortabel auf langen Strecken.';
  if (attrs?.fuel === 'electric' || attrs?.powertrains?.includes('elektro')) {
    return 'Vollelektrisch und für den Alltag geeignet.';
  }
  return null;
}

/**
 * @param {string} modelKey
 * @returns {string|null}
 */
export function buildModelFitRecommendation(modelKey) {
  const attrs = KIA_MODEL_ATTRIBUTES[modelKey];
  const record = getCleverRecord(modelKey);
  const scores = record?.cleverScores ?? {};

  const top = SCORE_PHRASES
    .filter((entry) => (scores[entry.key] ?? 0) >= entry.min)
    .sort((a, b) => (scores[b.key] ?? 0) - (scores[a.key] ?? 0))
    .slice(0, 2);

  if (top.length >= 2) {
    return `Gut für ${top[0].phrase} und ${top[1].phrase}.`;
  }
  if (top.length === 1) {
    return `Besonders geeignet für ${top[0].phrase}.`;
  }

  return bodyClassFallback(attrs);
}

/**
 * @param {object} group
 */
export function buildGroupFitRecommendation(group) {
  const modelKey = group?.primaryMatch?.vehicle?.modelKey;
  if (!modelKey) return null;
  return buildModelFitRecommendation(modelKey);
}

/**
 * @param {object[]} groups
 * @param {object} [smartAnswer]
 */
export function buildCompareFitSummary(groups, smartAnswer) {
  const narrative = smartAnswer?.narrative ?? [];
  if (narrative.length) return narrative[0];

  const lead = smartAnswer?.lead;
  if (lead) return lead;

  if (groups.length === 2) {
    const a = groups[0]?.label ?? groups[0]?.primaryMatch?.vehicle?.model;
    const b = groups[1]?.label ?? groups[1]?.primaryMatch?.vehicle?.model;
    if (a && b) {
      return `Beide Modelle haben Stärken – ${a} und ${b} decken unterschiedliche Bedürfnisse ab.`;
    }
  }

  return null;
}

/**
 * @param {object[]} groups
 * @param {object} [smartAnswer]
 */
export function enrichFitGroups(groups, smartAnswer) {
  return groups.map((group) => ({
    ...group,
    fitRecommendation: buildGroupFitRecommendation(group),
  }));
}
