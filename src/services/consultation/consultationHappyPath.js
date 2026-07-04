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
  buildUnderstoodLabels,
  createEmptyNeedProfile,
  mergeTextIntoNeedProfile,
} from './needProfileService.js';
import { CLEVER_WORLD } from './consultationWorlds.js';
import {
  beginEv3VehicleConsultation,
  isVehicleInputEnabled,
  submitVehicleQuestionAnswer,
} from './consultationEv3HappyPath.js';

export const HAPPY_PATH_EXAMPLE_MESSAGE =
  'Ich suche ein Elektroauto für zwei Kinder bis etwa 350 € im Monat.';

/** Nur die zwei Gesprächslücken nach reichem Erstinput (Conversation Design). */
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
  HANDOFF: 'handoff',
};

/** Warme Clever-Formulierungen – Character Guide + Conversation Design. */
export const WARM_QUESTION_PROMPTS = {
  longDistance:
    'Darf ich noch kurz fragen: Fahren Sie im Alltag eher kurze Strecken '
    + '– oder auch regelmäßig längere, zum Beispiel in den Urlaub?',
  chargingAtHome: 'Und können Sie zu Hause laden – Garage oder Wallbox?',
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
  return NEED_CONSULTATION_QUESTIONS.find((q) => q.id === id) ?? null;
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
  };
}

export function getOpeningCopy(dealerName = 'Autohaus') {
  return {
    greeting: 'Hallo.',
    intro: `Ich bin Clever – Ihr Fahrzeugberater bei ${dealerName}.`,
    invitation: 'Erzählen Sie mir einfach, wonach Sie suchen.',
    placeholder: 'Ich suche …',
    examplesLabel: 'So könnte ein Satz klingen',
    exampleLabel: HAPPY_PATH_EXAMPLE_MESSAGE,
  };
}

export function getNotepadHeading(labelCount) {
  if (labelCount === 0) return 'Clever notiert …';
  if (labelCount < 5) return 'Clever kennt bereits …';
  return 'Das weiß ich über Sie';
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
    if (answerId === 'often' || answerId === 'sometimes') {
      next.priorities = [...new Set([...(next.priorities ?? []), 'range'])];
    }
  }

  if (questionId === 'chargingAtHome') {
    next.chargingAtHome = answerId;
    if (answerId === 'yes' || answerId === 'maybe') {
      next.priorities = [...new Set([...(next.priorities ?? []), 'charging'])];
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

  return null;
}

/**
 * @param {object} needProfile
 * @param {object} consultationProfile
 */
export function getHappyPathNextQuestion(needProfile, consultationProfile) {
  const ctx = buildConsultationCtx(needProfile, consultationProfile);
  const answers = consultationProfile?.answers ?? {};

  for (const id of HAPPY_PATH_QUESTION_SEQUENCE) {
    if (answers[id] != null) continue;
    const question = questionById(id);
    if (!question) continue;
    if (question.skipIf?.({ ...ctx, answers })) continue;
    return {
      ...question,
      prompt: WARM_QUESTION_PROMPTS[id] ?? question.prompt,
    };
  }
  return null;
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
    personalLead: 'Wenn ich Sie wäre, würde ich hier anfangen.',
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

function buildHappyPathRecommendation(needProfile) {
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
  return (question.options ?? []).map((option) => ({
    ...option,
    label: warm[option.id] ?? option.label,
  }));
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

function learnedTurn(labels) {
  return {
    type: TURN_TYPE.LEARNED,
    id: `learned-${Date.now()}-${labels.join('-')}`,
    labels: [...labels],
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
  const recommendation = buildHappyPathRecommendation(session.needProfile);
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
      learnedTurn(initialLabels),
    ],
  };

  const question = getHappyPathNextQuestion(needProfile, next.consultationProfile);
  if (question) {
    next = pushTurn(next, cleverQuestionTurn(question));
    next = withPendingQuestion(next, question);
  } else {
    next = startThinkingPhase(next);
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

  const question = questionById(questionId);
  const option = question?.options?.find((o) => o.id === answerId);
  const displayText = payload.text?.trim() || option?.label || answerId;

  let consultationProfile = answerConsultationQuestion(
    session.consultationProfile,
    questionId,
    answerId,
  );
  let needProfile = applyAnswerToNeedProfile(session.needProfile, questionId, answerId);
  const learned = learnedLabelsForAnswer(questionId, answerId);
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
      ...(learned.length ? [learnedTurn(learned)] : []),
    ],
  };

  const followUp = getHappyPathNextQuestion(needProfile, consultationProfile);
  if (followUp) {
    next = pushTurn(next, cleverQuestionTurn(followUp));
    next = withPendingQuestion(next, followUp);
    return next;
  }

  next = startThinkingPhase(next);
  return next;
}

/**
 * Nach der Denkpause (UI, ~500 ms) → Empfehlung anzeigen.
 * @param {object} session
 */
export function advanceFromThinking(session) {
  if (session.phase !== CONVERSATION_PHASE.THINKING) return session;
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
