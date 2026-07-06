/**
 * Conversation Planner – Phase 1.
 * Entscheidet, welche Frage jetzt sinnvoll ist (intent-aware, keine harte Reihenfolge).
 */
import { NEED_CONSULTATION_QUESTIONS, VEHICLE_EQUIPMENT_QUESTIONS } from './consultationQuestions.js';
import {
  getRecognitionQuestionBlocks,
  hasEquipmentWish,
  isAwdRecognized,
  isTowbarRecognized,
} from './needRecognitionService.js';
import { isMinimalVehicleWish } from './needProfileService.js';
import { CLEVER_WORLD } from './consultationWorlds.js';

export const PLANNER_PRIORITY = {
  high: 3,
  medium: 2,
  low: 1,
};

const EV_MODEL_KEYS = new Set([
  'ev3', 'ev4', 'ev4-fastback', 'ev5', 'ev6', 'ev9',
]);

const COMBUSTION_FUELS = new Set(['combustion', 'verbrenner', 'benzin', 'diesel']);
const ELECTRIC_FUELS = new Set(['electric', 'elektro']);
const PHEV_FUELS = new Set(['phev', 'plugin_hybrid', 'plug-in-hybrid']);
const HYBRID_FUELS = new Set(['hybrid']);

/** @typedef {'electric'|'phev'|'hybrid'|'combustion'|null} FuelCategory */

/**
 * @param {object} profile
 * @returns {FuelCategory}
 */
export function getFuelCategory(profile = {}) {
  const fuel = String(profile.fuel ?? '').toLowerCase();
  if (!fuel) return null;
  if (ELECTRIC_FUELS.has(fuel)) return 'electric';
  if (PHEV_FUELS.has(fuel)) return 'phev';
  if (HYBRID_FUELS.has(fuel)) return 'hybrid';
  if (COMBUSTION_FUELS.has(fuel)) return 'combustion';
  return null;
}

export function isCombustionProfile(profile = {}) {
  return getFuelCategory(profile) === 'combustion';
}

export function isElectricOrPhevProfile(profile = {}) {
  const cat = getFuelCategory(profile);
  return cat === 'electric' || cat === 'phev' || cat === 'hybrid';
}

function isFieldKnown(profile, answers, fieldIds = []) {
  return fieldIds.some((id) => answers?.[id] != null);
}

function baseQuestionById(id) {
  return NEED_CONSULTATION_QUESTIONS.find((q) => q.id === id)
    ?? VEHICLE_EQUIPMENT_QUESTIONS.find((q) => q.id === id)
    ?? null;
}

function isSportageInterest(profile = {}) {
  const key = profile.selectedModelKey ?? profile.modelHint ?? '';
  return String(key).startsWith('sportage');
}

/** Nur im Planner – nicht im Legacy-Katalog. */
const PLANNER_ONLY_NEED_QUESTIONS = [
  {
    id: 'primaryUsage',
    world: CLEVER_WORLD.NEED_CONSULTATION,
    priority: 'high',
    reason: 'Bei sehr allgemeinem Einstieg zuerst Nutzung klären.',
    prompt: 'Gerne. Wofür soll das Auto hauptsächlich genutzt werden?',
    options: [
      { id: 'daily', label: 'Alltag' },
      { id: 'family', label: 'Familie' },
      { id: 'work', label: 'Arbeit' },
      { id: 'leisure', label: 'Freizeit' },
      { id: 'towing', label: 'Anhänger' },
      { id: 'open', label: 'Noch offen' },
    ],
    visibleWhen: (ctx) => isMinimalVehicleWish(ctx.needProfile ?? {}),
    hiddenWhen: () => false,
    knownWhen: (ctx) => (ctx.needProfile?.usage?.length ?? 0) > 0 || ctx.answers?.primaryUsage != null,
  },
  {
    id: 'evModelPriority',
    world: CLEVER_WORLD.NEED_CONSULTATION,
    priority: 'high',
    reason: 'Modellinteresse Elektro – Reichweite vs. Ausstattung klären.',
    prompt: 'Ist Ihnen eher viel Reichweite oder gute Ausstattung wichtig?',
    options: [
      { id: 'range', label: 'Mehr Reichweite' },
      { id: 'equipment', label: 'Mehr Ausstattung' },
      { id: 'balanced', label: 'Beides ausgewogen' },
    ],
    visibleWhen: (ctx) => EV_MODEL_KEYS.has(ctx.needProfile?.selectedModelKey ?? ''),
    hiddenWhen: () => false,
    knownWhen: (ctx) => ctx.answers?.evModelPriority != null || ctx.answers?.ev3Priority != null,
  },
  {
    id: 'sportagePowertrain',
    world: CLEVER_WORLD.NEED_CONSULTATION,
    priority: 'high',
    reason: 'Sportage ohne klaren Antrieb – modellspezifische Antriebsfrage.',
    prompt: 'Kommt für Sie eher Benzin, Hybrid oder Plug-in-Hybrid infrage?',
    options: [
      { id: 'benzin', label: 'Benzin' },
      { id: 'hybrid', label: 'Hybrid' },
      { id: 'phev', label: 'Plug-in-Hybrid' },
      { id: 'open', label: 'Noch offen' },
    ],
    visibleWhen: (ctx) => isSportageInterest(ctx.needProfile ?? {}) && !getFuelCategory(ctx.needProfile),
    hiddenWhen: () => false,
    knownWhen: (ctx) => getFuelCategory(ctx.needProfile) != null || ctx.answers?.sportagePowertrain != null,
  },
  {
    id: 'towingUsage',
    world: CLEVER_WORLD.NEED_CONSULTATION,
    priority: 'medium',
    reason: 'AHK erkannt – Nutzung klären statt Grundsatzfrage.',
    prompt: 'Wofür möchten Sie die Anhängerkupplung hauptsächlich nutzen?',
    options: [
      { id: 'bike', label: 'Fahrradträger' },
      { id: 'trailer', label: 'Anhänger / Wohnwagen' },
      { id: 'occasional', label: 'Nur gelegentlich' },
      { id: 'open', label: 'Noch unklar' },
    ],
    visibleWhen: (ctx) => {
      const p = ctx.needProfile ?? {};
      return Boolean(p.towing && p.towing !== 'no') && !ctx.answers?.towingUsage;
    },
    hiddenWhen: (ctx) => ctx.answers?.towingUsage != null || ctx.needProfile?.towingUsage != null,
    knownWhen: (ctx) => ctx.answers?.towingUsage != null || ctx.needProfile?.towingUsage != null,
  },
  {
    id: 'fuel_type',
    world: CLEVER_WORLD.NEED_CONSULTATION,
    priority: 'high',
    reason: 'Ohne Antrieb können wir keine sinnvollen Folgefragen stellen.',
    prompt: 'Haben Sie beim Antrieb schon einen Favoriten – Benzin, Hybrid oder Elektro?',
    options: [
      { id: 'benzin', label: 'Benzin' },
      { id: 'hybrid', label: 'Hybrid' },
      { id: 'electric', label: 'Elektro' },
      { id: 'open', label: 'Noch offen' },
    ],
    visibleWhen: (ctx) => {
      if (getFuelCategory(ctx.needProfile)) return false;
      if (EV_MODEL_KEYS.has(ctx.needProfile?.selectedModelKey ?? '')) return false;
      if (isSportageInterest(ctx.needProfile ?? {})) return false;
      if (isMinimalVehicleWish(ctx.needProfile ?? {})) return false;
      return true;
    },
    hiddenWhen: () => false,
    knownWhen: (ctx) => getFuelCategory(ctx.needProfile) != null || ctx.answers?.fuel_type != null,
  },
  {
    id: 'allradNeed',
    world: CLEVER_WORLD.NEED_CONSULTATION,
    priority: 'medium',
    reason: 'Allrad-Nachfrage bei SUV, Anhänger oder unklarer Allrad-Relevanz.',
    prompt: 'Brauchen Sie Allrad wirklich – zum Beispiel wegen Anhänger, Schnee oder Gelände?',
    options: [
      { id: 'yes', label: 'Ja, wichtig' },
      { id: 'sometimes', label: 'Ab und zu' },
      { id: 'no', label: 'Eher nicht' },
    ],
    visibleWhen: (ctx) => {
      const p = ctx.needProfile ?? {};
      if (p.drive === 'awd' || p.allradNeed === 'yes') return false;
      if (p.drive === 'fwd' || p.drive === 'rwd' || p.allradNeed === 'no') return false;
      if (p.priorities?.includes('awd')) return false;
      return p.bodyType === 'suv'
        || (p.towing && p.towing !== 'no')
        || p.priorities?.includes('winter');
    },
    hiddenWhen: (ctx) => isAwdRecognized(ctx.needProfile)
      || ctx.answers?.allradNeed != null
      || ctx.needProfile?.allradNeed != null,
    knownWhen: (ctx) => isAwdRecognized(ctx.needProfile)
      || ctx.answers?.allradNeed != null
      || ctx.needProfile?.allradNeed != null,
  },
  {
    id: 'comfortVsSpace',
    world: CLEVER_WORLD.NEED_CONSULTATION,
    priority: 'high',
    reason: 'Bei Verbrenner mit Familie/Anhänger Komfort vs. Platz klären.',
    prompt: 'Soll es eher möglichst komfortabel sein – oder ist Ihnen vor allem viel Platz und Anhängelast wichtig?',
    options: [
      { id: 'comfort', label: 'Komfort' },
      { id: 'space', label: 'Platz & Nutzbarkeit' },
      { id: 'balanced', label: 'Beides' },
    ],
    visibleWhen: (ctx) => {
      if (!isCombustionProfile(ctx.needProfile)) return false;
      const p = ctx.needProfile ?? {};
      return p.modelHint === 'sportage'
        || (p.towing && p.towing !== 'no')
        || p.children
        || p.priorities?.includes('family');
    },
    hiddenWhen: () => false,
    knownWhen: (ctx) => ctx.answers?.comfortVsSpace != null,
  },
];

const NEED_QUESTION_RULES = {
  chargingAtHome: {
    priority: 'high',
    reason: 'Laden zuhause ist nur bei Elektro und Plug-in-Hybrid relevant.',
    visibleWhen: (ctx) => isElectricOrPhevProfile(ctx.needProfile),
    hiddenWhen: (ctx) => isCombustionProfile(ctx.needProfile),
    knownWhen: (ctx) => ctx.needProfile?.chargingAtHome != null || ctx.answers?.chargingAtHome != null,
  },
  longDistance: {
    priority: 'high',
    reason: 'Langstrecken-Nutzung für passende Beratung.',
    visibleWhen: () => true,
    hiddenWhen: () => false,
    knownWhen: (ctx) => ctx.needProfile?.longDistance != null || ctx.answers?.longDistance != null,
  },
  rangeImportance: {
    priority: 'low',
    reason: 'Reichweite nur bei Elektro relevant.',
    visibleWhen: (ctx) => isElectricOrPhevProfile(ctx.needProfile),
    hiddenWhen: (ctx) => isCombustionProfile(ctx.needProfile),
    knownWhen: (ctx) => ctx.needProfile?.priorities?.includes('range') || ctx.answers?.rangeImportance != null,
  },
  trunkImportance: {
    priority: 'low',
    reason: 'Kofferraum bei Familie oft schon erkannt.',
    visibleWhen: (ctx) => !ctx.needProfile?.children && ctx.needProfile?.bodyType !== 'pickup',
    hiddenWhen: (ctx) => ctx.needProfile?.bodyType === 'pickup',
    knownWhen: (ctx) => ctx.answers?.trunkImportance != null,
  },
  towCapacity: {
    priority: 'medium',
    reason: 'Anhängelast nur fragen, wenn noch nicht erkannt.',
    visibleWhen: (ctx) => !isTowbarRecognized(ctx.needProfile) && ctx.needProfile?.towing == null,
    hiddenWhen: (ctx) => isTowbarRecognized(ctx.needProfile) || ctx.needProfile?.towing != null,
    knownWhen: (ctx) => isTowbarRecognized(ctx.needProfile)
      || ctx.needProfile?.towing != null
      || ctx.answers?.towCapacity != null,
  },
};

const VEHICLE_QUESTION_RULES = {
  heatPump: {
    priority: 'medium',
    reason: 'Wärmepumpe betrifft Elektro-Fahrzeuge, nicht Verbrenner.',
    visibleWhen: (ctx) => isElectricOrPhevProfile(ctx.needProfile)
      && EV_MODEL_KEYS.has(ctx.selectedModelKey ?? ctx.needProfile?.selectedModelKey ?? ''),
    hiddenWhen: (ctx) => isCombustionProfile(ctx.needProfile)
      || hasEquipmentWish(ctx.needProfile, 'heat_pump'),
    knownWhen: (ctx) => ctx.answers?.heatPump != null
      || hasEquipmentWish(ctx.needProfile, 'heat_pump'),
  },
  v2l: {
    priority: 'medium',
    reason: 'V2L nur bei Elektro-Modellen relevant.',
    visibleWhen: (ctx) => getFuelCategory(ctx.needProfile) === 'electric'
      && EV_MODEL_KEYS.has(ctx.selectedModelKey ?? ctx.needProfile?.selectedModelKey ?? ''),
    hiddenWhen: (ctx) => isCombustionProfile(ctx.needProfile),
    knownWhen: (ctx) => ctx.answers?.v2l != null,
  },
  hud: {
    priority: 'low',
    reason: 'Ausstattungswunsch nach Modellwahl.',
    visibleWhen: (ctx) => Boolean(ctx.selectedModelKey ?? ctx.needProfile?.selectedModelKey),
    hiddenWhen: (ctx) => hasEquipmentWish(ctx.needProfile, 'head_up_display'),
    knownWhen: (ctx) => ctx.answers?.hud != null
      || hasEquipmentWish(ctx.needProfile, 'head_up_display'),
  },
};

function attachRules(question, rules) {
  return {
    ...question,
    rules: {
      priority: rules.priority ?? question.priority ?? 'low',
      reason: rules.reason ?? question.reason ?? 'Bedarfsfrage',
      visibleWhen: rules.visibleWhen ?? question.visibleWhen ?? (() => true),
      hiddenWhen: rules.hiddenWhen ?? question.hiddenWhen ?? (() => false),
      knownWhen: rules.knownWhen ?? question.knownWhen ?? (() => false),
    },
  };
}

function buildPlannerCandidates(world) {
  if (world === CLEVER_WORLD.VEHICLE_CONSULTATION) {
    return VEHICLE_EQUIPMENT_QUESTIONS.map((q) => attachRules(q, VEHICLE_QUESTION_RULES[q.id] ?? {
      priority: 'low',
      reason: 'Fahrzeug-Ausstattung',
      visibleWhen: () => true,
      hiddenWhen: () => false,
      knownWhen: (ctx) => ctx.answers?.[q.id] != null,
    }));
  }

  const catalog = NEED_CONSULTATION_QUESTIONS.map((q) => attachRules(q, NEED_QUESTION_RULES[q.id] ?? {
    priority: 'low',
    reason: 'Bedarfsfrage',
    visibleWhen: () => true,
    hiddenWhen: () => false,
    knownWhen: (ctx) => {
      if (ctx.answers?.[q.id] != null) return true;
      return q.skipIf?.({
        needProfile: ctx.needProfile,
        answers: ctx.answers,
        searchProfile: ctx.searchProfile,
        searchFilters: ctx.searchFilters,
      });
    },
  }));

  const plannerOnly = PLANNER_ONLY_NEED_QUESTIONS.map((q) => attachRules(q, {
    priority: q.priority,
    reason: q.reason,
    visibleWhen: q.visibleWhen,
    hiddenWhen: q.hiddenWhen,
    knownWhen: q.knownWhen,
  }));

  return [...plannerOnly, ...catalog];
}

function scoreCandidate(candidate) {
  return PLANNER_PRIORITY[candidate.rules.priority] ?? 1;
}

const QUESTION_TIE_ORDER = [
  'primaryUsage',
  'evModelPriority',
  'sportagePowertrain',
  'towingUsage',
  'fuel_type',
  'comfortVsSpace',
  'allradNeed',
  'longDistance',
  'chargingAtHome',
  'rangeImportance',
  'trunkImportance',
  'towCapacity',
  'passengers',
  'monthlyBudget',
  'paymentType',
  'annualKm',
  'heatPump',
  'v2l',
  'hud',
];

function compareCandidates(a, b) {
  const scoreDiff = scoreCandidate(b) - scoreCandidate(a);
  if (scoreDiff !== 0) return scoreDiff;
  const ai = QUESTION_TIE_ORDER.indexOf(a.id);
  const bi = QUESTION_TIE_ORDER.indexOf(b.id);
  return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
}

/**
 * @param {object} params
 */
export function planNextQuestion({
  world = CLEVER_WORLD.NEED_CONSULTATION,
  needProfile = {},
  answers = {},
  selectedModelKey = null,
  searchProfile = {},
  searchFilters = {},
} = {}) {
  const ctx = {
    needProfile,
    answers,
    selectedModelKey: selectedModelKey ?? needProfile?.selectedModelKey ?? null,
    searchProfile,
    searchFilters,
  };

  const candidates = buildPlannerCandidates(world)
    .filter((q) => {
      if (getRecognitionQuestionBlocks(needProfile).has(q.id)) return false;
      if (q.rules.hiddenWhen?.(ctx)) return false;
      if (!q.rules.visibleWhen?.(ctx)) return false;
      if (q.rules.knownWhen?.(ctx)) return false;
      if (q.skipIf?.({ ...ctx, needProfile, answers })) return false;
      return true;
    })
    .sort(compareCandidates);

  const winner = candidates[0] ?? null;
  if (!winner) {
    return { question: null, reason: 'Keine passende Frage mehr.', candidates: [] };
  }

  const base = baseQuestionById(winner.id);
  const question = {
    ...(base ?? {}),
    ...winner,
    id: winner.id,
    world: winner.world,
    prompt: winner.prompt ?? base?.prompt,
    options: winner.options ?? base?.options ?? [],
    plannerReason: winner.rules.reason ?? winner.reason,
  };

  return {
    question,
    reason: question.plannerReason,
    candidates: candidates.map((c) => c.id),
  };
}

/**
 * @param {string} questionId
 * @param {object} ctx
 */
export function isQuestionAllowed(questionId, ctx = {}) {
  const world = ctx.world ?? CLEVER_WORLD.NEED_CONSULTATION;
  const result = planNextQuestion({
    world,
    needProfile: ctx.needProfile ?? {},
    answers: ctx.answers ?? {},
    selectedModelKey: ctx.selectedModelKey,
    searchProfile: ctx.searchProfile ?? {},
    searchFilters: ctx.searchFilters ?? {},
  });

  if (result.question?.id === questionId) return true;

  const fullCtx = {
    needProfile: ctx.needProfile ?? {},
    answers: ctx.answers ?? {},
    selectedModelKey: ctx.selectedModelKey,
    searchProfile: ctx.searchProfile ?? {},
    searchFilters: ctx.searchFilters ?? {},
  };

  const all = buildPlannerCandidates(world);
  const target = all.find((q) => q.id === questionId);
  if (!target) return false;
  if (target.rules.hiddenWhen?.(fullCtx)) return false;
  if (!target.rules.visibleWhen?.(fullCtx)) return false;
  return true;
}

/**
 * Recommendation Readiness – keine EV-Empfehlung ohne Antrieb / bei Verbrenner.
 * @param {object} params
 */
/**
 * @param {string} id
 */
export function getConsultationQuestionById(id) {
  const plannerOnly = PLANNER_ONLY_NEED_QUESTIONS.find((q) => q.id === id);
  if (plannerOnly) {
    const base = baseQuestionById(id);
    return {
      ...(base ?? {}),
      ...plannerOnly,
      id: plannerOnly.id,
      prompt: plannerOnly.prompt ?? base?.prompt,
      options: plannerOnly.options ?? base?.options ?? [],
    };
  }
  return baseQuestionById(id);
}

export function evaluateRecommendationReadiness({
  needProfile = {},
  answers = {},
} = {}) {
  if (EV_MODEL_KEYS.has(needProfile.selectedModelKey ?? '') && getFuelCategory(needProfile) === 'electric') {
    const pending = planNextQuestion({ needProfile, answers });
    if (pending.question?.id === 'evModelPriority') {
      return {
        ready: false,
        blocker: 'model_priority',
        reason: 'Modellinteresse da – noch eine gezielte Frage.',
        suggestedQuestionId: 'evModelPriority',
      };
    }
  }

  const fuelCat = getFuelCategory(needProfile);

  if (!fuelCat) {
    return {
      ready: false,
      blocker: 'fuel_unknown',
      reason: 'Antrieb unbekannt – zuerst klären.',
      suggestedQuestionId: 'fuel_type',
    };
  }

  if (fuelCat === 'combustion') {
    return {
      ready: false,
      blocker: 'combustion',
      reason: 'Verbrenner-Wunsch – keine EV-Primärempfehlung.',
      suggestedQuestionId: null,
    };
  }

  const pending = planNextQuestion({
    world: CLEVER_WORLD.NEED_CONSULTATION,
    needProfile,
    answers,
  });

  if (pending.question?.id === 'fuel_type') {
    return {
      ready: false,
      blocker: 'fuel_unknown',
      reason: pending.reason,
      suggestedQuestionId: 'fuel_type',
    };
  }

  return {
    ready: true,
    blocker: null,
    reason: 'Ausreichend Kontext für Fahrzeugrichtung.',
    suggestedQuestionId: null,
  };
}
