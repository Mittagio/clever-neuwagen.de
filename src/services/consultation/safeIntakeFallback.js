/**
 * Safe Intake Fallback – degradierte, intake-konforme Sprachführung
 * ohne Happy-Path-/Planner-Fragebogen.
 *
 * Öffentlicher Kundendialog: OpenAI bevorzugt; dieser Fallback nur bei
 * fehlender/ungültiger AI. Keine Ranking-/Match-/Beratungsabschluss-Schleife.
 */
import {
  CONVERSATION_PHASE,
  TURN_TYPE,
  createHappyPathSession,
} from './consultationHappyPath.js';
import {
  buildUnderstoodLabels,
  mergeTextIntoNeedProfile,
} from './needProfileService.js';
import { tryConversationKnowledgeAnswer } from './conversationKnowledgeAnswer.js';
import { hasEquipmentWish } from './needRecognitionService.js';
import { CLEVER_WORLD } from './consultationWorlds.js';
import {
  isInVehicleWorld,
  VEHICLE_CONVERSATION_PHASE,
} from './consultationEv3HappyPath.js';
import { buildDeterministicNextTopics } from './conversationNextTopics.js';

/**
 * Öffentlicher Intake: Messenger bleibt offen – keine Welt-2-Fahrzeugberatung.
 * @param {object} session
 */
export function keepPublicIntakeMessenger(session) {
  if (!session) return session;

  // Angebot/Handoff nicht zurückdrehen – nur Welt-2-Fahrzeugberatung beenden
  if (
    session.phase === CONVERSATION_PHASE.HANDOFF
    || session.phase === 'personal_handoff'
    || session.phase === 'handoff_complete'
  ) {
    if (!session.vehicleChapterTitle) return session;
    return {
      ...session,
      vehicleChapterTitle: null,
      vehicleMiniRecommendation: null,
    };
  }

  const pending = session.pendingQuestion;
  const pendingIsVehicle = pending?.world === CLEVER_WORLD.VEHICLE_CONSULTATION
    || pending?.id === 'ev3Priority'
    || pending?.id === 'ev3Equipment'
    || String(pending?.id ?? '').startsWith('ev3');

  const inVehicle = isInVehicleWorld(session)
    || Boolean(session.vehicleChapterTitle)
    || session.needProfile?.world === CLEVER_WORLD.VEHICLE_CONSULTATION
    || Object.values(VEHICLE_CONVERSATION_PHASE).includes(session.phase);

  if (!inVehicle && !pendingIsVehicle) {
    return session;
  }

  const nextPhase = session.phase === CONVERSATION_PHASE.OPENING
    && (session.turns?.length ?? 0) === 0
    ? CONVERSATION_PHASE.OPENING
    : CONVERSATION_PHASE.CONVERSATION;

  return {
    ...session,
    phase: nextPhase,
    vehicleChapterTitle: null,
    vehicleMiniRecommendation: null,
    dealerPrepSummary: null,
    pendingQuestion: pendingIsVehicle ? null : pending,
    needProfile: {
      ...session.needProfile,
      world: CLEVER_WORLD.NEED_CONSULTATION,
    },
  };
}

const FORBIDDEN_PLANNER_QUESTION_IDS = new Set([
  'primaryUsage',
  'longDistance',
  'chargingAtHome',
  'vehicleNeedTiming',
  'vehicleReturnDate',
  'evModelPriority',
  'ev3Priority',
  'comfortVsSpace',
  'fuel_type',
  'allradNeed',
  'hybridPowertrain',
  'sportagePowertrain',
  'towingUsage',
  'needDirection',
  'sellerReadiness',
]);

const SAFE_ANNUAL_KM_QUESTION_ID = 'safe_annual_km';

const ANNUAL_KM_OPTIONS = [
  { id: '8000', label: 'bis 8.000 km' },
  { id: '12000', label: '8.000 – 12.000 km' },
  { id: '15000', label: '12.000 – 15.000 km' },
  { id: '20000', label: '15.000 – 20.000 km' },
  { id: '25000', label: 'über 20.000 km' },
];

/**
 * @param {string} reason
 * @returns {string}
 */
export function humanizeFallbackReason(reason = '') {
  const key = String(reason ?? '').trim().toLowerCase();
  if (!key || key === 'fallback') return 'unavailable';
  if (key === 'feature_disabled' || key === 'client_disabled') return 'feature disabled';
  if (key === 'api_key_missing' || key === 'disabled_or_missing_key') return 'API key missing';
  if (key === 'grounding_failed' || key === 'mock_grounding_failed' || key.startsWith('grounding')) {
    return 'grounding rejected';
  }
  if (key === 'rate_limit') return 'rate limit';
  if (key === 'timeout') return 'timeout';
  if (key === 'invalid_json' || key.startsWith('schema:')) return 'invalid response';
  if (key === 'api_error' || key === 'request_failed' || key === 'internal_error') {
    return 'API error';
  }
  return String(reason).replace(/_/g, ' ').slice(0, 48);
}

function appendLabels(existing = [], incoming = []) {
  const next = [...existing];
  for (const label of incoming) {
    if (label && !next.includes(label)) next.push(label);
  }
  return next;
}

function customerTurn(text) {
  return {
    type: TURN_TYPE.CUSTOMER,
    id: `customer-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    text,
  };
}

function cleverReplyTurn({
  text,
  knowledge = null,
  nextTopics = [],
}) {
  return {
    type: TURN_TYPE.CLEVER,
    id: `clever-fallback-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    text,
    mode: 'fallback',
    answerKind: knowledge ? 'knowledge' : undefined,
    facts: knowledge?.facts ?? [],
    modelCards: knowledge?.modelCards ?? [],
    primaryModelKey: knowledge?.primaryModelKey ?? null,
    knowledgeOnly: Boolean(knowledge),
    nextTopics,
    fallbackTurn: true,
  };
}

function cleverQuestionTurn(question) {
  return {
    type: TURN_TYPE.CLEVER,
    id: `clever-${question.id}-${Date.now()}`,
    questionId: question.id,
    text: question.prompt,
    options: question.options ?? [],
    hint: question.hint ?? null,
    optionsHint: '',
    fallbackTurn: true,
    mode: 'fallback',
  };
}

function formatLabelList(labels = []) {
  const clean = labels.filter(Boolean);
  if (clean.length === 0) return '';
  if (clean.length === 1) return clean[0];
  if (clean.length === 2) return `${clean[0]} und ${clean[1]}`;
  return `${clean.slice(0, -1).join(', ')} und ${clean[clean.length - 1]}`;
}

function isLeasingMentioned(needProfile = {}, text = '', labels = []) {
  if (needProfile?.budget?.paymentType === 'leasing') return true;
  if (labels.some((label) => /leasing/i.test(String(label)))) return true;
  return /\bleasing\b/i.test(String(text));
}

function isHeatPumpMentioned(needProfile = {}, text = '') {
  if (hasEquipmentWish(needProfile, 'heat_pump')) return true;
  return /\bwärmepumpe\b|\bwaermepumpe\b/i.test(String(text));
}

function refineNotepadLabels(labels = [], text = '', needProfile = {}) {
  let next = [...labels];
  if (isHeatPumpMentioned(needProfile, text) && /\bwichtig\b/i.test(text)) {
    next = next.filter((label) => !/^wärmepumpe$/i.test(String(label)));
    if (!next.some((label) => /wärmepumpe/i.test(String(label)))) {
      next.push('Wärmepumpe wichtig');
    }
  }
  return next;
}

function newlyAddedLabels(previous = [], next = []) {
  const prevSet = new Set(previous.map((l) => String(l).toLowerCase()));
  return next.filter((label) => !prevSet.has(String(label).toLowerCase()));
}

function parseAnnualKmFromText(text = '') {
  const t = String(text).toLowerCase();
  if (/über\s*20|ueber\s*20|25000|25\.000|mehr als 20/.test(t)) return 25000;
  if (/15\.?000\s*[–\-]\s*20|20000|20\.000/.test(t)) return 20000;
  if (/12\.?000\s*[–\-]\s*15|15000|15\.000/.test(t)) return 15000;
  if (/8\.?000\s*[–\-]\s*12|12000|12\.000/.test(t)) return 12000;
  if (/bis\s*8|8000|8\.000/.test(t)) return 8000;
  const match = t.match(/(\d{1,2})[.\s]?(\d{3})\s*km/);
  if (match) return Number(`${match[1]}${match[2]}`);
  return null;
}

function applyPendingSafeAnswer(needProfile, pendingQuestion, text) {
  if (!pendingQuestion?.id) return needProfile;
  if (pendingQuestion.id !== SAFE_ANNUAL_KM_QUESTION_ID) return needProfile;

  const km = parseAnnualKmFromText(text);
  if (!km) return needProfile;
  return {
    ...needProfile,
    annualKm: km,
    understoodLabels: buildUnderstoodLabels({ ...needProfile, annualKm: km }),
  };
}

function pickAckLabels(labels = []) {
  const list = [...labels];
  const hasEvModel = list.some((label) => /^EV\d/i.test(String(label)));
  return list
    .filter((label) => !(hasEvModel && /^elektro$/i.test(String(label))))
    .slice(0, 4);
}

function buildAckReply({
  text,
  needProfile,
  newLabels,
  notepadLabels,
  knowledge,
}) {
  if (knowledge?.text) return knowledge.text;

  if (isHeatPumpMentioned(needProfile, text)) {
    return 'Habe ich notiert. Bei der konkreten Fahrzeugvariante prüfen wir, ob die Wärmepumpe serienmäßig oder über eine Ausstattung verfügbar ist.';
  }

  const forAck = pickAckLabels(newLabels.length ? newLabels : notepadLabels);
  const list = formatLabelList(forAck);

  if (list) {
    return `Verstanden. Ich habe ${list} notiert.`;
  }

  return 'Verstanden – ich habe das notiert. Sie können gerne weitererzählen oder Ihre Wünsche übergeben.';
}

function buildSafeFollowUp({
  needProfile,
  text,
  notepadLabels,
  askedSafeQuestionIds = [],
  knowledge,
}) {
  // Knowledge answers stand alone – no forced follow-up
  if (knowledge) return null;

  if (askedSafeQuestionIds.includes(SAFE_ANNUAL_KM_QUESTION_ID)) return null;
  if (needProfile?.annualKm) return null;

  if (isLeasingMentioned(needProfile, text, notepadLabels)) {
    return {
      id: SAFE_ANNUAL_KM_QUESTION_ID,
      prompt: 'Wie viele Kilometer fahren Sie ungefähr im Jahr?',
      options: ANNUAL_KM_OPTIONS,
      hint: 'Hilft bei der Leasing-Laufleistung.',
    };
  }

  return null;
}

function cleverTurnsText(session) {
  return (session.turns ?? [])
    .filter((turn) => turn.type === TURN_TYPE.CLEVER)
    .map((turn) => String(turn.text ?? ''))
    .join('\n');
}

/**
 * Öffentlicher Intake-Fallback: notieren, antworten, max. eine sichere Frage.
 *
 * @param {object} session
 * @param {string} text
 * @param {{ reason?: string }} [options]
 */
export function submitSafeIntakeFallback(session, text = '', options = {}) {
  const trimmed = String(text ?? '').trim();
  const reason = options.reason ?? session?.fallbackReason ?? 'unavailable';
  const base = session ?? createHappyPathSession();

  if (!trimmed) {
    return {
      ...base,
      conversationMode: 'fallback',
      fallbackReason: humanizeFallbackReason(reason),
      aiModel: null,
    };
  }

  // Offer-/Handoff-Welten nicht hier umbiegen – nur Intake-Sprachführung
  if (
    base.phase === CONVERSATION_PHASE.HANDOFF
    || base.phase === 'personal_handoff'
    || base.phase === 'handoff_complete'
  ) {
    return base;
  }

  const previousLabels = [...(base.notepadLabels ?? [])];
  const askedSafeQuestionIds = [...(base.askedSafeQuestionIds ?? [])];

  let needProfile = mergeTextIntoNeedProfile(trimmed, base.needProfile);
  needProfile = applyPendingSafeAnswer(needProfile, base.pendingQuestion, trimmed);

  let notepadLabels = appendLabels(previousLabels, buildUnderstoodLabels(needProfile));
  notepadLabels = refineNotepadLabels(notepadLabels, trimmed, needProfile);
  needProfile = {
    ...needProfile,
    understoodLabels: notepadLabels,
  };

  const newLabels = newlyAddedLabels(previousLabels, notepadLabels);
  const knowledge = tryConversationKnowledgeAnswer(trimmed, needProfile);

  let next = {
    ...base,
    needProfile,
    notepadLabels,
    pendingQuestion: null,
    conversationMode: 'fallback',
    fallbackReason: humanizeFallbackReason(reason),
    aiModel: null,
    // Nie automatisch in Empfehlungs-/Fahrzeugberatungs-Abschluss
    recommendation: null,
    vehicleMiniRecommendation: null,
    offerRequested: base.offerRequested === true ? base.offerRequested : false,
    phase: CONVERSATION_PHASE.CONVERSATION,
    turns: [...(base.turns ?? []), customerTurn(trimmed)],
    askedSafeQuestionIds,
  };

  const replyText = buildAckReply({
    text: trimmed,
    needProfile,
    newLabels,
    notepadLabels,
    knowledge,
  });

  const nextTopics = buildDeterministicNextTopics({
    needProfile,
    notepadLabels,
    text: trimmed,
    knowledge,
    answeredTopicIds: base.answeredNextTopicIds ?? [],
  });

  const followUp = buildSafeFollowUp({
    needProfile,
    text: trimmed,
    notepadLabels,
    askedSafeQuestionIds,
    knowledge,
  });

  next = {
    ...next,
    turns: [
      ...next.turns,
      cleverReplyTurn({
        text: replyText,
        knowledge,
        nextTopics: followUp ? [] : nextTopics,
      }),
    ],
  };

  if (followUp) {
    next = {
      ...next,
      turns: [
        ...next.turns,
        {
          ...cleverQuestionTurn(followUp),
          nextTopics,
        },
      ],
      pendingQuestion: {
        id: followUp.id,
        options: followUp.options,
      },
      askedSafeQuestionIds: [...askedSafeQuestionIds, followUp.id],
    };
  }

  return keepPublicIntakeMessenger(next);
}

/**
 * Test-/Debug-Helfer: erkennt verbotene Legacy-Planner-Fragen im Transcript.
 */
export function sessionContainsForbiddenPlannerQuestion(session) {
  const turns = session?.turns ?? [];
  for (const turn of turns) {
    if (turn?.questionId && FORBIDDEN_PLANNER_QUESTION_IDS.has(turn.questionId)) {
      return true;
    }
  }
  const blob = cleverTurnsText(session).toLowerCase();
  const forbiddenPhrases = [
    'wie nutzen sie das fahrzeug überwiegend',
    'garage oder wallbox',
    'wann benötigen sie ihr neues fahrzeug',
    'rate möglichst niedrig',
    'ausstattung wichtiger',
    'gewinnt an relevanz',
    'eher richtung',
  ];
  return forbiddenPhrases.some((phrase) => blob.includes(phrase));
}

export function sessionEnteredAutoRecommendation(session) {
  const turns = session?.turns ?? [];
  return turns.some((turn) => (
    turn.type === TURN_TYPE.RECOMMENDATION
    || turn.type === TURN_TYPE.THINKING
    || turn.type === 'vehicle_mini_recommendation'
  ));
}

export { SAFE_ANNUAL_KM_QUESTION_ID, FORBIDDEN_PLANNER_QUESTION_IDS };
