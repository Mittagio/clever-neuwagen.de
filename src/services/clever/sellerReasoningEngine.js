/**
 * Seller Reasoning Engine v1.0 – read-only.
 * Liest needProfile + buildCustomerUnderstanding(), schreibt nichts.
 */
import { KIA_MODEL_ATTRIBUTES } from '../../data/kia/kiaModelAttributes.js';
import { NEED_CONSULTATION_QUESTIONS } from '../consultation/consultationQuestions.js';
import { buildCustomerUnderstanding } from '../dealer/customerUnderstanding.js';

const ELECTRIC_FUELS = new Set(['electric', 'elektro']);
const PHEV_FUELS = new Set(['phev', 'plugin_hybrid', 'plug-in-hybrid']);
const HYBRID_FUELS = new Set(['hybrid']);
const COMBUSTION_FUELS = new Set(['combustion', 'verbrenner', 'benzin', 'diesel']);

function getFuelCategory(profile = {}) {
  const fuel = String(profile.fuel ?? '').toLowerCase();
  if (!fuel) return null;
  if (ELECTRIC_FUELS.has(fuel)) return 'electric';
  if (PHEV_FUELS.has(fuel)) return 'phev';
  if (HYBRID_FUELS.has(fuel)) return 'hybrid';
  if (COMBUSTION_FUELS.has(fuel)) return 'combustion';
  return null;
}

const MODEL_CATALOG = {
  ev2: { modelKey: 'ev2', modelLabel: 'Kia EV2', tagline: 'Kompakt für Stadt und Alltag', rateFrom: 239 },
  ev3: { modelKey: 'ev3', modelLabel: 'Kia EV3', tagline: 'Familienliebling', rateFrom: 299 },
  ev4: { modelKey: 'ev4', modelLabel: 'Kia EV4', tagline: 'Moderne Elektro-Limousine', rateFrom: 269 },
  ev5: { modelKey: 'ev5', modelLabel: 'Kia EV5', tagline: 'Mehr Platz', rateFrom: 419 },
  ev6: { modelKey: 'ev6', modelLabel: 'Kia EV6', tagline: 'Langstreckenprofi', rateFrom: 399 },
  ev9: { modelKey: 'ev9', modelLabel: 'Kia EV9', tagline: 'Premium Familien-SUV', rateFrom: 699 },
  sportage: { modelKey: 'sportage', modelLabel: 'Kia Sportage', tagline: 'Familien-SUV', rateFrom: 199 },
  'sportage-hybrid': { modelKey: 'sportage-hybrid', modelLabel: 'Kia Sportage HEV', tagline: 'Hybrid-Allrounder', rateFrom: 219 },
  'sportage-phev': { modelKey: 'sportage-phev', modelLabel: 'Kia Sportage PHEV', tagline: 'Plug-in Hybrid', rateFrom: 289 },
  'sorento-hybrid': { modelKey: 'sorento-hybrid', modelLabel: 'Kia Sorento HEV', tagline: 'Großer Hybrid-SUV', rateFrom: 349 },
  ceed: { modelKey: 'ceed', modelLabel: 'Kia Ceed', tagline: 'Kompakter Allrounder', rateFrom: 179 },
  niro: { modelKey: 'niro', modelLabel: 'Kia Niro', tagline: 'Kompakt-Hybrid', rateFrom: 209 },
};

const EV3_TRIM_HYPOTHESES = [
  { modelKey: 'ev3', title: 'Kia EV3 Air', subtitle: 'Günstigste Rate', rateFrom: 299, trimId: 'air' },
  { modelKey: 'ev3', title: 'Kia EV3 Earth', subtitle: 'Ausgewogene Ausstattung', rateFrom: 329, trimId: 'earth' },
  { modelKey: 'ev3', title: 'Kia EV3 GT-Line', subtitle: 'Mehr Ausstattung', rateFrom: 369, trimId: 'gt-line' },
];

const TOW_CAPACITY_KG = {
  ev2: 0,
  ev3: 1000,
  ev4: 1000,
  ev5: 1600,
  ev6: 1600,
  ev9: 2500,
  sportage: 1650,
  'sportage-hybrid': 1650,
  'sportage-phev': 1350,
  'sorento-hybrid': 2500,
  ceed: 1300,
  niro: 750,
};

const QUESTION_OPTION_MAP = {
  longDistance: ['rarely', 'sometimes', 'often'],
  chargingAtHome: ['yes', 'maybe', 'no', 'open'],
  evModelPriority: ['price', 'range', 'equipment', 'balanced'],
  towingUsage: ['small_trailer', 'caravan', 'horse', 'boat', 'open'],
  sportagePowertrain: ['benzin', 'hybrid', 'phev', 'open'],
  primaryUsage: ['daily', 'family', 'work', 'leisure', 'towing', 'open'],
  comfortVsSpace: ['comfort', 'space', 'balanced'],
  fuel_type: ['benzin', 'hybrid', 'electric', 'open'],
  vehicleNeedTiming: ['asap', '8weeks', 'later', 'open'],
  vehicleReturnDate: ['2026-10', '2026-12', '2027-03', '2027-06', 'unknown'],
};

const FORBIDDEN_SELLER_PHRASES = [
  /perfekt für sie/i,
  /sie sollten kaufen/i,
  /beste wahl/i,
  /passt zu 100\s*%/i,
  /das richtige fahrzeug/i,
  /unsere empfehlung/i,
];

function sanitizeNeedDiscoveryCopy(text = '') {
  const raw = String(text ?? '').trim();
  if (!raw) return raw;
  for (const pattern of FORBIDDEN_SELLER_PHRASES) {
    if (pattern.test(raw)) {
      return 'Diese Fahrzeuge würden aktuell zu Ihren Angaben passen.';
    }
  }
  return raw;
}

function includesAny(blob, tests = []) {
  return tests.some((t) => t.test(blob));
}

function formatRate(rateFrom) {
  if (!rateFrom) return null;
  const n = Number(rateFrom);
  if (!Number.isFinite(n) || n <= 0) return null;
  return `ab ${n.toLocaleString('de-DE')} €/Monat`;
}

function effectiveTowKg(modelKey) {
  const attrs = KIA_MODEL_ATTRIBUTES[modelKey] ?? {};
  return Number(attrs.towCapacityKg ?? TOW_CAPACITY_KG[modelKey] ?? 0);
}

function normalizeBudgetCap(understanding = {}, needProfile = {}) {
  const labels = understanding?.verstaendnis?.labels ?? [];
  const labelBlob = labels.join(' ').toLowerCase();
  const m = labelBlob.match(/budget\s+bis\s+(\d{2,4})\s*€\/monat/i)
    || labelBlob.match(/budget\s+(\d{2,4})\s*€\/monat/i)
    || labelBlob.match(/bis\s+(\d{2,4})\s*€\/monat/i);
  if (m) {
    const cap = Number(m[1]);
    if (Number.isFinite(cap)) return cap;
  }
  return needProfile.budget?.maxMonthlyRate ?? null;
}

function baseCandidates(understanding = {}, needProfile = {}) {
  const labels = understanding?.verstaendnis?.labels ?? [];
  const blob = labels.join(' ').toLowerCase();
  const fuel = getFuelCategory(needProfile);

  if (needProfile.selectedModelKey === 'ev3' && includesAny(blob, [/leasing|rate|monat/i])) {
    return EV3_TRIM_HYPOTHESES.map((t) => t.modelKey);
  }

  if (fuel === 'electric' || includesAny(blob, [/elektro/, /\bev\d\b/, /reichweite/, /schnellladen/])) {
    return ['ev3', 'ev5', 'ev6', 'ev9'];
  }
  if (fuel === 'hybrid' || fuel === 'phev' || includesAny(blob, [/hybrid/, /plug-in/])) {
    return ['sportage-hybrid', 'sportage-phev', 'sorento-hybrid'];
  }
  if (includesAny(blob, [/sportage/])) {
    return ['sportage-hybrid', 'sportage-phev', 'sportage'];
  }
  return ['sportage', 'ev3', 'ev5', 'ceed'];
}

function checkHardExclusion(modelKey, needProfile = {}, userExcluded = []) {
  if (userExcluded.includes(modelKey)) {
    return { excluded: true, reason: 'Passt optisch nicht', faded: true };
  }

  const requiredTow = Number(needProfile.towCapacityKg ?? 0);
  if (requiredTow >= 750) {
    const maxTow = effectiveTowKg(modelKey);
    if (maxTow > 0 && maxTow < requiredTow) {
      return {
        excluded: true,
        reason: `Anhängelast zu gering (max. ${maxTow.toLocaleString('de-DE')} kg)`,
        faded: true,
      };
    }
    if (maxTow === 0 && includesAny(String(modelKey), [/ev2|ev4|ceed|niro/])) {
      return { excluded: true, reason: 'Keine Anhängelast', faded: true };
    }
  }

  const cap = needProfile.budget?.maxMonthlyRate;
  const meta = MODEL_CATALOG[modelKey];
  if (cap && meta?.rateFrom && meta.rateFrom > cap * 1.15) {
    return { excluded: true, reason: 'Über Budget', faded: true };
  }

  return { excluded: false };
}

function scoreCandidate(modelKey, understanding = {}, answers = {}, needProfile = {}) {
  const meta = MODEL_CATALOG[modelKey] ?? { modelKey, modelLabel: modelKey };
  const attrs = KIA_MODEL_ATTRIBUTES[modelKey] ?? {};
  const labels = understanding?.verstaendnis?.labels ?? [];
  const blob = labels.join(' ').toLowerCase();
  const cap = normalizeBudgetCap(understanding, needProfile);

  let score = 10;
  const reasons = [];

  if (cap != null && meta.rateFrom != null) {
    if (meta.rateFrom <= cap) {
      score += 18;
      reasons.push('Preis-Leistung');
    } else {
      score -= 24;
    }
  }

  if (includesAny(blob, [/familie/, /kinder/, /kinderwagen/, /isofix/, /hund/])) {
    if (attrs.bodyClass === 'family_suv' || attrs.bodyClass === 'large_suv') {
      score += 22;
      reasons.push('Familie');
    } else if (attrs.bodyClass === 'compact_suv') {
      score += 14;
      reasons.push('Familientauglich');
    }
  }

  if (includesAny(blob, [/reichweite|langstrecke|400\s*km/i]) || needProfile.priorities?.includes('range')) {
    const range = attrs.typicalRangeKm ?? 0;
    if (range >= 500) {
      score += 20;
      reasons.push('Reichweite');
    } else if (range >= 430) {
      score += 12;
      reasons.push('Reichweite');
    }
  }

  const requiredTow = Number(needProfile.towCapacityKg ?? 0);
  if (requiredTow >= 750) {
    const maxTow = effectiveTowKg(modelKey);
    if (maxTow >= requiredTow) {
      score += 24;
      reasons.push('Anhängelast');
    }
  }

  if (answers.longDistance === 'often') {
    if (modelKey === 'ev6' || modelKey === 'ev9') {
      score += 30;
      reasons.push('Reisen');
    }
    if (modelKey === 'ev3') score += 8;
    if (modelKey === 'ev5') score -= 6;
  }

  if (answers.longDistance === 'rarely') {
    if (modelKey === 'ev3' || modelKey === 'ev2') score += 16;
    if (modelKey === 'ev6') score -= 10;
  }

  if (answers.evModelPriority === 'price') {
    if (modelKey === 'ev3' || meta.rateFrom <= 320) score += 22;
    reasons.push('Preis-Leistung');
  }
  if (answers.evModelPriority === 'range') {
    if (modelKey === 'ev6' || modelKey === 'ev9') score += 24;
    reasons.push('Reichweite');
  }
  if (answers.evModelPriority === 'equipment') {
    if (modelKey === 'ev5' || modelKey === 'ev9') score += 18;
    reasons.push('Ausstattung');
  }

  if (answers.towingUsage === 'trailer') {
    if (modelKey === 'sorento-hybrid' || modelKey === 'ev9') score += 16;
    if (modelKey === 'sportage-phev') score += 8;
  }

  if (labels.some((l) => String(l).toLowerCase() === modelKey.replace('-hybrid', '').replace('-phev', ''))) {
    score += 20;
    reasons.push('Explizit genannt');
  }

  return { score, reasons: [...new Set(reasons)].slice(0, 3) };
}

function toMatchPercent(score, topScore, excluded = false) {
  if (excluded) return Math.max(12, Math.min(28, Math.round(score > 0 ? 22 : 18)));
  const spread = Math.max(topScore, 1);
  const ratio = Math.max(0, score / spread);
  return Math.round(72 + ratio * 23);
}

function rankVehicleHypothesis({
  customerUnderstanding = {},
  needProfile = {},
  answers = {},
  userExcluded = [],
  limit = 3,
  includeFaded = true,
} = {}) {
  const keys = baseCandidates(customerUnderstanding, needProfile);
  const isEv3Leasing = needProfile.selectedModelKey === 'ev3'
    && includesAny((customerUnderstanding?.verstaendnis?.labels ?? []).join(' ').toLowerCase(), [/leasing|rate|monat/i]);

  const raw = (isEv3Leasing ? EV3_TRIM_HYPOTHESES : keys.map((k) => ({ ...MODEL_CATALOG[k], modelKey: k })))
    .filter(Boolean)
    .map((entry) => {
      const modelKey = entry.modelKey;
      const exclusion = checkHardExclusion(modelKey, needProfile, userExcluded);
      const s = scoreCandidate(modelKey, customerUnderstanding, answers, needProfile);
      return {
        modelKey,
        title: entry.title ?? entry.modelLabel ?? modelKey,
        subtitle: entry.subtitle ?? entry.tagline ?? '',
        rateLine: formatRate(entry.rateFrom),
        reasons: exclusion.excluded ? [] : s.reasons,
        exclusionReason: exclusion.excluded ? exclusion.reason : null,
        faded: exclusion.excluded,
        score: exclusion.excluded ? Math.min(s.score, 8) : s.score,
      };
    })
    .sort((a, b) => b.score - a.score);

  const topScore = raw.find((item) => !item.faded)?.score ?? raw[0]?.score ?? 1;

  const withPercent = raw.map((item) => ({
    ...item,
    matchPercent: toMatchPercent(item.score, topScore, item.faded),
  }));

  const active = withPercent.filter((item) => !item.faded).slice(0, limit);
  const faded = includeFaded
    ? withPercent.filter((item) => item.faded).slice(0, 2)
    : [];

  return { active, faded, all: withPercent };
}

function shortModelName(title = '') {
  return String(title).replace(/^Kia\s+/i, '').trim();
}

export function buildSellerHypothesisLead({ active = [] } = {}) {
  if (!active.length) return null;
  const names = active.slice(0, 2).map((item) => shortModelName(item.title));
  if (names.length === 1) {
    return `Dann würde ich aktuell eher Richtung ${names[0]} schauen.`;
  }
  return `Mit Ihren bisherigen Angaben würde ich aktuell eher Richtung ${names[0]} oder ${names[1]} schauen.`;
}

/**
 * Lautes Denken vor der nächsten Unsicherheitsfrage (Verkäufer-Loop).
 */
export function buildSellerThoughtBeforeQuestion({
  needProfile = {},
  answers = {},
  customerUnderstanding = null,
  userExcluded = [],
  includeAck = false,
} = {}) {
  const reasoning = runSellerReasoning({
    needProfile,
    answers,
    customerUnderstanding,
    userExcluded,
  });

  const lead = reasoning.hypothesisLead ?? reasoning.intro;
  if (!lead) return null;

  const sanitized = sanitizeNeedDiscoveryCopy(lead);
  if (includeAck) {
    return `Verstanden.\n\n${sanitized}`;
  }
  return sanitized;
}

export function buildExclusionExplanation({ faded = [] } = {}) {
  const first = faded[0];
  if (!first?.exclusionReason) return null;
  const name = shortModelName(first.title);
  if (/anhängelast/i.test(first.exclusionReason)) {
    return `Der ${name} fällt hier eher raus – ${first.exclusionReason.toLowerCase()}.`;
  }
  return null;
}

function rankingFingerprint(items = []) {
  return items.map((item) => `${item.modelKey}:${item.matchPercent}:${item.faded ? 'x' : 'a'}`).join('|');
}

function simulateAnswers(answers = {}, questionId, optionId) {
  return { ...answers, [questionId]: optionId };
}

function questionById(id) {
  return NEED_CONSULTATION_QUESTIONS.find((q) => q.id === id) ?? null;
}

/**
 * Misst, wie stark eine Frage die Fahrzeughypothese verändern würde.
 */
export function scoreQuestionImpact({
  questionId,
  needProfile = {},
  answers = {},
  customerUnderstanding = null,
  userExcluded = [],
} = {}) {
  const understanding = customerUnderstanding
    ?? buildCustomerUnderstanding({ crm: { needProfile } });

  const before = rankVehicleHypothesis({
    customerUnderstanding: understanding,
    needProfile,
    answers,
    userExcluded,
    includeFaded: false,
  });

  const options = QUESTION_OPTION_MAP[questionId]
    ?? questionById(questionId)?.options?.map((o) => o.id)
    ?? [];

  if (!options.length) return 1;

  let maxDelta = 0;
  for (const optionId of options) {
    const simulated = simulateAnswers(answers, questionId, optionId);
    const after = rankVehicleHypothesis({
      customerUnderstanding: understanding,
      needProfile,
      answers: simulated,
      userExcluded,
      includeFaded: false,
    });
    const fpBefore = rankingFingerprint(before.active);
    const fpAfter = rankingFingerprint(after.active);
    let delta = fpBefore === fpAfter ? 0 : 40;
    delta += Math.abs((before.active[0]?.matchPercent ?? 0) - (after.active[0]?.matchPercent ?? 0));
    if (before.active[0]?.modelKey !== after.active[0]?.modelKey) delta += 35;
    maxDelta = Math.max(maxDelta, delta);
  }

  return maxDelta;
}

const UNCERTAINTY_QUESTION_HINTS = {
  longDistance: 'Nutzung',
  towingUsage: 'Anhängerart',
  evModelPriority: 'Priorität',
  sportagePowertrain: 'Antrieb',
  chargingAtHome: 'Laden zuhause',
  primaryUsage: 'Nutzung',
  comfortVsSpace: 'Komfort vs. Platz',
  fuel_type: 'Antrieb',
  vehicleNeedTiming: 'Lieferzeit',
  vehicleReturnDate: 'Rückgabe',
};

/**
 * Haupt-API: Seller Reasoning Loop (read-only).
 */
export function runSellerReasoning({
  needProfile = {},
  answers = {},
  customerUnderstanding = null,
  userExcluded = [],
  pendingQuestionId = null,
} = {}) {
  const understanding = customerUnderstanding
    ?? buildCustomerUnderstanding({ crm: { needProfile } });

  if (!understanding?.meta?.hasData) {
    return {
      intro: null,
      hypothesisLead: null,
      items: [],
      fadedItems: [],
      exclusionNote: null,
      topUncertainty: null,
    };
  }

  const { active, faded } = rankVehicleHypothesis({
    customerUnderstanding: understanding,
    needProfile,
    answers,
    userExcluded,
  });

  const hypothesisLead = buildSellerHypothesisLead({ active });
  const exclusionNote = buildExclusionExplanation({ faded });

  let intro = hypothesisLead
    ?? 'Diese Fahrzeuge würden aktuell zu Ihren Angaben passen.';

  intro = sanitizeNeedDiscoveryCopy(intro);

  if (exclusionNote && !pendingQuestionId) {
    intro = `${exclusionNote}\n\n${intro}`;
  }

  const topUncertainty = pendingQuestionId
    ? { questionId: pendingQuestionId, label: UNCERTAINTY_QUESTION_HINTS[pendingQuestionId] ?? 'Details' }
    : null;

  return {
    intro,
    hypothesisLead,
    items: active,
    fadedItems: faded,
    exclusionNote,
    topUncertainty,
  };
}

export function buildSellerQuestionPrompt({
  needProfile = {},
  answers = {},
  question = {},
  customerUnderstanding = null,
  userExcluded = [],
} = {}) {
  if (question.id === 'longDistance') {
    return 'Wie nutzen Sie das Fahrzeug überwiegend?';
  }

  if (question.id === 'towingUsage') {
    return 'Was möchten Sie hauptsächlich ziehen?';
  }

  if (question.id === 'vehicleNeedTiming') {
    return 'Wann benötigen Sie Ihr neues Fahrzeug ungefähr?';
  }

  if (question.id === 'vehicleReturnDate') {
    return 'Wann geben Sie Ihr aktuelles Fahrzeug ungefähr zurück?';
  }

  if (question.id === 'evModelPriority') {
    if (needProfile.selectedModelKey === 'ev3') {
      return 'Soll die Rate möglichst niedrig sein oder darf die Ausstattung wichtiger sein?';
    }
    return 'Was wäre Ihnen wichtiger – Preis, Reichweite oder Ausstattung?';
  }

  if (question.id === 'primaryUsage') {
    return 'Ist das Fahrzeug eher für die Familie, für Sie selbst oder als Zweitwagen gedacht?';
  }

  const basePrompt = question.prompt ?? '';
  return basePrompt;
}

export function recommendVehiclesFromReasoning(customerUnderstanding = {}, context = {}) {
  const needProfile = context.needProfile ?? {};
  const result = runSellerReasoning({
    needProfile,
    answers: context.answers ?? {},
    customerUnderstanding,
    userExcluded: context.userExcluded ?? [],
  });

  return {
    intro: result.intro,
    items: result.items,
    fadedItems: result.fadedItems,
    hypothesisLead: result.hypothesisLead,
    exclusionNote: result.exclusionNote,
  };
}

export function buildVehicleReactionMessage(questionId, answerId, context = {}) {
  const { needProfile = {}, answers = {}, customerUnderstanding = null, userExcluded = [] } = context;

  const before = runSellerReasoning({
    needProfile,
    answers,
    customerUnderstanding,
    userExcluded,
  });

  const afterAnswers = { ...answers, [questionId]: answerId };
  const after = runSellerReasoning({
    needProfile,
    answers: afterAnswers,
    customerUnderstanding,
    userExcluded,
  });

  const beforeTop = shortModelName(before.items[0]?.title ?? '');
  const afterTop = shortModelName(after.items[0]?.title ?? '');

  if (questionId === 'longDistance' && answerId === 'often') {
    return 'Dann wird der EV6 interessanter – besonders für Urlaub und längere Strecken.';
  }
  if (questionId === 'longDistance' && answerId === 'rarely') {
    const fuel = getFuelCategory(needProfile);
    if (fuel === 'hybrid' || fuel === 'phev') {
      return 'Dann würde ich aktuell eher beim Sportage Hybrid bleiben. '
        + 'Der spielt seine Stärken besonders im Alltag und auf kürzeren Strecken aus.';
    }
    return 'Für den Alltag bleibt der EV3 eine starke Option – kompakt und effizient.';
  }
  if (questionId === 'longDistance' && answerId === 'sometimes') {
    return 'Bei gemischter Nutzung lohnt sich ein Blick auf Modelle mit etwas mehr Reichweite und Platz.';
  }
  if (questionId === 'towingUsage' && (answerId === 'small_trailer' || answerId === 'bike')) {
    return 'Dann benötigen Sie vermutlich kein besonders großes Fahrzeug.';
  }
  if (questionId === 'towingUsage' && answerId === 'caravan') {
    return 'Mit Wohnwagen im Blick würde ich eher Richtung größerer Hybrid-SUV schauen.';
  }
  if (questionId === 'vehicleNeedTiming' && answerId === 'later') {
    return 'Alles klar – dann klären wir kurz den ungefähren Rückgabezeitpunkt.';
  }
  if (questionId === 'vehicleReturnDate' && answerId && answerId !== 'unknown') {
    return 'Danke – das hilft bei der Planung des Fahrzeugwechsels.';
  }
  if (questionId === 'evModelPriority' && answerId === 'price') {
    return 'Preisbewusst wäre der EV3 aktuell mein erster Blick.';
  }
  if (questionId === 'evModelPriority' && answerId === 'equipment') {
    return 'Mit mehr Ausstattung im Blick gewinnt der EV5 an Relevanz.';
  }
  if (beforeTop && afterTop && beforeTop !== afterTop) {
    return `Dann rückt der ${afterTop} näher an die Spitze.`;
  }
  if (after.exclusionNote && !before.exclusionNote) {
    return after.exclusionNote;
  }
  return null;
}
