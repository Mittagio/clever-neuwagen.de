/**
 * Welt 1 – Primärempfehlung + Alternativen (kein Trim, keine Rate).
 */
import { KIA_MODEL_ATTRIBUTES } from '../../data/kia/kiaModelAttributes.js';
import { buildVehicleFitReasons } from '../dealer/vehicleSalesJourney.js';
import { CLEVER_WORLD } from './consultationWorlds.js';
import { buildUnderstoodLabels } from './needProfileService.js';

function modelLabelForKey(modelKey) {
  return KIA_MODEL_ATTRIBUTES[modelKey]?.label ?? modelKey;
}

function buildWhyLinesForModel(modelKey, group, ctx = {}) {
  const reasons = buildVehicleFitReasons(group, ctx) ?? [];
  const attrs = KIA_MODEL_ATTRIBUTES[modelKey];
  const lines = [...reasons];

  if (ctx.needProfile?.priorities?.includes('family') && attrs?.seats >= 5) {
    lines.push('Familienauto');
  }
  if (ctx.needProfile?.budget?.maxMonthlyRate) {
    lines.push('passt zum Budget');
  }
  if (ctx.needProfile?.priorities?.includes('range') && attrs?.fuel === 'electric') {
    lines.push('ausreichend Reichweite');
  }
  if (ctx.needProfile?.towing && ctx.needProfile.towing !== 'no' && (attrs?.towCapacityKg ?? 0) >= 750) {
    lines.push('Anhängerkupplung möglich');
  }

  return [...new Set(lines)].slice(0, 6);
}

/**
 * @param {object} params
 */
export function buildNeedWorldRecommendation({
  searchBundle = null,
  profile = null,
  searchProfile = null,
  searchWishes = [],
  chipIds = [],
  needProfile = null,
} = {}) {
  const enrichedProfile = searchProfile ?? {};
  const groups = searchBundle?.exact?.modelLineGroups ?? [];
  const ctx = {
    searchProfile: enrichedProfile,
    searchWishes,
    chipIds,
    needProfile,
  };

  if (!groups.length) {
    return {
      world: CLEVER_WORLD.NEED_CONSULTATION,
      ready: false,
      headline: null,
      primary: null,
      alternatives: [],
      message: 'Noch nicht genug Informationen – Clever braucht noch ein paar Angaben.',
      understoodLabels: buildUnderstoodLabels(needProfile ?? {}),
    };
  }

  const primaryGroup = groups[0];
  const primaryKey = primaryGroup?.modelLineKey
    ?? primaryGroup?.primaryMatch?.vehicle?.modelKey
    ?? null;

  if (!primaryKey) {
    return {
      world: CLEVER_WORLD.NEED_CONSULTATION,
      ready: false,
      headline: null,
      primary: null,
      alternatives: [],
      message: 'Noch keine klare Empfehlung möglich.',
      understoodLabels: buildUnderstoodLabels(needProfile ?? {}),
    };
  }

  const primaryLabel = modelLabelForKey(primaryKey);
  const whyLines = buildWhyLinesForModel(primaryKey, primaryGroup, ctx);
  if (!whyLines.length) whyLines.push('Passt gut zu Ihren Angaben');

  const alternatives = groups.slice(1, 3).map((group) => {
    const modelKey = group?.modelLineKey ?? group?.primaryMatch?.vehicle?.modelKey;
    const modelLabel = modelLabelForKey(modelKey);
    return {
      modelKey,
      modelLabel,
      vehicleTitle: `Kia ${modelLabel}`,
      tagline: group?.fitRecommendation ?? null,
    };
  }).filter((entry) => entry.modelKey);

  return {
    world: CLEVER_WORLD.NEED_CONSULTATION,
    ready: true,
    headline: `Nach Ihren Angaben würde ich zuerst den Kia ${primaryLabel} ansehen.`,
    primary: {
      modelKey: primaryKey,
      modelLabel: primaryLabel,
      vehicleTitle: `Kia ${primaryLabel}`,
      whyLines,
    },
    alternatives,
    understoodLabels: buildUnderstoodLabels(needProfile ?? {}),
    enrichedProfile,
    group: primaryGroup,
  };
}

/**
 * Mappt Need-World-Empfehlung auf bestehendes cleverRecommendation-Format (Abwärtskompatibilität).
 */
export function mapNeedRecommendationToLegacy(needRec = {}) {
  if (!needRec?.ready || !needRec.primary) return null;
  return {
    ready: true,
    world: needRec.world,
    modelKey: needRec.primary.modelKey,
    modelLabel: needRec.primary.modelLabel,
    trimId: null,
    trimLabel: null,
    vehicleTitle: needRec.primary.vehicleTitle,
    whyLines: needRec.primary.whyLines,
    alternatives: needRec.alternatives,
    headline: needRec.headline,
    needWorldPrimary: needRec.primary,
    needWorldAlternatives: needRec.alternatives,
  };
}
