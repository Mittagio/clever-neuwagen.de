/**
 * Modellübersichten für Feature-Wissensfragen (Typ A).
 */
import { KIA_CLEVER_RECORDS } from '../clever/kiaCleverRecords.js';
import { KIA_MODEL_ATTRIBUTES } from './kiaModelAttributes.js';

/** @typedef {{ modelKey: string, shortName: string, tagline: string, towKg?: number }} FeatureLineupItem */

const LINEUP_ORDER = [
  'ev9', 'ev6', 'ev5', 'ev4', 'ev4-fastback', 'ev3',
  'sorento', 'sorento-hybrid', 'sorento-phev',
  'sportage', 'sportage-hybrid', 'sportage-phev',
  'seltos', 'niro', 'niro-hybrid', 'ceed', 'xceed', 'k4', 'stonic', 'picanto',
  'pv5-passenger',
];

function formatTon(kg) {
  if (kg == null) return null;
  const t = Math.round(kg / 100) / 10;
  return `${String(t).replace('.', ',')} t`;
}

/**
 * @param {string} modelKey
 */
function resolveShortName(modelKey) {
  return KIA_MODEL_ATTRIBUTES[modelKey]?.label
    ?? modelKey.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Kia-Modelle mit Anhängerkupplung / Anhängelast laut Stammdaten.
 * @returns {FeatureLineupItem[]}
 */
export function buildKiaTowbarLineup() {
  const bestByKey = new Map();

  for (const record of KIA_CLEVER_RECORDS) {
    const towKg = record.towing?.brakedKg;
    if (towKg == null || towKg < 750) continue;

    const modelKey = record.modelKey;
    const existing = bestByKey.get(modelKey);
    if (!existing || towKg > existing.towKg) {
      bestByKey.set(modelKey, {
        modelKey,
        shortName: resolveShortName(modelKey),
        towKg,
        tagline: `bis ${formatTon(towKg)} Anhängelast`,
      });
    }
  }

  const items = [...bestByKey.values()];
  items.sort((a, b) => {
    const ai = LINEUP_ORDER.indexOf(a.modelKey);
    const bi = LINEUP_ORDER.indexOf(b.modelKey);
    const aRank = ai === -1 ? 999 : ai;
    const bRank = bi === -1 ? 999 : bi;
    if (aRank !== bRank) return aRank - bRank;
    return a.shortName.localeCompare(b.shortName, 'de');
  });

  return items;
}
