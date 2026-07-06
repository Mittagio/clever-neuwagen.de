/**
 * Sprint 3 – Fahrzeugrichtungen einordnen (keine Empfehlung).
 */
import { KIA_MODEL_ATTRIBUTES } from '../../data/kia/kiaModelAttributes.js';
import { getFuelCategory } from './conversationPlanner.js';

export const VEHICLE_DIRECTION_INTRO =
  'Diese Richtungen könnten grundsätzlich zu Ihrem Wunsch passen.';

export const VEHICLE_DIRECTION_REACTIONS = [
  { id: 'interested', label: 'interessiert mich' },
  { id: 'not_fit', label: 'passt eher nicht' },
  { id: 'explore', label: 'genauer ansehen' },
];

const EV_MODEL_KEYS = new Set([
  'ev2', 'ev3', 'ev4', 'ev4-fastback', 'ev5', 'ev5-gt', 'ev6', 'ev6-gt', 'ev9', 'ev9-gt',
]);

const FUEL_TRUTH_TO_CATEGORY = {
  electric: 'electric',
  hybrid: 'hybrid',
  plugin_hybrid: 'phev',
  combustion: 'combustion',
  multi: 'multi',
};

function modelFuelCategory(attrs = {}) {
  const fuel = attrs.fuel;
  if (fuel === 'multi') return 'multi';
  return FUEL_TRUTH_TO_CATEGORY[fuel] ?? null;
}

function fuelMatchesProfile(attrs, profile) {
  const needCat = getFuelCategory(profile);
  if (!needCat) return true;

  const modelCat = modelFuelCategory(attrs);
  if (modelCat === 'multi') {
    if (needCat === 'combustion') {
      return attrs.powertrains?.includes('verbrenner');
    }
    if (needCat === 'hybrid') return attrs.powertrains?.includes('hybrid');
    if (needCat === 'phev') return attrs.powertrains?.includes('plugin-hybrid');
    return true;
  }

  if (needCat === 'combustion') return modelCat === 'combustion' || modelCat === 'multi';
  return modelCat === needCat;
}

function buildDirectionSubtitle(profile = {}, attrs = {}) {
  const parts = [];
  const fuel = profile.fuel;
  if (fuel === 'diesel') parts.push('Diesel');
  else if (fuel === 'verbrenner' || fuel === 'benzin') parts.push('Benzin');
  else if (fuel === 'electric' || fuel === 'elektro') parts.push('Elektro');
  else if (fuel === 'hybrid') parts.push('Hybrid');
  else if (fuel === 'phev') parts.push('Plug-in-Hybrid');

  if (profile.drive === 'awd') parts.push('Allrad');
  if (profile.transmission === 'automatic') parts.push('Automatik');
  if (attrs.seats >= 7) parts.push('7 Sitze');
  else if (profile.children) parts.push('Familien-SUV');

  return parts.length ? parts.join(' · ') : attrs.bodyType === 'suv' ? 'SUV' : null;
}

function buildFitHints(profile = {}, attrs = {}) {
  const hints = [];
  if (profile.modelHint && attrs.modelKey.startsWith(profile.modelHint)) {
    hints.push('passt zu Ihrem Modellwunsch');
  } else if (profile.bodyType && attrs.bodyType === profile.bodyType) {
    hints.push('ähnliche Fahrzeugklasse');
  }
  if (profile.budget?.maxPrice || profile.budget?.maxMonthlyRate) {
    hints.push('in Ihrer Budget-Richtung');
  }
  if (profile.drive === 'awd') hints.push('Allrad verfügbar');
  if (profile.children && attrs.seats >= 5) hints.push('genug Platz');
  if (profile.towCapacityKg && (attrs.towCapacityKg ?? 0) >= profile.towCapacityKg) {
    hints.push('hohe Anhängelast');
  }
  if (!hints.length) hints.push('grundlegend passend zu Ihren Angaben');
  return hints.slice(0, 3);
}

function scoreModel(attrs, profile) {
  let score = 0;
  const key = attrs.modelKey;

  if (profile.modelHint && key.startsWith(profile.modelHint)) score += 50;
  if (profile.selectedModelKey && key === profile.selectedModelKey) score += 60;

  if (profile.bodyType && attrs.bodyType === profile.bodyType) score += 20;

  if (!fuelMatchesProfile(attrs, profile)) return 0;
  score += 25;

  if (profile.fuel === 'diesel' && attrs.powertrains?.includes('verbrenner')) score += 20;
  if (getFuelCategory(profile) === 'electric' && attrs.fuel === 'electric') score += 25;

  if (profile.children) {
    if (attrs.seats >= 7) score += 12;
    else if (attrs.seats >= 5) score += 8;
  }

  if (profile.towCapacityKg) {
    const tow = attrs.towCapacityKg ?? 0;
    if (tow >= profile.towCapacityKg) score += 15;
    else if (tow > 0) score += 5;
  }

  if (profile.drive === 'awd' && attrs.bodyType === 'suv') score += 8;

  if (profile.usage?.includes('zweitwagen') && attrs.bodyClass === 'compact_suv') score += 10;
  if (profile.usage?.includes('stadt') && ['kleinwagen', 'compact', 'compact_suv'].includes(attrs.bodyClass)) {
    score += 8;
  }

  return score;
}

function familyKey(modelKey = '') {
  if (modelKey.startsWith('sportage')) return 'sportage';
  if (modelKey.startsWith('sorento')) return 'sorento';
  if (modelKey.startsWith('ev')) return modelKey.replace(/-gt$/, '').split('-')[0];
  return modelKey;
}

/**
 * @param {object} needProfile
 * @param {{ anchorModelKey?: string, limit?: number }} [options]
 */
export function buildVehicleDirectionsView(needProfile = {}, options = {}) {
  const { anchorModelKey = null, limit = 4 } = options;
  const scored = [];

  for (const attrs of Object.values(KIA_MODEL_ATTRIBUTES)) {
    const score = scoreModel(attrs, needProfile);
    if (score <= 0) continue;
    scored.push({
      modelKey: attrs.modelKey,
      label: attrs.label,
      score,
      subtitle: buildDirectionSubtitle(needProfile, attrs),
      fitHints: buildFitHints(needProfile, attrs),
      familyKey: familyKey(attrs.modelKey),
    });
  }

  scored.sort((a, b) => {
    if (anchorModelKey) {
      if (a.modelKey === anchorModelKey) return -1;
      if (b.modelKey === anchorModelKey) return 1;
      if (a.modelKey.startsWith(anchorModelKey)) return -1;
      if (b.modelKey.startsWith(anchorModelKey)) return 1;
    }
    return b.score - a.score;
  });

  const picked = [];
  const families = new Set();
  for (const entry of scored) {
    if (picked.length >= limit) break;
    const fam = entry.familyKey;
    if (families.has(fam) && !anchorModelKey?.startsWith(fam)) {
      const alreadyHasFamily = picked.some((p) => p.familyKey === fam);
      if (alreadyHasFamily && entry.modelKey !== anchorModelKey) continue;
    }
    families.add(fam);
    picked.push({
      modelKey: entry.modelKey,
      label: entry.label,
      subtitle: entry.subtitle,
      fitHints: entry.fitHints,
      highlighted: entry.modelKey === anchorModelKey
        || (anchorModelKey && entry.modelKey.startsWith(anchorModelKey)),
    });
  }

  return {
    intro: VEHICLE_DIRECTION_INTRO,
    directions: picked,
    reactions: {},
    anchorModelKey,
  };
}

export function isEvDirectionModel(modelKey = '') {
  return EV_MODEL_KEYS.has(modelKey);
}
