/**
 * Clever Verkaufsberater – eine Frage pro Schritt, Empfehlung statt Trim-first.
 */
import { KIA_MODEL_ATTRIBUTES } from '../../data/kia/kiaModelAttributes.js';
import { KIA_TECHNICAL_SPECS } from '../../data/kia/kiaTechnicalSpecs.js';
import { findDealerWishChip } from '../../data/dealer/dealerWishCatalog.js';
import { chipToFeatureIds } from '../../data/features/equipmentWishChips.js';
import { buildVehicleFitReasons } from './vehicleSalesJourney.js';
import { recommendTrimForWishes } from './trimWishRecommendation.js';

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

/** @type {Array<object>} */
export const CONSULTATION_QUESTIONS = [
  {
    id: 'annualKm',
    prompt: 'Wie viele Kilometer fahren Sie pro Jahr?',
    hint: 'Hilft bei Leasing-Laufleistung und Reichweitenplanung.',
    options: [
      { id: '8000', label: 'bis 8.000 km' },
      { id: '12000', label: '8.000 – 12.000 km' },
      { id: '15000', label: '12.000 – 15.000 km' },
      { id: '20000', label: '15.000 – 20.000 km' },
      { id: '25000', label: 'über 20.000 km' },
    ],
    skipIf: (ctx) => Boolean(ctx.searchProfile?.mileagePerYear),
  },
  {
    id: 'paymentType',
    prompt: 'Leasing, Finanzierung oder Kauf?',
    options: [
      { id: 'leasing', label: 'Leasing' },
      { id: 'finance', label: 'Finanzierung' },
      { id: 'cash', label: 'Barzahlung' },
      { id: 'open', label: 'Noch unentschieden' },
    ],
    skipIf: (ctx) => Boolean(ctx.searchProfile?.paymentPreference || ctx.searchFilters?.payment),
  },
  {
    id: 'monthlyBudget',
    prompt: 'Gibt es ein monatliches Budget?',
    options: [
      { id: '200', label: 'bis 200 €' },
      { id: '300', label: 'bis 300 €' },
      { id: '400', label: 'bis 400 €' },
      { id: '500', label: 'bis 500 €' },
      { id: '600', label: 'über 500 €' },
      { id: 'open', label: 'Noch kein Budget' },
    ],
    skipIf: (ctx) => Boolean(ctx.searchProfile?.maxMonthlyRate || ctx.searchFilters?.maxRate),
  },
  {
    id: 'passengers',
    prompt: 'Wie viele Personen fahren regelmäßig mit?',
    options: [
      { id: '2', label: '1–2 Personen' },
      { id: '4', label: '3–4 Personen' },
      { id: '5', label: '5 Personen' },
      { id: '7', label: '6–7 Personen' },
    ],
    skipIf: (ctx) => (ctx.searchProfile?.seatsMin ?? 0) >= 5,
  },
  {
    id: 'towCapacity',
    prompt: 'Benötigen Sie Anhängelast?',
    options: [
      { id: 'no', label: 'Nein' },
      { id: 'light', label: 'Leichter Anhänger (bis 750 kg)' },
      { id: 'braked', label: 'Gebremster Anhänger (ab 1,5 t)' },
      { id: 'heavy', label: 'Wohnwagen / schwer (ab 2 t)' },
    ],
    skipIf: (ctx) => ctx.searchProfile?.requiredFeatures?.some((f) => f.startsWith('tow'))
      || (ctx.searchFilters?.towCapacityKg ?? 0) >= 750,
  },
  {
    id: 'rangeImportance',
    prompt: 'Wie wichtig sind Reichweite und Ladegeschwindigkeit?',
    options: [
      { id: 'low', label: 'Weniger wichtig' },
      { id: 'medium', label: 'Wichtig' },
      { id: 'high', label: 'Sehr wichtig' },
    ],
    skipIf: (ctx) => ctx.searchProfile?.requiredFeatures?.includes('range_400')
      || (ctx.searchFilters?.rangeKmMin ?? 0) >= 400,
  },
  {
    id: 'trunkImportance',
    prompt: 'Wie wichtig ist Kofferraumvolumen?',
    options: [
      { id: 'low', label: 'Weniger wichtig' },
      { id: 'medium', label: 'Wichtig' },
      { id: 'high', label: 'Sehr wichtig' },
    ],
    skipIf: (ctx) => ctx.searchProfile?.requiredFeatures?.includes('large_trunk'),
  },
  {
    id: 'heatPump',
    prompt: 'Benötigen Sie eine Wärmepumpe?',
    options: [
      { id: 'yes', label: 'Ja, unbedingt' },
      { id: 'nice', label: 'Schön, aber nicht Pflicht' },
      { id: 'no', label: 'Nein' },
    ],
    skipIf: (ctx) => ctx.answers?.heatPump != null,
  },
  {
    id: 'hud',
    prompt: 'Möchten Sie ein Head-up-Display?',
    options: [
      { id: 'yes', label: 'Ja' },
      { id: 'nice', label: 'Wäre schön' },
      { id: 'no', label: 'Nein' },
    ],
  },
  {
    id: 'v2l',
    prompt: 'Ist V2L oder bidirektionales Laden wichtig?',
    options: [
      { id: 'yes', label: 'Ja, wichtig' },
      { id: 'nice', label: 'Interessant, aber optional' },
      { id: 'no', label: 'Nein' },
    ],
    skipIf: (ctx) => ctx.searchProfile?.fuel !== 'electric' && ctx.searchFilters?.fuel !== 'elektro',
  },
];

const MIN_ANSWERS_FOR_RECOMMENDATION = 4;

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
  const answered = Object.keys(profile?.answers ?? {}).length;
  const total = CONSULTATION_QUESTIONS.filter((q) => !q.skipIf?.({ ...ctx, answers: profile?.answers })).length;
  return { answered, total, percent: total ? Math.round((answered / total) * 100) : 0 };
}

/**
 * @param {object} profile
 * @param {object} [ctx]
 */
export function getNextConsultationQuestion(profile, ctx = {}) {
  const answers = profile?.answers ?? {};
  for (const question of CONSULTATION_QUESTIONS) {
    if (answers[question.id] != null) continue;
    if (question.skipIf?.({ ...ctx, answers })) {
      continue;
    }
    return question;
  }
  return null;
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
    .filter((t) => t.trimId !== primaryId)
    .slice(0, 3)
    .map((t) => ({
      trimId: t.trimId,
      trimLabel: t.trimLabel,
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
}) {
  const answers = profile?.answers ?? {};
  const consultationChips = resolveChipIdsFromAnswers(answers);
  const mergedChipIds = [...new Set([...chipIds, ...consultationChips])];
  const wishFeatures = resolveWishFeatures(mergedChipIds);
  const enrichedProfile = enrichSearchProfileFromConsultation(searchProfile, profile);

  const groups = searchBundle?.exact?.modelLineGroups ?? [];
  const primaryGroup = groups[0] ?? null;
  const modelKey = primaryGroup?.modelLineKey
    ?? primaryGroup?.primaryMatch?.vehicle?.modelKey
    ?? null;

  if (!modelKey) {
    return {
      ready: false,
      message: 'Noch nicht genug Informationen für eine konkrete Empfehlung.',
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

  return {
    ready: true,
    modelKey,
    modelLabel,
    trimId: trimRec?.primary?.trimId ?? null,
    trimLabel,
    vehicleTitle,
    batteryLabel: attrs?.fuel === 'electric' ? trimRec?.primary?.batteryLabel ?? null : null,
    whyLines,
    alternatives,
    trimRecommendation: trimRec,
    wishChipIds: mergedChipIds,
    wishFeatures,
    enrichedProfile,
    cleverQuotePercent: trimRec?.primary?.cleverQuotePercent ?? primaryGroup?.modelQuote?.percent ?? null,
    group: primaryGroup,
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
    lines.push({ label: 'Clever Empfehlung', value: recommendation.vehicleTitle, highlight: true });
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
export function createConsultationLeadExtras({ profile, recommendation, handoffSummary }) {
  return {
    consultationProfile: profile,
    cleverRecommendation: recommendation?.ready ? {
      vehicleTitle: recommendation.vehicleTitle,
      modelKey: recommendation.modelKey,
      trimId: recommendation.trimId,
      trimLabel: recommendation.trimLabel,
      whyLines: recommendation.whyLines,
      alternatives: recommendation.alternatives,
    } : null,
    consultationHandoff: handoffSummary,
    entryMode: 'clever',
  };
}
