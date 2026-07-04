/**
 * Clever Verkaufsberater – eine Frage pro Schritt, Empfehlung statt Trim-first.
 */
import { KIA_MODEL_ATTRIBUTES } from '../../data/kia/kiaModelAttributes.js';
import { KIA_TECHNICAL_SPECS } from '../../data/kia/kiaTechnicalSpecs.js';
import { findDealerWishChip } from '../../data/dealer/dealerWishCatalog.js';
import { chipToFeatureIds } from '../../data/features/equipmentWishChips.js';
import { buildVehicleFitReasons } from './vehicleSalesJourney.js';
import { recommendTrimForWishes } from './trimWishRecommendation.js';
import {
  CONSULTATION_QUESTIONS,
  NEED_CONSULTATION_QUESTIONS,
  VEHICLE_EQUIPMENT_QUESTIONS,
} from '../consultation/consultationQuestions.js';
import { planNextQuestion } from '../consultation/conversationPlanner.js';
import { CLEVER_WORLD } from '../consultation/consultationWorlds.js';
import {
  buildNeedWorldRecommendation,
  mapNeedRecommendationToLegacy,
} from '../consultation/consultationRecommendation.js';

/** @typedef {'clever'|'classic'} CustomerEntryMode */

const KM_MAP = {
  '8000': 8000,
  '12000': 12000,
  '15000': 15000,
  '20000': 20000,
  '25000': 25000,
};

const PAYMENT_LABELS = {
  leasing: 'Leasing',
  finance: 'Finanzierung',
  cash: 'Kauf',
  open: 'Noch offen',
};

const IMPORTANCE_LABELS = {
  low: 'nicht wichtig',
  medium: 'wichtig',
  high: 'sehr wichtig',
};

/** @type {Array<object>} – re-export für Abwärtskompatibilität */
export { CONSULTATION_QUESTIONS, NEED_CONSULTATION_QUESTIONS, VEHICLE_EQUIPMENT_QUESTIONS };

const MIN_ANSWERS_FOR_RECOMMENDATION = 4;

const SALES_MODE_QUESTION_ORDER = [
  'paymentType',
  'monthlyBudget',
  'annualKm',
  'passengers',
  'towCapacity',
];

/**
 * @param {object} profile
 * @param {object} [ctx]
 */
function getOrderedConsultationQuestions(profile, ctx = {}) {
  const isSalesMode = profile?.salesIntent?.mode === 'sales';
  const base = NEED_CONSULTATION_QUESTIONS;
  if (!isSalesMode) return base;

  const byId = Object.fromEntries(base.map((q) => [q.id, q]));
  const ordered = SALES_MODE_QUESTION_ORDER
    .map((id) => byId[id])
    .filter(Boolean);
  const rest = base.filter((q) => !SALES_MODE_QUESTION_ORDER.includes(q.id));
  return [...ordered, ...rest];
}

function getOrderedVehicleQuestions(profile, ctx = {}) {
  const modelKey = ctx.primaryModelKey ?? ctx.needProfile?.selectedModelKey ?? null;
  if (!modelKey) return [];
  return VEHICLE_EQUIPMENT_QUESTIONS.filter((q) => !q.requiresModelKey || modelKey);
}

/**
 * @param {string} [initialWish]
 */
export function createConsultationProfile(initialWish = '') {
  return {
    initialWish: initialWish.trim(),
    answers: {},
    skipped: [],
    openQuestions: [],
    startedAt: new Date().toISOString(),
  };
}

/**
 * @param {object} profile
 * @param {object} [ctx]
 */
export function getConsultationProgress(profile, ctx = {}) {
  const questions = getOrderedConsultationQuestions(profile, ctx);
  const answered = Object.keys(profile?.answers ?? {}).length;
  const total = questions.filter((q) => !q.skipIf?.({ ...ctx, answers: profile?.answers })).length;
  return { answered, total, percent: total ? Math.round((answered / total) * 100) : 0 };
}

/**
 * @param {object} profile
 * @param {object} [ctx]
 */
export function getNextConsultationQuestion(profile, ctx = {}) {
  const result = planNextQuestion({
    world: CLEVER_WORLD.NEED_CONSULTATION,
    needProfile: ctx.needProfile ?? {},
    answers: profile?.answers ?? {},
    searchProfile: ctx.searchProfile ?? {},
    searchFilters: ctx.searchFilters ?? {},
  });
  if (!result.question) return null;
  const { plannerReason, rules, knownWhen, visibleWhen, hiddenWhen, ...question } = result.question;
  return question;
}

/**
 * Welt 2 – Ausstattungsfragen (nur mit gewähltem Modell).
 */
export function getNextVehicleConsultationQuestion(profile, ctx = {}) {
  const result = planNextQuestion({
    world: CLEVER_WORLD.VEHICLE_CONSULTATION,
    needProfile: ctx.needProfile ?? {},
    answers: profile?.answers ?? {},
    selectedModelKey: ctx.primaryModelKey ?? ctx.needProfile?.selectedModelKey ?? null,
    searchProfile: ctx.searchProfile ?? {},
    searchFilters: ctx.searchFilters ?? {},
  });
  if (!result.question) return null;
  const { plannerReason, rules, knownWhen, visibleWhen, hiddenWhen, ...question } = result.question;
  return question;
}

/**
 * @param {object} profile
 * @param {object} [ctx]
 */
export function hasEnoughForRecommendation(profile, ctx = {}) {
  const answers = profile?.answers ?? {};
  const answeredCount = Object.keys(answers).length;
  if (answeredCount >= MIN_ANSWERS_FOR_RECOMMENDATION) return true;
  if (answeredCount >= 2 && ctx.primaryModelKey) return true;
  const remaining = getNextConsultationQuestion(profile, ctx);
  return !remaining && answeredCount >= 2;
}

/**
 * @param {object} profile
 * @param {string} questionId
 * @param {string} answerId
 */
export function answerConsultationQuestion(profile, questionId, answerId) {
  return {
    ...profile,
    answers: { ...profile.answers, [questionId]: answerId },
  };
}

function resolveChipIdsFromAnswers(answers = {}) {
  const chipIds = [];
  if (answers.towCapacity === 'light' || answers.towCapacity === 'braked') chipIds.push('towbar');
  if (answers.towCapacity === 'braked') chipIds.push('tow_1500');
  if (answers.towCapacity === 'heavy') chipIds.push('tow_capacity_2000');
  if (answers.heatPump === 'yes') chipIds.push('heat_pump');
  if (answers.hud === 'yes' || answers.hud === 'nice') chipIds.push('head_up_display');
  if (answers.v2l === 'yes') chipIds.push('v2l');
  if (answers.rangeImportance === 'high') chipIds.push('range_400');
  if (answers.trunkImportance === 'high') chipIds.push('large_trunk');
  if (answers.passengers === '7') chipIds.push('seats_7');
  return [...new Set(chipIds)];
}

function resolveWishFeatures(chipIds = []) {
  const features = new Set();
  for (const chipId of chipIds) {
    const dealerChip = findDealerWishChip(chipId);
    if (dealerChip?.features?.length) {
      dealerChip.features.forEach((f) => features.add(f));
      continue;
    }
    chipToFeatureIds(chipId).forEach((f) => features.add(f));
  }
  return [...features];
}

/**
 * Reichert Suchprofil mit Beratungsantworten an.
 * @param {object} searchProfile
 * @param {object} profile
 */
export function enrichSearchProfileFromConsultation(searchProfile, profile) {
  const answers = profile?.answers ?? {};
  const next = { ...(searchProfile ?? {}) };

  if (answers.annualKm && KM_MAP[answers.annualKm]) {
    next.mileagePerYear = KM_MAP[answers.annualKm];
  }
  if (answers.paymentType && answers.paymentType !== 'open') {
    next.paymentPreference = answers.paymentType;
  }
  if (answers.monthlyBudget && answers.monthlyBudget !== 'open') {
    next.maxMonthlyRate = Number(answers.monthlyBudget);
  }
  if (answers.passengers) {
    const seats = Number(answers.passengers);
    if (seats >= 5) next.seatsMin = seats;
  }
  if (answers.rangeImportance === 'high') {
    next.requiredFeatures = [...new Set([...(next.requiredFeatures ?? []), 'range_400'])];
  }
  if (answers.trunkImportance === 'high') {
    next.requiredFeatures = [...new Set([...(next.requiredFeatures ?? []), 'large_trunk'])];
  }
  if (answers.towCapacity === 'heavy') {
    next.requiredFeatures = [...new Set([...(next.requiredFeatures ?? []), 'tow_capacity_2000', 'towbar'])];
  } else if (answers.towCapacity === 'braked' || answers.towCapacity === 'light') {
    next.requiredFeatures = [...new Set([...(next.requiredFeatures ?? []), 'towbar'])];
  }

  return next;
}

function buildConsultationReasons(answers, modelKey, trimRec) {
  const reasons = [];
  const attrs = KIA_MODEL_ATTRIBUTES[modelKey];
  const specs = KIA_TECHNICAL_SPECS[modelKey];

  if (answers.rangeImportance === 'high' && specs?.electricRangeKm) {
    reasons.push(`erfüllt Reichweitenwunsch (bis ${specs.electricRangeKm} km)`);
  }
  if (answers.heatPump === 'yes' && trimRec?.primary) {
    const hasHeat = trimRec.primary.includedLines?.some((l) => /wärmepumpe/i.test(l))
      || trimRec.primary.reasons?.some((l) => /wärmepumpe/i.test(l));
    if (hasHeat) reasons.push('Wärmepumpe verfügbar');
  }
  if (answers.passengers === '7' && attrs?.isSevenSeater) {
    reasons.push('geeignet für Familie');
  } else if (Number(answers.passengers) >= 4 && (attrs?.seats ?? 0) >= 5) {
    reasons.push('geeignet für Familie');
  }
  if (answers.monthlyBudget && answers.monthlyBudget !== 'open') {
    reasons.push(`passt ins Budget (bis ${answers.monthlyBudget} €)`);
  }
  if (answers.towCapacity && answers.towCapacity !== 'no' && attrs?.towCapacityKg >= 1500) {
    reasons.push('Anhängelast möglich');
  }
  if (answers.hud === 'yes' && trimRec?.primary?.reasons?.some((l) => /head-up/i.test(l))) {
    reasons.push('Head-up-Display verfügbar');
  }

  return [...new Set(reasons)].slice(0, 6);
}

function buildTrimAlternatives(trimRec) {
  if (!trimRec?.allTrims?.length) return [];
  const primaryId = trimRec.primary?.trimId;
  return trimRec.allTrims
    .filter(Boolean)
    .filter((t) => t.trimId !== primaryId)
    .slice(0, 3)
    .map((t) => ({
      trimId: t.trimId,
      trimLabel: t.trimLabel ?? t.name ?? 'Ausstattung',
      tagline: t.roleLabel || t.tagline || t.valueNote,
      medal: t.medal,
    }));
}

/**
 * @param {object} params
 */
export function buildCleverRecommendation({
  profile,
  searchBundle,
  searchProfile,
  searchFilters,
  searchWishes,
  chipIds = [],
  needProfile = null,
  world = CLEVER_WORLD.NEED_CONSULTATION,
  primaryModelKey = null,
}) {
  const needRec = buildNeedWorldRecommendation({
    profile,
    searchBundle,
    searchProfile: enrichSearchProfileFromConsultation(searchProfile, profile),
    searchWishes,
    chipIds,
    needProfile,
  });

  const resolvedModelKey = primaryModelKey
    ?? needProfile?.selectedModelKey
    ?? needRec.primary?.modelKey
    ?? null;

  if (world === CLEVER_WORLD.NEED_CONSULTATION && !primaryModelKey) {
    return mapNeedRecommendationToLegacy(needRec) ?? {
      ready: false,
      message: needRec.message,
      profile,
      openQuestions: needRec.ready ? [] : ['Noch ein paar Angaben für eine Empfehlung'],
      understoodLabels: needRec.understoodLabels,
    };
  }

  const answers = profile?.answers ?? {};
  const consultationChips = resolveChipIdsFromAnswers(answers);
  const mergedChipIds = [...new Set([...chipIds, ...consultationChips])];
  const wishFeatures = resolveWishFeatures(mergedChipIds);
  const enrichedProfile = enrichSearchProfileFromConsultation(searchProfile, profile);

  const groups = searchBundle?.exact?.modelLineGroups ?? [];
  const primaryGroup = groups.find(
    (g) => (g.modelLineKey ?? g.primaryMatch?.vehicle?.modelKey) === resolvedModelKey,
  ) ?? groups[0] ?? null;
  const modelKey = resolvedModelKey
    ?? primaryGroup?.modelLineKey
    ?? primaryGroup?.primaryMatch?.vehicle?.modelKey
    ?? null;

  if (!modelKey) {
    return {
      ready: false,
      message: 'Noch nicht genug Informationen – das Autohaus kann Ihre Wünsche prüfen.',
      profile,
      openQuestions: ['Welches Fahrzeugmodell interessiert Sie?'],
    };
  }

  const trimRec = recommendTrimForWishes(
    modelKey,
    wishFeatures,
    enrichedProfile,
    searchFilters,
    mergedChipIds,
  );

  const attrs = KIA_MODEL_ATTRIBUTES[modelKey];
  const modelLabel = attrs?.label ?? modelKey;
  const trimLabel = trimRec?.primary?.trimLabel ?? '';
  const vehicleTitle = `Kia ${modelLabel}${trimLabel ? ` ${trimLabel}` : ''}`.trim();

  const fitReasons = buildVehicleFitReasons(primaryGroup, {
    searchProfile: enrichedProfile,
    searchWishes,
    chipIds: mergedChipIds,
  });
  const consultationReasons = buildConsultationReasons(answers, modelKey, trimRec);
  const whyLines = [...new Set([...consultationReasons, ...fitReasons])].slice(0, 6);

  if (!whyLines.length) {
    whyLines.push('Passt gut zu Ihren Angaben');
  }

  const alternatives = buildTrimAlternatives(trimRec);
  const needLegacy = mapNeedRecommendationToLegacy(needRec);

  return {
    ready: true,
    world: CLEVER_WORLD.VEHICLE_CONSULTATION,
    modelKey,
    modelLabel,
    trimId: trimRec?.primary?.trimId ?? null,
    trimLabel,
    vehicleTitle,
    batteryLabel: attrs?.fuel === 'electric' ? trimRec?.primary?.batteryLabel ?? null : null,
    whyLines,
    alternatives,
    needWorldPrimary: needLegacy?.needWorldPrimary ?? needRec.primary,
    needWorldAlternatives: needLegacy?.needWorldAlternatives ?? needRec.alternatives,
    headline: needRec.headline,
    trimRecommendation: trimRec,
    wishChipIds: mergedChipIds,
    wishFeatures,
    enrichedProfile,
    cleverQuotePercent: trimRec?.primary?.cleverQuotePercent ?? primaryGroup?.modelQuote?.percent ?? null,
    group: primaryGroup,
    understoodLabels: needRec.understoodLabels,
  };
}

/**
 * @param {object} profile
 * @param {object|null} recommendation
 */
export function buildConsultationHandoffSummary(profile, recommendation = null) {
  const answers = profile?.answers ?? {};
  const lines = [];

  if (profile?.initialWish) lines.push({ label: 'Ausgangswunsch', value: profile.initialWish });

  if (answers.annualKm) {
    const opt = CONSULTATION_QUESTIONS.find((q) => q.id === 'annualKm')?.options
      ?.find((o) => o.id === answers.annualKm);
    lines.push({ label: 'Kilometer pro Jahr', value: opt?.label ?? answers.annualKm });
  }
  if (answers.paymentType) {
    lines.push({ label: 'Zahlungsart', value: PAYMENT_LABELS[answers.paymentType] ?? answers.paymentType });
  }
  if (answers.monthlyBudget && answers.monthlyBudget !== 'open') {
    lines.push({ label: 'Monatsbudget', value: `bis ${answers.monthlyBudget} €` });
  }
  if (answers.passengers) {
    const opt = CONSULTATION_QUESTIONS.find((q) => q.id === 'passengers')?.options
      ?.find((o) => o.id === answers.passengers);
    lines.push({ label: 'Mitfahrer', value: opt?.label ?? answers.passengers });
  }
  if (answers.towCapacity && answers.towCapacity !== 'no') {
    const opt = CONSULTATION_QUESTIONS.find((q) => q.id === 'towCapacity')?.options
      ?.find((o) => o.id === answers.towCapacity);
    lines.push({ label: 'Anhängelast', value: opt?.label ?? answers.towCapacity });
  }
  if (answers.rangeImportance) {
    lines.push({ label: 'Reichweite', value: IMPORTANCE_LABELS[answers.rangeImportance] });
  }
  if (answers.heatPump === 'yes') lines.push({ label: 'Wärmepumpe', value: 'gewünscht' });
  if (answers.hud === 'yes') lines.push({ label: 'Head-up-Display', value: 'gewünscht' });
  if (answers.v2l === 'yes') lines.push({ label: 'V2L', value: 'gewünscht' });

  if (recommendation?.ready) {
    lines.push({ label: 'Passende Richtung', value: recommendation.vehicleTitle, highlight: true });
    if (recommendation.whyLines?.length) {
      lines.push({ label: 'Gründe', value: recommendation.whyLines.join(' · ') });
    }
  }

  const openQuestions = (profile?.openQuestions ?? []).filter(Boolean);
  if (answers.paymentType === 'open') openQuestions.push('Zahlungsart final klären');
  if (answers.monthlyBudget === 'open') openQuestions.push('Monatliches Budget festlegen');

  return {
    lines,
    openQuestions: [...new Set(openQuestions)],
    recognizedWishes: resolveChipIdsFromAnswers(answers).map((id) => findDealerWishChip(id)?.label).filter(Boolean),
  };
}

/**
 * @param {object} params
 */
export function createConsultationLeadExtras({
  profile,
  recommendation,
  handoffSummary,
  sourceMode = 'advisor_mode',
  sourceModelKey = null,
  entryMode = 'clever',
}) {
  return {
    consultationProfile: profile,
    salesIntent: profile?.salesIntent ?? null,
    cleverRecommendation: recommendation?.ready ? {
      vehicleTitle: recommendation.vehicleTitle,
      modelKey: recommendation.modelKey,
      trimId: recommendation.trimId,
      trimLabel: recommendation.trimLabel,
      whyLines: recommendation.whyLines,
      alternatives: recommendation.alternatives,
    } : null,
    consultationHandoff: handoffSummary,
    sourceMode,
    sourceModelKey,
    entryMode,
  };
}
