/**
 * Phase 2 – Ein perfekter Happy Path.
 * „Ich suche ein Elektroauto für zwei Kinder bis etwa 350 € im Monat.“
 *
 * Dünne Orchestrierung über NeedProfile + Welt-1-Fragen – keine volle Engine.
 */
import { answerConsultationQuestion } from '../dealer/cleverSalesAdvisor.js';
import { buildNeedWorldRecommendation } from './consultationRecommendation.js';
import { NEED_CONSULTATION_QUESTIONS } from './consultationQuestions.js';
import {
  evaluateRecommendationReadiness,
  getConsultationQuestionById,
  getFuelCategory,
  planNextQuestion,
} from './conversationPlanner.js';
import {
  buildUnderstoodLabels,
  createEmptyNeedProfile,
  mergeTextIntoNeedProfile,
  modelDisplayLabel,
} from './needProfileService.js';
import { CLEVER_WORLD } from './consultationWorlds.js';
import {
  beginEv3VehicleConsultation,
  isVehicleInputEnabled,
  submitVehicleQuestionAnswer,
} from './consultationEv3HappyPath.js';
import {
  NEED_DIRECTION_QUESTION_ID,
  buildNeedDirectionQuestion,
  shouldOfferDirectionChoice,
} from './needUnderstandingGate.js';
import {
  buildVehicleDirectionsView,
  isEvDirectionModel,
} from './vehicleDirectionService.js';

export const HAPPY_PATH_EXAMPLE_MESSAGE =
  'Ich suche ein Elektroauto für zwei Kinder bis etwa 350 € im Monat.';

/** @deprecated Planner steuert die Reihenfolge – nur noch für Legacy-Tests. */
export const HAPPY_PATH_QUESTION_SEQUENCE = ['longDistance', 'chargingAtHome'];

export const CONVERSATION_PHASE = {
  OPENING: 'opening',
  CONVERSATION: 'conversation',
  THINKING: 'thinking',
  RECOMMENDATION: 'recommendation',
  HANDOFF: 'handoff',
};

export const TURN_TYPE = {
  CUSTOMER: 'customer',
  CLEVER: 'clever',
  LEARNED: 'learned',
  THINKING: 'thinking',
  RECOMMENDATION: 'recommendation',
  VEHICLE_DIRECTIONS: 'vehicle_directions',
  HANDOFF: 'handoff',
};

/** Warme Clever-Formulierungen – Character Guide + Conversation Design. */
export const WARM_QUESTION_PROMPTS = {
  longDistance:
    'Darf ich noch kurz fragen: Fahren Sie im Alltag eher kurze Strecken '
    + '– oder auch regelmäßig längere, zum Beispiel in den Urlaub?',
  chargingAtHome: 'Und können Sie zu Hause laden – Garage oder Wallbox?',
  fuel_type:
    'Haben Sie beim Antrieb schon einen Favoriten – Benzin, Hybrid oder Elektro?',
  allradNeed:
    'Brauchen Sie Allrad wirklich – zum Beispiel wegen Anhänger, Schnee oder Gelände?',
  comfortVsSpace:
    'Soll es eher möglichst komfortabel sein – oder ist Ihnen vor allem viel Platz und Anhängelast wichtig?',
  primaryUsage: 'Gerne. Wofür soll das Auto hauptsächlich genutzt werden?',
  evModelPriority: 'Ist Ihnen eher viel Reichweite oder gute Ausstattung wichtig?',
  sportagePowertrain: 'Kommt für Sie eher Benzin, Hybrid oder Plug-in-Hybrid infrage?',
  towingUsage: 'Wofür möchten Sie die Anhängerkupplung hauptsächlich nutzen?',
  needDirection: null,
};

/** Kürzere Chip-Labels – weniger Formular, mehr Gespräch. */
const WARM_OPTION_LABELS = {
  longDistance: {
    rarely: 'Vor allem Stadt',
    sometimes: 'Ab und zu länger',
    often: 'Auch Urlaub',
  },
  chargingAtHome: {
    yes: 'Ja, Garage',
    maybe: 'In Planung',
    no: 'Eher öffentlich',
    open: 'Noch unklar',
  },
  primaryUsage: {
    daily: 'Alltag',
    family: 'Familie',
    work: 'Arbeit',
    leisure: 'Freizeit',
    towing: 'Anhänger',
    open: 'Noch offen',
  },
  evModelPriority: {
    range: 'Mehr Reichweite',
    equipment: 'Mehr Ausstattung',
    balanced: 'Beides ausgewogen',
  },
  sportagePowertrain: {
    benzin: 'Benzin',
    hybrid: 'Hybrid',
    phev: 'Plug-in-Hybrid',
    open: 'Noch offen',
  },
  towingUsage: {
    bike: 'Fahrradträger',
    trailer: 'Anhänger / Wohnwagen',
    occasional: 'Nur gelegentlich',
    open: 'Noch unklar',
  },
};

const WARM_OPTION_EMOJI = {
  longDistance: {
    rarely: '🚗',
    sometimes: '🛣️',
    often: '✈️',
  },
  chargingAtHome: {
    yes: '🔌',
    maybe: '🏗️',
    no: '⚡',
    open: '💭',
  },
};

const LEARNED_FROM_ANSWER = {
  longDistance: {
    rarely: ['Kurzstrecke'],
    sometimes: ['Ab und zu längere Strecken'],
    often: ['Langstrecke', 'Urlaub'],
  },
  chargingAtHome: {
    yes: ['Laden zuhause'],
    maybe: ['Wallbox in Planung'],
    no: ['Öffentliches Laden'],
    open: [],
  },
  primaryUsage: {
    daily: ['Alltag'],
    family: ['Familie'],
    work: ['Arbeit'],
    leisure: ['Freizeit'],
    towing: ['Anhänger'],
    open: [],
  },
  evModelPriority: {
    range: ['Reichweite wichtig'],
    equipment: ['Ausstattung wichtig'],
    balanced: ['Ausgewogen'],
  },
  sportagePowertrain: {
    benzin: ['Benzin'],
    hybrid: ['Hybrid'],
    phev: ['Plug-in-Hybrid'],
    open: [],
  },
  towingUsage: {
    bike: ['Fahrradträger'],
    trailer: ['Anhänger / Wohnwagen'],
    occasional: ['AHK gelegentlich'],
    open: [],
  },
};

const HAPPY_PATH_ALT_TAGLINES = {
  ev4: 'wenn Sie mehr Platz möchten',
  'ev4-fastback': 'wenn Ihnen Reichweite wichtiger ist',
};

/** Statisches Such-Bundle für Welt-1-Empfehlung (Happy Path, kein Live-Search). */
const HAPPY_PATH_SEARCH_BUNDLE = {
  exact: {
    modelLineGroups: [
      { modelLineKey: 'ev3', fitRecommendation: 'Kompakter Familien-SUV mit guter Reichweite' },
      { modelLineKey: 'ev4', fitRecommendation: 'Etwas mehr Platz und Komfort' },
      { modelLineKey: 'ev4-fastback', fitRecommendation: 'Sportlicher, längere Reichweite' },
    ],
  },
};

function createConsultationProfile() {
  return { answers: {} };
}

function questionById(id) {
  return getConsultationQuestionById(id) ?? NEED_CONSULTATION_QUESTIONS.find((q) => q.id === id) ?? null;
}

function buildConsultationCtx(needProfile, consultationProfile) {
  return {
    needProfile,
    answers: consultationProfile?.answers ?? {},
    searchProfile: {},
    searchFilters: {},
  };
}

/**
 * @param {string} dealerName
 */
export function createHappyPathSession(dealerName = 'Autohaus') {
  return {
    phase: CONVERSATION_PHASE.OPENING,
    dealerName,
    turns: [],
    needProfile: createEmptyNeedProfile(),
    consultationProfile: createConsultationProfile(),
    notepadLabels: [],
    vehicleNotepadLabels: [],
    vehicleProfile: { answers: {} },
    vehicleChapterTitle: null,
    vehicleMiniRecommendation: null,
    dealerPrepSummary: null,
    pendingQuestion: null,
    recommendation: null,
    selectedModelKey: null,
    vehicleDirectionsView: null,
    vehicleDirectionReactions: {},
  };
}

export function getOpeningCopy(dealerName = 'Autohaus') {
  return {
    greeting: `Willkommen im ${dealerName}.`,
    invitation: 'Erzählen Sie mir einfach, wonach Sie suchen.',
    intro: 'Ich nehme Ihre Wünsche auf und bereite alles für Ihren persönlichen Berater vor.',
    placeholder: 'Ich suche …',
    examplesLabel: 'So könnte ein Satz klingen',
    exampleLabel: HAPPY_PATH_EXAMPLE_MESSAGE,
  };
}

export function getNotepadHeading(_labelCount) {
  return null;
}

function appendLabels(existing = [], incoming = []) {
  const next = [...existing];
  for (const label of incoming) {
    if (label && !next.includes(label)) next.push(label);
  }
  return next;
}

function labelsFromNeedProfile(needProfile, previous = []) {
  return appendLabels(previous, buildUnderstoodLabels(needProfile));
}

function learnedLabelsForAnswer(questionId, answerId) {
  return LEARNED_FROM_ANSWER[questionId]?.[answerId] ?? [];
}

/**
 * @param {object} needProfile
 * @param {string} questionId
 * @param {string} answerId
 */
export function applyAnswerToNeedProfile(needProfile, questionId, answerId) {
  const next = { ...needProfile };

  if (questionId === 'longDistance') {
    next.longDistance = answerId;
    if ((answerId === 'often' || answerId === 'sometimes') && getFuelCategory(next) === 'electric') {
      next.priorities = [...new Set([...(next.priorities ?? []), 'range'])];
    }
  }

  if (questionId === 'chargingAtHome') {
    next.chargingAtHome = answerId;
    if (answerId === 'yes' || answerId === 'maybe') {
      next.priorities = [...new Set([...(next.priorities ?? []), 'charging'])];
    }
  }

  if (questionId === 'fuel_type') {
    const fuelMap = {
      benzin: 'verbrenner',
      hybrid: 'hybrid',
      electric: 'electric',
      open: null,
    };
    const mapped = fuelMap[answerId];
    if (mapped) next.fuel = mapped;
  }

  if (questionId === 'allradNeed') {
    next.allradNeed = answerId;
    if (answerId === 'yes') {
      next.priorities = [...new Set([...(next.priorities ?? []), 'awd'])];
    }
  }

  if (questionId === 'comfortVsSpace') {
    next.comfortVsSpace = answerId;
    if (answerId === 'comfort') {
      next.priorities = [...new Set([...(next.priorities ?? []), 'comfort'])];
    }
    if (answerId === 'space') {
      next.priorities = [...new Set([...(next.priorities ?? []), 'space'])];
    }
  }

  if (questionId === 'primaryUsage') {
    const usageMap = {
      daily: ['daily'],
      family: ['family'],
      work: ['work'],
      leisure: ['leisure'],
      towing: ['towing'],
      open: [],
    };
    next.usage = usageMap[answerId] ?? next.usage ?? [];
    if (answerId === 'family') {
      next.priorities = [...new Set([...(next.priorities ?? []), 'family'])];
    }
    if (answerId === 'towing') {
      next.towing = next.towing ?? 'braked';
      next.priorities = [...new Set([...(next.priorities ?? []), 'towing'])];
    }
  }

  if (questionId === 'evModelPriority' || questionId === 'ev3Priority') {
    if (answerId === 'range') {
      next.priorities = [...new Set([...(next.priorities ?? []), 'range'])];
    }
    if (answerId === 'equipment') {
      next.priorities = [...new Set([...(next.priorities ?? []), 'comfort'])];
    }
  }

  if (questionId === 'sportagePowertrain') {
    const fuelMap = {
      benzin: 'verbrenner',
      hybrid: 'hybrid',
      phev: 'phev',
      open: null,
    };
    const mapped = fuelMap[answerId];
    if (mapped) next.fuel = mapped;
  }

  if (questionId === 'towingUsage') {
    next.towingUsage = answerId;
    if (answerId === 'bike') {
      next.priorities = [...new Set([...(next.priorities ?? []), 'towing'])];
    }
  }

  next.understoodLabels = buildUnderstoodLabels(next);
  return next;
}

/**
 * @param {string} questionId
 * @param {string} text
 * @returns {string|null}
 */
export function mapFreetextToQuestionAnswer(questionId, text = '') {
  const t = String(text).toLowerCase().trim();
  if (!t) return null;

  if (questionId === 'longDistance') {
    if (/urlaub|lang|fern|weit|autobahn|länger/.test(t)) return 'often';
    if (/ab und zu|manchmal|gelegentlich/.test(t)) return 'sometimes';
    if (/kurz|stadt|nah|selten|alltag/.test(t)) return 'rarely';
    return 'often';
  }

  if (questionId === 'chargingAtHome') {
    if (/^ja\b|garage|wallbox|zuhause|daheim|laden/.test(t)) return 'yes';
    if (/nein|öffentlich|ladestation/.test(t)) return 'no';
    if (/vielleicht|planung|klär/.test(t)) return 'maybe';
    return 'yes';
  }

  if (questionId === 'fuel_type') {
    if (/elektro|ev\b|strom/.test(t)) return 'electric';
    if (/hybrid|plug/.test(t)) return 'hybrid';
    if (/benzin|verbrenner|diesel/.test(t)) return 'benzin';
    if (/offen|unklar|egal/.test(t)) return 'open';
    return null;
  }

  return null;
}

/**
 * @param {object} needProfile
 * @param {object} consultationProfile
 */
/** Fragen, die der magische Happy Path stellt – kein voller Sales-Katalog. */
const HAPPY_PATH_PLANNER_IDS = new Set([
  'primaryUsage',
  'evModelPriority',
  'sportagePowertrain',
  'towingUsage',
  'fuel_type',
  'comfortVsSpace',
  'allradNeed',
  'longDistance',
  'chargingAtHome',
  NEED_DIRECTION_QUESTION_ID,
]);

function buildAcknowledgment(needProfile = {}) {
  const modelKey = needProfile.selectedModelKey;
  const modelLabel = modelKey ? `Kia ${modelDisplayLabel(modelKey)}` : null;
  const hasTowing = needProfile.towing && needProfile.towing !== 'no';

  if (modelLabel && hasTowing) {
    return `Alles klar, den ${modelDisplayLabel(modelKey)} mit Anhängerkupplung nehme ich auf.`;
  }
  if (modelLabel) {
    return `Alles klar, den ${modelLabel} nehme ich auf.`;
  }
  if (hasTowing) {
    return 'Alles klar, Anhängerkupplung nehme ich auf.';
  }
  return null;
}

function buildAdvisorBridge(questionId) {
  if (questionId === 'evModelPriority') {
    return 'Damit Ihr Berater die passende Richtung prüfen kann:';
  }
  if (questionId === 'sportagePowertrain') {
    return 'Damit Ihr Berater nicht in die falsche Richtung prüft:';
  }
  if (questionId === 'towingUsage') {
    return 'Damit Ihr Berater das richtig einordnen kann:';
  }
  return null;
}

function buildContextualQuestionPrompt(needProfile = {}, question = {}) {
  const base = WARM_QUESTION_PROMPTS[question.id] ?? question.prompt ?? '';
  const ack = buildAcknowledgment(needProfile);
  const bridge = buildAdvisorBridge(question.id);

  if (ack && bridge) {
    const modelLabel = needProfile.selectedModelKey
      ? modelDisplayLabel(needProfile.selectedModelKey)
      : null;
    if (question.id === 'evModelPriority' && modelLabel) {
      return `${ack}\n\n${bridge}\nIst Ihnen beim ${modelLabel} eher viel Reichweite oder gute Ausstattung wichtig?`;
    }
    return `${ack}\n\n${bridge}\n${base}`;
  }

  return base;
}

export function getHappyPathNextQuestion(needProfile, consultationProfile) {
  const answers = consultationProfile?.answers ?? {};
  const result = planNextQuestion({ needProfile, answers });
  const question = result.question;
  if (!question || !HAPPY_PATH_PLANNER_IDS.has(question.id)) return null;
  if (question.id === NEED_DIRECTION_QUESTION_ID) return null;
  return {
    ...question,
    prompt: buildContextualQuestionPrompt(needProfile, question),
  };
}

/**
 * Katalogfrage oder Richtungswahl – je nach Verständnisstärke.
 * @param {object} needProfile
 * @param {object} consultationProfile
 */
export function resolveNextHappyPathQuestion(needProfile, consultationProfile) {
  const answers = consultationProfile?.answers ?? {};
  const catalogQuestion = getHappyPathNextQuestion(needProfile, consultationProfile);
  if (shouldOfferDirectionChoice(needProfile, catalogQuestion, answers)) {
    return buildNeedDirectionQuestion(needProfile);
  }
  return catalogQuestion;
}

function cleverAckTurn(text) {
  return {
    type: TURN_TYPE.CLEVER,
    id: `clever-ack-${Date.now()}`,
    text,
  };
}

function submitNeedDirectionAnswer(session, answerId, displayText) {
  const consultationProfile = answerConsultationQuestion(
    session.consultationProfile,
    NEED_DIRECTION_QUESTION_ID,
    answerId,
  );

  let needProfile = { ...session.needProfile };
  let anchorModelKey = null;

  if (answerId === 'explore_model' && needProfile.modelHint) {
    needProfile = {
      ...needProfile,
      selectedModelKey: needProfile.modelHint,
      understoodLabels: buildUnderstoodLabels({
        ...needProfile,
        selectedModelKey: needProfile.modelHint,
      }),
    };
    anchorModelKey = needProfile.modelHint;
  } else if (answerId === 'compare_similar') {
    anchorModelKey = needProfile.modelHint ?? null;
  }

  let next = {
    ...session,
    consultationProfile,
    needProfile,
    turns: [
      ...session.turns,
      customerTurn(displayText),
    ],
  };

  if (answerId === 'compare_similar' || answerId === 'explore_model') {
    const directionsView = buildVehicleDirectionsView(needProfile, { anchorModelKey });
    return {
      ...next,
      vehicleDirectionsView: directionsView,
      vehicleDirectionReactions: {},
      pendingQuestion: null,
      phase: CONVERSATION_PHASE.CONVERSATION,
      turns: [
        ...next.turns,
        {
          type: TURN_TYPE.VEHICLE_DIRECTIONS,
          id: `directions-${Date.now()}`,
          directionsView,
        },
      ],
    };
  }

  return {
    ...next,
    pendingQuestion: null,
    phase: CONVERSATION_PHASE.CONVERSATION,
    turns: [
      ...next.turns,
      cleverAckTurn('Alles klar – ich notiere das für Ihren Berater.'),
    ],
  };
}

/**
 * Reaktion auf eine Fahrzeugrichtung.
 * @param {object} session
 * @param {string} modelKey
 * @param {'interested'|'not_fit'|'explore'} reactionId
 */
export function submitVehicleDirectionReaction(session, modelKey, reactionId) {
  const reactions = {
    ...(session.vehicleDirectionReactions ?? {}),
    [modelKey]: reactionId,
  };

  const directionsView = session.vehicleDirectionsView
    ? { ...session.vehicleDirectionsView, reactions }
    : null;

  let next = {
    ...session,
    vehicleDirectionReactions: reactions,
    vehicleDirectionsView: directionsView,
    turns: session.turns.map((turn) => (
      turn.type === TURN_TYPE.VEHICLE_DIRECTIONS
        ? { ...turn, directionsView: { ...turn.directionsView, reactions } }
        : turn
    )),
  };

  if (reactionId !== 'explore') {
    return next;
  }

  const needProfile = {
    ...next.needProfile,
    selectedModelKey: modelKey,
    understoodLabels: buildUnderstoodLabels({
      ...next.needProfile,
      selectedModelKey: modelKey,
    }),
  };
  next = { ...next, needProfile, selectedModelKey: modelKey };

  if (isEvDirectionModel(modelKey)) {
    return beginEv3VehicleConsultation(next, modelKey);
  }

  const label = modelDisplayLabel(modelKey);
  return {
    ...next,
    turns: [
      ...next.turns,
      cleverAckTurn(
        `Gut – ich halte ${label} für die genauere Prüfung fest. Damit kann Ihr Berater direkt loslegen.`,
      ),
    ],
  };
}

function buildHappyPathWhyLines(needProfile = {}) {
  const lines = [];
  if (needProfile.priorities?.includes('family') || needProfile.children) {
    lines.push('passt zu Ihrer Familie');
  }
  if (needProfile.priorities?.includes('range') || needProfile.longDistance === 'often') {
    lines.push('ausreichend Reichweite');
  }
  if (needProfile.budget?.maxMonthlyRate) {
    lines.push('innerhalb Ihres Budgets');
  }
  if (!lines.length) lines.push('passt gut zu Ihren Angaben');
  return lines;
}

function humanizeHappyPathRecommendation(rec, needProfile) {
  if (!rec?.ready || !rec.primary) return rec;

  const alternatives = (rec.alternatives ?? []).map((alt) => ({
    ...alt,
    tagline: HAPPY_PATH_ALT_TAGLINES[alt.modelKey] ?? alt.tagline,
  }));

  return {
    ...rec,
    personalLead: 'Das würde ich mir für Ihren Berater notieren.',
    headline: 'Nach Ihren Angaben würde ich zuerst den',
    modelName: `Kia ${rec.primary.modelLabel}`,
    modelSubline: 'ansehen.',
    primary: {
      ...rec.primary,
      whyLines: buildHappyPathWhyLines(needProfile),
    },
    alternatives,
  };
}

function buildHappyPathRecommendation(needProfile, consultationProfile = {}) {
  const readiness = evaluateRecommendationReadiness({
    needProfile,
    answers: consultationProfile?.answers ?? {},
  });
  if (!readiness.ready) {
    return {
      ready: false,
      blocker: readiness.blocker,
      reason: readiness.reason,
    };
  }

  const rec = buildNeedWorldRecommendation({
    searchBundle: HAPPY_PATH_SEARCH_BUNDLE,
    needProfile,
    searchProfile: { fuel: 'electric', seatsMin: 5 },
    searchWishes: [],
    chipIds: needProfile?.priorities?.includes('range') ? ['range_400'] : [],
  });
  return humanizeHappyPathRecommendation(rec, needProfile);
}

function warmOptionsForQuestion(question) {
  const warm = WARM_OPTION_LABELS[question.id] ?? {};
  const emojis = WARM_OPTION_EMOJI[question.id] ?? {};
  return (question.options ?? []).map((option) => {
    const label = warm[option.id] ?? option.label;
    const emoji = emojis[option.id];
    return {
      ...option,
      label: emoji ? `${emoji} ${label}` : label,
    };
  });
}

function cleverQuestionTurn(question) {
  return {
    type: TURN_TYPE.CLEVER,
    id: `clever-${question.id}`,
    questionId: question.id,
    text: question.prompt,
    options: warmOptionsForQuestion(question),
    hint: question.hint ?? null,
  };
}

function customerTurn(text) {
  return {
    type: TURN_TYPE.CUSTOMER,
    id: `customer-${Date.now()}`,
    text,
  };
}

function pushTurn(session, turn) {
  return {
    ...session,
    turns: [...session.turns, turn],
  };
}

function withPendingQuestion(session, question) {
  return {
    ...session,
    phase: CONVERSATION_PHASE.CONVERSATION,
    pendingQuestion: question
      ? { id: question.id, options: question.options ?? [] }
      : null,
  };
}

function startThinkingPhase(session) {
  return {
    ...session,
    phase: CONVERSATION_PHASE.THINKING,
    pendingQuestion: null,
    turns: [
      ...session.turns,
      {
        type: TURN_TYPE.THINKING,
        id: `thinking-${Date.now()}`,
        text: 'Einen Moment …',
      },
    ],
  };
}

function finishWithRecommendation(session) {
  const recommendation = buildHappyPathRecommendation(
    session.needProfile,
    session.consultationProfile,
  );
  if (!recommendation.ready) {
    return {
      ...session,
      phase: CONVERSATION_PHASE.CONVERSATION,
      recommendation: null,
      turns: session.turns.filter((t) => t.type !== TURN_TYPE.THINKING),
    };
  }
  return {
    ...session,
    phase: CONVERSATION_PHASE.RECOMMENDATION,
    recommendation,
    turns: [
      ...session.turns.filter((t) => t.type !== TURN_TYPE.THINKING),
      {
        type: TURN_TYPE.RECOMMENDATION,
        id: `recommendation-${Date.now()}`,
        recommendation,
      },
    ],
  };
}

/**
 * Erster Kundentext – Screen 1 → 2.
 * @param {object} session
 * @param {string} text
 */
export function submitOpeningMessage(session, text = '') {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) return session;

  let needProfile = mergeTextIntoNeedProfile(trimmed, session.needProfile);
  const initialLabels = buildUnderstoodLabels(needProfile);
  const notepadLabels = labelsFromNeedProfile(needProfile, []);

  let next = {
    ...session,
    needProfile,
    notepadLabels,
    turns: [
      customerTurn(trimmed),
    ],
  };

  const question = resolveNextHappyPathQuestion(needProfile, next.consultationProfile);
  if (question) {
    next = pushTurn(next, cleverQuestionTurn(question));
    next = withPendingQuestion(next, question);
  } else {
    const readiness = evaluateRecommendationReadiness({
      needProfile,
      answers: next.consultationProfile?.answers ?? {},
    });
    if (readiness.ready) {
      next = startThinkingPhase(next);
    } else {
      next = { ...next, phase: CONVERSATION_PHASE.CONVERSATION };
    }
  }

  return next;
}

/**
 * Antwort auf die aktuelle Clever-Frage (Chip oder Freitext).
 * @param {object} session
 * @param {{ answerId?: string, text?: string }} payload
 */
export function submitQuestionAnswer(session, payload = {}) {
  const questionId = session.pendingQuestion?.id;
  if (!questionId) return session;

  let answerId = payload.answerId ?? null;
  if (!answerId && payload.text) {
    answerId = mapFreetextToQuestionAnswer(questionId, payload.text);
  }
  if (!answerId) return session;

  if (questionId === NEED_DIRECTION_QUESTION_ID) {
    const directionQ = buildNeedDirectionQuestion(session.needProfile);
    const option = directionQ.options?.find((o) => o.id === answerId);
    const displayText = payload.text?.trim() || option?.label || answerId;
    return submitNeedDirectionAnswer(session, answerId, displayText);
  }

  const question = questionById(questionId);
  const option = question?.options?.find((o) => o.id === answerId);
  const displayText = payload.text?.trim()
    || WARM_OPTION_LABELS[questionId]?.[answerId]
    || option?.label
    || answerId;

  let consultationProfile = answerConsultationQuestion(
    session.consultationProfile,
    questionId,
    answerId,
  );
  let needProfile = applyAnswerToNeedProfile(session.needProfile, questionId, answerId);
  const notepadLabels = labelsFromNeedProfile(needProfile, session.notepadLabels);

  let next = {
    ...session,
    consultationProfile,
    needProfile,
    notepadLabels,
    pendingQuestion: null,
    turns: [
      ...session.turns,
      customerTurn(displayText),
    ],
  };

  const followUp = resolveNextHappyPathQuestion(needProfile, consultationProfile);
  if (followUp) {
    next = pushTurn(next, cleverQuestionTurn(followUp));
    next = withPendingQuestion(next, followUp);
    return next;
  }

  const readiness = evaluateRecommendationReadiness({
    needProfile,
    answers: consultationProfile?.answers ?? {},
  });
  if (readiness.ready) {
    next = startThinkingPhase(next);
  } else {
    next = { ...next, phase: CONVERSATION_PHASE.CONVERSATION };
  }
  return next;
}

/**
 * Nach der Denkpause (UI, ~500 ms) → Empfehlung anzeigen.
 * @param {object} session
 */
export function advanceFromThinking(session) {
  if (session.phase !== CONVERSATION_PHASE.THINKING) return session;
  const readiness = evaluateRecommendationReadiness({
    needProfile: session.needProfile,
    answers: session.consultationProfile?.answers ?? {},
  });
  if (!readiness.ready) {
    return {
      ...session,
      phase: CONVERSATION_PHASE.CONVERSATION,
      turns: session.turns.filter((t) => t.type !== TURN_TYPE.THINKING),
    };
  }
  return finishWithRecommendation(session);
}

/**
 * Freitext in der unteren Leiste – Kontextabhängig.
 * @param {object} session
 * @param {string} text
 */
export function submitConversationInput(session, text = '') {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) return session;

  if (session.phase === CONVERSATION_PHASE.OPENING) {
    return submitOpeningMessage(session, trimmed);
  }

  if (session.pendingQuestion) {
    if (session.pendingQuestion.world === CLEVER_WORLD.VEHICLE_CONSULTATION) {
      return submitVehicleQuestionAnswer(session, { text: trimmed });
    }
    return submitQuestionAnswer(session, { text: trimmed });
  }

  if (session.phase === CONVERSATION_PHASE.RECOMMENDATION) {
    return session;
  }

  return session;
}

/**
 * Welt 1 → 2 – Modell gewählt.
 * @param {object} session
 * @param {string} modelKey
 */
export function selectRecommendedModel(session, modelKey) {
  if (!modelKey) return session;
  return beginEv3VehicleConsultation(session, modelKey);
}

export function submitVehicleAnswer(session, payload = {}) {
  return submitVehicleQuestionAnswer(session, payload);
}

export function isInputEnabled(session) {
  return session.phase === CONVERSATION_PHASE.OPENING
    || session.phase === CONVERSATION_PHASE.CONVERSATION
    || isVehicleInputEnabled(session);
}

export {
  beginEv3VehicleConsultation,
  advanceFromVehicleThinking,
  submitDealerHandoff,
  getVehicleInputPlaceholder,
  isInVehicleWorld,
  VEHICLE_CONVERSATION_PHASE,
  VEHICLE_TURN_TYPE,
} from './consultationEv3HappyPath.js';

export {
  beginOfferHandoff,
  submitPersonalHandoff,
  buildPersonalHandoffView,
  createLeadFromConsultationHappyPath,
  validateHandoffForm,
  isInOfferWorld,
  OFFER_CONVERSATION_PHASE,
  OFFER_TURN_TYPE,
  CONTACT_TIMING_OPTIONS,
} from './consultationOfferHandoff.js';
