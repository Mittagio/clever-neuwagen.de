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
import { buildVehicleReactionMessage, buildSellerQuestionPrompt, buildSellerThoughtBeforeQuestion } from '../clever/sellerReasoningEngine.js';
import { CLEVER_WORLD } from './consultationWorlds.js';
import {
  beginEv3VehicleConsultation,
  isVehicleInputEnabled,
  submitVehicleContinuingNarrative,
  submitVehicleQuestionAnswer,
  VEHICLE_CONVERSATION_PHASE,
} from './consultationEv3HappyPath.js';
import {
  NEED_DIRECTION_QUESTION_ID,
  SELLER_READINESS_QUESTION_ID,
  buildNeedDirectionQuestion,
  buildSellerReadinessQuestion,
  shouldOfferDirectionChoice,
  shouldOfferSellerReadinessGate,
} from './needUnderstandingGate.js';
import {
  buildVehicleDirectionsView,
  isEvDirectionModel,
} from './vehicleDirectionService.js';
import {
  applyInterestedDirectionToNotepad,
} from './progressiveVehicleDirections.js';
import {
  filterNewHandoffChipIds,
  QUICK_HANDOFF_ENRICHMENT_CHIPS,
} from './consultationOfferHandoff.js';
import { tryConversationKnowledgeAnswer } from './conversationKnowledgeAnswer.js';

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
  UNDERSTANDING_MIRROR: 'understanding_mirror',
  RECOMMENDATION: 'recommendation',
  VEHICLE_DIRECTIONS: 'vehicle_directions',
  HANDOFF: 'handoff',
  ADVISOR_COLLECT: 'advisor_collect',
};

export const UNDERSTANDING_MIRROR_COPY = {
  lead: 'Ich glaube, ich habe bereits ein gutes Bild Ihrer Wünsche:',
};

/** Warme Clever-Formulierungen – Verkäufer statt Formular. */
export const WARM_QUESTION_PROMPTS = {
  longDistance: 'Wie nutzen Sie das Fahrzeug überwiegend?',
  chargingAtHome:
    'Wenn Sie zuhause laden könnten – Garage oder Wallbox – wäre das für Sie möglich?',
  fuel_type:
    'Haben Sie beim Antrieb schon eine Richtung im Kopf – Benzin, Hybrid oder Elektro?',
  allradNeed:
    'Brauchen Sie Allrad wirklich – zum Beispiel wegen Anhänger, Schnee oder Gelände?',
  comfortVsSpace:
    'Soll es eher möglichst komfortabel sein – oder ist Ihnen vor allem viel Platz wichtig?',
  primaryUsage:
    'Ist das Fahrzeug eher für die Familie, für Sie selbst oder als Zweitwagen gedacht?',
  evModelPriority: 'Was wäre Ihnen wichtiger?',
  sportagePowertrain:
    'Kommt für Sie eher Benzin, Hybrid oder Plug-in-Hybrid infrage?',
  hybridPowertrain:
    'Kommt für Sie eher ein Vollhybrid (HEV) oder Plug-in-Hybrid (PHEV) infrage?',
  towingUsage: 'Was möchten Sie hauptsächlich ziehen?',
  vehicleNeedTiming: 'Wann benötigen Sie Ihr neues Fahrzeug ungefähr?',
  vehicleReturnDate: 'Wann geben Sie Ihr aktuelles Fahrzeug ungefähr zurück?',
  needDirection: null,
};

/** Kürzere Chip-Labels – weniger Formular, mehr Gespräch. */
const WARM_OPTION_LABELS = {
  longDistance: {
    rarely: 'Alltag',
    sometimes: 'regelmäßig längere Strecken',
    often: 'Urlaub und Familie',
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
    price: 'Preis',
    range: 'Reichweite',
    equipment: 'Ausstattung',
    balanced: 'Beides ausgewogen',
  },
  sportagePowertrain: {
    benzin: 'Benzin',
    hybrid: 'Hybrid',
    phev: 'Plug-in-Hybrid',
    open: 'Noch offen',
  },
  hybridPowertrain: {
    hev: 'Vollhybrid (HEV)',
    phev: 'Plug-in-Hybrid (PHEV)',
    open: 'Noch offen',
  },
  towingUsage: {
    small_trailer: 'kleiner Anhänger',
    caravan: 'Wohnwagen',
    horse: 'Pferdeanhänger',
    boat: 'Boot',
    open: 'Noch offen',
  },
  vehicleNeedTiming: {
    asap: 'möglichst bald',
    '8weeks': 'innerhalb der nächsten 8 Wochen',
    later: 'Fahrzeug läuft später aus',
    open: 'noch offen',
  },
  vehicleReturnDate: {
    '2026-10': '10/2026',
    '2026-12': '12/2026',
    '2027-03': '03/2027',
    '2027-06': '06/2027',
    unknown: 'noch unklar',
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
    rarely: ['Alltag'],
    sometimes: ['regelmäßig längere Strecken'],
    often: ['Urlaub und Familie'],
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
  hybridPowertrain: {
    hev: ['Vollhybrid (HEV)'],
    phev: ['Plug-in-Hybrid (PHEV)'],
    open: [],
  },
  towingUsage: {
    small_trailer: ['kleiner Anhänger'],
    caravan: ['Wohnwagen'],
    horse: ['Pferdeanhänger'],
    boat: ['Boot'],
    open: [],
  },
  vehicleNeedTiming: {
    asap: ['Lieferzeit: möglichst bald'],
    '8weeks': ['Lieferzeit: innerhalb 8 Wochen'],
    later: ['Fahrzeug läuft später aus'],
    open: [],
  },
  vehicleReturnDate: {
    '2026-10': ['Fahrzeugwechsel Oktober 2026'],
    '2026-12': ['Fahrzeugwechsel Dezember 2026'],
    '2027-03': ['Fahrzeugwechsel März 2027'],
    '2027-06': ['Fahrzeugwechsel Juni 2027'],
    unknown: [],
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
  return { answers: {}, sellerReady: false, advisorCollectMode: false };
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
    sellerReady: false,
    advisorCollectMode: false,
    selectedModelKey: null,
    vehicleDirectionsView: null,
    vehicleDirectionReactions: {},
  };
}

export function getOpeningCopy(_dealerName = 'Autohaus') {
  return {
    headline: 'Wonach suchen Sie?',
    subline: 'Schreiben oder sprechen Sie einfach Ihren Wunsch.',
    placeholder: 'z. B. Elektro-SUV mit Anhängerkupplung',
    voiceLabel: 'Spracheingabe',
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
    if (answerId === 'price') {
      next.priorities = [...new Set([...(next.priorities ?? []), 'budget'])];
    }
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

  if (questionId === 'hybridPowertrain') {
    if (answerId === 'hev') {
      next.fuel = 'hybrid';
      next.priorities = [...new Set([...(next.priorities ?? []), 'hev'])];
    }
    if (answerId === 'phev') {
      next.fuel = 'phev';
    }
  }

  if (questionId === 'towingUsage') {
    next.towingUsage = answerId;
    if (answerId === 'small_trailer' || answerId === 'boat') {
      next.priorities = [...new Set([...(next.priorities ?? []), 'towing'])];
    }
    if (answerId === 'caravan' || answerId === 'horse') {
      next.towing = next.towing ?? 'braked';
      next.priorities = [...new Set([...(next.priorities ?? []), 'towing', 'space'])];
    }
  }

  if (questionId === 'vehicleNeedTiming') {
    if (answerId === 'asap' || answerId === '8weeks') {
      next.priorities = [...new Set([...(next.priorities ?? []), 'urgency'])];
    }
  }

  if (questionId === 'vehicleReturnDate') {
    const timelineLabel = timelineLabelFromReturnDate(answerId);
    if (timelineLabel) {
      next.timelineLabel = timelineLabel;
    }
  }

  next.understoodLabels = buildUnderstoodLabels(next);
  return next;
}

function timelineLabelFromReturnDate(answerId) {
  const map = {
    '2026-10': 'Fahrzeugwechsel Oktober 2026',
    '2026-12': 'Fahrzeugwechsel Dezember 2026',
    '2027-03': 'Fahrzeugwechsel März 2027',
    '2027-06': 'Fahrzeugwechsel Juni 2027',
  };
  return map[answerId] ?? null;
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
    if (/plug-in|phev/.test(t)) return 'hybrid';
    if (/hybrid|hev|vollhybrid/.test(t)) return 'hybrid';
    if (/benzin|verbrenner|diesel/.test(t)) return 'benzin';
    if (/offen|unklar|egal/.test(t)) return 'open';
    return null;
  }

  if (questionId === 'hybridPowertrain') {
    if (/plug-in|phev|steckdose|laden zuhause/.test(t)) return 'phev';
    if (/vollhybrid|\bhev\b|ohne steckdose/.test(t)) return 'hev';
    if (/offen|unklar|egal/.test(t)) return 'open';
    return null;
  }

  if (questionId === SELLER_READINESS_QUESTION_ID) {
    if (/noch|fehlt|wichtig|ja\b/.test(t) && !/reicht|einsteigen|passt|nein|nichts/.test(t)) {
      return 'still_missing';
    }
    return 'seller_ready';
  }

  if (questionId === 'towingUsage') {
    if (/klein|baumarkt|boot|pferd|wohnwagen|anhänger|anhaenger/.test(t)) {
      if (/wohnwagen|caravan/.test(t)) return 'caravan';
      if (/pferd/.test(t)) return 'horse';
      if (/boot/.test(t)) return 'boat';
      return 'small_trailer';
    }
    return null;
  }

  if (questionId === 'vehicleNeedTiming') {
    if (/bald|sofort|schnell|dringend|woche/.test(t)) return 'asap';
    if (/8\s*wochen|acht wochen/.test(t)) return '8weeks';
    if (/später|spaeter|läuft|laeuft|leasing|aus/.test(t)) return 'later';
    if (/offen|unklar/.test(t)) return 'open';
    return null;
  }

  if (questionId === 'vehicleReturnDate') {
    const mmYyyy = t.match(/\b(0?[1-9]|1[0-2])\s*[\/.\-]\s*(20\d{2})\b/);
    if (mmYyyy) {
      const month = String(mmYyyy[1]).padStart(2, '0');
      const year = mmYyyy[2];
      const key = `${year}-${month}`;
      if (['2026-10', '2026-12', '2027-03', '2027-06'].includes(key)) return key;
    }
    if (/oktober\s*2026|10\s*2026|10\/2026/.test(t)) return '2026-10';
    if (/unklar|offen|weiß nicht|weiss nicht/.test(t)) return 'unknown';
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
  'hybridPowertrain',
  'sportagePowertrain',
  'towingUsage',
  'fuel_type',
  'comfortVsSpace',
  'allradNeed',
  'longDistance',
  'chargingAtHome',
  'vehicleNeedTiming',
  'vehicleReturnDate',
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
    return 'Falls wichtig für die Einordnung:';
  }
  if (questionId === 'sportagePowertrain') {
    return 'Das hilft bei der Einordnung noch etwas:';
  }
  if (questionId === 'hybridPowertrain') {
    return 'Das hilft bei der Einordnung noch etwas:';
  }
  if (questionId === 'towingUsage') {
    return 'Falls wichtig für Sie:';
  }
  return null;
}

function buildConsequenceIntro(needProfile = {}, question = {}) {
  const labels = needProfile.understoodLabels ?? [];
  const labelBlob = labels.join(' ').toLowerCase();

  if (/kuga|ford/.test(labelBlob) && /fahrzeugwechsel|läuft|laeuft/.test(labelBlob)) {
    return 'Dann spielt der Zeitpunkt des Fahrzeugwechsels wahrscheinlich eine größere Rolle.';
  }
  if ((needProfile.children || /kinder|familie/.test(labelBlob))
    && (question.id === 'comfortVsSpace' || question.id === 'primaryUsage')) {
    return 'Dann spielen Platz und Alltag vermutlich eine größere Rolle.';
  }
  if (getFuelCategory(needProfile) === 'electric' && question.id === 'longDistance') {
    return null;
  }
  if (/anhäng|ahk|kupplung|anhaenger/.test(labelBlob) && question.id === 'towingUsage') {
    return 'Mit Anhängerkupplung im Blick:';
  }
  return null;
}

function buildContextualQuestionPrompt(needProfile = {}, question = {}, consultationProfile = {}) {
  const sellerPrompt = buildSellerQuestionPrompt({
    needProfile,
    answers: consultationProfile?.answers ?? {},
    question,
  });
  if (sellerPrompt) return sellerPrompt;

  return WARM_QUESTION_PROMPTS[question.id] ?? question.prompt ?? '';
}

export function getHappyPathNextQuestion(needProfile, consultationProfile) {
  const answers = consultationProfile?.answers ?? {};
  const result = planNextQuestion({ needProfile, answers });
  const question = result.question;
  if (!question || !HAPPY_PATH_PLANNER_IDS.has(question.id)) return null;
  if (question.id === NEED_DIRECTION_QUESTION_ID) return null;
  return {
    ...question,
    prompt: buildContextualQuestionPrompt(needProfile, question, consultationProfile),
  };
}

/**
 * Katalogfrage oder Richtungswahl – je nach Verständnisstärke.
 * @param {object} needProfile
 * @param {object} consultationProfile
 */
export function resolveNextHappyPathQuestion(needProfile, consultationProfile) {
  const answers = consultationProfile?.answers ?? {};
  if (consultationProfile?.sellerReady) return null;
  if (consultationProfile?.advisorCollectMode) return null;
  if (answers[SELLER_READINESS_QUESTION_ID] === 'still_missing') return null;

  if (shouldOfferSellerReadinessGate(needProfile, consultationProfile)) {
    return buildSellerReadinessQuestion(needProfile);
  }

  const catalogQuestion = getHappyPathNextQuestion(needProfile, consultationProfile);
  if (shouldOfferDirectionChoice(needProfile, catalogQuestion, answers)) {
    return buildNeedDirectionQuestion(needProfile);
  }
  return catalogQuestion;
}

function enterAdvisorCollectMode(session) {
  return {
    ...session,
    phase: CONVERSATION_PHASE.HANDOFF,
    advisorCollectMode: true,
    sellerReady: false,
    consultationProfile: {
      ...session.consultationProfile,
      advisorCollectMode: true,
      sellerReady: false,
    },
    pendingQuestion: null,
    turns: [
      ...session.turns,
      {
        type: TURN_TYPE.ADVISOR_COLLECT,
        id: `advisor-collect-${Date.now()}`,
      },
    ],
  };
}

function enterSellerHandoffState(session) {
  if (session.phase === CONVERSATION_PHASE.HANDOFF && session.sellerReady) {
    return session;
  }
  return {
    ...session,
    phase: CONVERSATION_PHASE.HANDOFF,
    sellerReady: true,
    consultationProfile: {
      ...session.consultationProfile,
      sellerReady: true,
    },
    pendingQuestion: null,
    turns: [
      ...session.turns,
      {
        type: TURN_TYPE.CLEVER,
        id: `clever-seller-handoff-${Date.now()}`,
        text: 'Perfekt. Ihr Berater kann direkt einsteigen – ohne bei null anzufangen.',
      },
    ],
  };
}

function submitSellerReadinessAnswer(session, answerId, displayText) {
  const consultationProfile = answerConsultationQuestion(
    session.consultationProfile,
    SELLER_READINESS_QUESTION_ID,
    answerId,
  );

  let next = {
    ...session,
    consultationProfile: {
      ...consultationProfile,
      sellerReady: answerId === 'seller_ready',
    },
    sellerReady: answerId === 'seller_ready',
    pendingQuestion: null,
    turns: [
      ...session.turns,
      customerTurn(displayText),
    ],
  };

  if (answerId === 'seller_ready') {
    return enterSellerHandoffState(next);
  }

  return enterAdvisorCollectMode(next);
}

function advanceAfterCustomerTurn(session, needProfile, consultationProfile, options = {}) {
  const dismissedQuestionId = options.dismissedQuestionId ?? null;

  if (consultationProfile?.advisorCollectMode || session.advisorCollectMode) {
    return {
      ...session,
      needProfile,
      consultationProfile,
      phase: CONVERSATION_PHASE.HANDOFF,
      pendingQuestion: null,
    };
  }

  if (consultationProfile?.sellerReady || session.sellerReady) {
    return enterSellerHandoffState({
      ...session,
      needProfile,
      consultationProfile,
    });
  }

  const followUp = resolveNextHappyPathQuestion(needProfile, consultationProfile);
  if (followUp && followUp.id !== dismissedQuestionId) {
    let next = session;
    if (!options.afterReaction) {
      next = pushQuestionWithSellerThought(next, followUp, needProfile, consultationProfile);
    } else {
      next = pushTurn(next, cleverQuestionTurn(followUp));
      next = withPendingQuestion(next, followUp);
    }
    return { ...next, phase: CONVERSATION_PHASE.CONVERSATION };
  }

  const readiness = evaluateRecommendationReadiness({
    needProfile,
    answers: consultationProfile?.answers ?? {},
  });
  if (readiness.ready) {
    return startThinkingPhase(session);
  }

  return { ...session, phase: CONVERSATION_PHASE.CONVERSATION };
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

  const notepadUpdate = applyInterestedDirectionToNotepad(session, modelKey, reactionId);

  let next = {
    ...session,
    vehicleDirectionReactions: reactions,
    vehicleDirectionsView: directionsView,
    notepadLabels: notepadUpdate.notepadLabels,
    needProfile: notepadUpdate.needProfile ?? session.needProfile,
    turns: session.turns.map((turn) => (
      turn.type === TURN_TYPE.VEHICLE_DIRECTIONS
        ? { ...turn, directionsView: { ...turn.directionsView, reactions } }
        : turn
    )),
  };

  if (reactionId !== 'explore') {
    return next;
  }

  // „Mehr erfahren“ = Gesprächsnavigation, kein neuer Notizzettel-Wunsch
  const needProfile = {
    ...next.needProfile,
    selectedModelKey: modelKey,
  };
  next = {
    ...next,
    needProfile,
    selectedModelKey: modelKey,
  };

  if (isEvDirectionModel(modelKey)) {
    return beginEv3VehicleConsultation(next, modelKey);
  }

  const label = modelDisplayLabel(modelKey);
  return {
    ...next,
    turns: [
      ...next.turns,
      cleverAckTurn(`Gerne mehr zu ${label}.`),
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

function understandingMirrorTurn(labels = []) {
  return {
    type: TURN_TYPE.UNDERSTANDING_MIRROR,
    id: `understanding-mirror-${Date.now()}`,
    labels: [...labels],
  };
}

function cleverKnowledgeTurn(knowledge) {
  return {
    type: TURN_TYPE.CLEVER,
    id: `clever-knowledge-${Date.now()}`,
    text: knowledge.text,
    answerKind: 'knowledge',
    facts: knowledge.facts ?? [],
    modelCards: knowledge.modelCards ?? [],
    primaryModelKey: knowledge.primaryModelKey ?? null,
    knowledgeOnly: true,
  };
}

function pushKnowledgeThenFollowUp(session, needProfile, consultationProfile) {
  const followUp = resolveNextHappyPathQuestion(needProfile, consultationProfile);
  if (!followUp) {
    return advanceAfterCustomerTurn(session, needProfile, consultationProfile);
  }

  const contextualQuestion = {
    ...followUp,
    prompt: buildContextualQuestionPrompt(needProfile, followUp, consultationProfile),
  };

  let next = pushTurn(session, cleverQuestionTurn(contextualQuestion));
  next = withPendingQuestion(next, contextualQuestion);
  return { ...next, phase: CONVERSATION_PHASE.CONVERSATION };
}

function applyKnowledgeAnswerFlow(session, text, needProfile) {
  const knowledge = tryConversationKnowledgeAnswer(text, needProfile);
  if (!knowledge) return null;
  return pushTurn(session, cleverKnowledgeTurn(knowledge));
}

function cleverReactionTurn(text) {
  return {
    type: TURN_TYPE.CLEVER,
    id: `clever-reaction-${Date.now()}`,
    text,
    reactionOnly: true,
  };
}

function cleverQuestionTurn(question) {
  return {
    type: TURN_TYPE.CLEVER,
    id: `clever-${question.id}`,
    questionId: question.id,
    text: question.prompt,
    options: warmOptionsForQuestion(question),
    hint: question.hint ?? null,
    optionsHint: '',
  };
}

function pushQuestionWithSellerThought(session, question, needProfile, consultationProfile, { opening = false } = {}) {
  let next = session;
  const thought = buildSellerThoughtBeforeQuestion({
    needProfile,
    answers: consultationProfile?.answers ?? {},
    includeAck: opening,
  });
  if (thought) {
    next = pushTurn(next, cleverReactionTurn(thought));
  }
  next = pushTurn(next, cleverQuestionTurn(question));
  return withPendingQuestion(next, question);
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

  if (notepadLabels.length >= 1) {
    next = pushTurn(next, understandingMirrorTurn(notepadLabels));
  }

  const withKnowledge = applyKnowledgeAnswerFlow(next, trimmed, needProfile);
  if (withKnowledge) {
    return pushKnowledgeThenFollowUp(withKnowledge, needProfile, withKnowledge.consultationProfile);
  }

  const question = resolveNextHappyPathQuestion(needProfile, next.consultationProfile);
  if (question) {
    next = pushQuestionWithSellerThought(next, question, needProfile, next.consultationProfile, { opening: true });
  } else {
    next = advanceAfterCustomerTurn(next, needProfile, next.consultationProfile);
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

  if (questionId === SELLER_READINESS_QUESTION_ID) {
    const question = buildSellerReadinessQuestion(session.needProfile);
    const option = question.options?.find((o) => o.id === answerId);
    const displayText = payload.text?.trim()
      || option?.label
      || answerId;
    return submitSellerReadinessAnswer(session, answerId, displayText);
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

  const reactionText = buildVehicleReactionMessage(questionId, answerId, {
    needProfile,
    answers: consultationProfile?.answers ?? {},
  });
  if (reactionText) {
    next = pushTurn(next, cleverReactionTurn(reactionText));
  }

  const followUp = resolveNextHappyPathQuestion(needProfile, consultationProfile);
  if (followUp) {
    next = pushTurn(next, cleverQuestionTurn(followUp));
    next = withPendingQuestion(next, followUp);
    return next;
  }

  return advanceAfterCustomerTurn(next, needProfile, consultationProfile, { afterReaction: Boolean(reactionText) });
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
 * Kontextabhängiger Placeholder – Erzählen, nicht Suchen.
 * @param {object} session
 */
export function getConversationInputPlaceholder(session = {}) {
  const fallback = 'Erzählen oder fragen Sie einfach …';
  if (session.phase === CONVERSATION_PHASE.OPENING) {
    return getOpeningCopy(session.dealerName ?? 'Autohaus').placeholder;
  }

  const needProfile = session.needProfile ?? {};
  const labels = [
    ...(session.notepadLabels ?? []),
    ...(session.vehicleNotepadLabels ?? []),
    ...(needProfile.understoodLabels ?? []),
  ];
  const labelBlob = labels.join(' ').toLowerCase();
  const customerTurns = (session.turns ?? []).filter((t) => t.type === TURN_TYPE.CUSTOMER).length;

  if (
    session.selectedModelKey
    || needProfile.selectedModelKey
    || session.phase === VEHICLE_CONVERSATION_PHASE.VEHICLE_CONVERSATION
  ) {
    return 'Was ist Ihnen beim Auto besonders wichtig?';
  }

  if (/urlaub|reichweite|langstrecke|anhänger|anhaenger|laden|wallbox|garage|kroatien/.test(labelBlob)) {
    return 'Zum Beispiel Urlaub, Anhänger oder Laden zuhause …';
  }

  if (customerTurns >= 2 || labels.length >= 4) {
    return 'Was sollten wir noch wissen?';
  }

  if (customerTurns >= 1) {
    return 'Erzählen Sie einfach weiter …';
  }

  return fallback;
}

/**
 * Freitext während laufendem Gespräch – immer erzählen, nie blockieren.
 * @param {object} session
 * @param {string} text
 */
export function submitContinuingNarrative(session, text = '') {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) return session;

  const dismissedQuestionId = session.pendingQuestion?.id ?? null;
  const needProfile = mergeTextIntoNeedProfile(trimmed, session.needProfile);
  const notepadLabels = labelsFromNeedProfile(needProfile, session.notepadLabels);

  let next = {
    ...session,
    needProfile,
    notepadLabels,
    pendingQuestion: null,
    turns: [...session.turns, customerTurn(trimmed)],
  };

  if (session.advisorCollectMode || session.consultationProfile?.advisorCollectMode) {
    return { ...next, phase: CONVERSATION_PHASE.HANDOFF };
  }

  const withKnowledge = applyKnowledgeAnswerFlow(next, trimmed, needProfile);
  if (withKnowledge) {
    return pushKnowledgeThenFollowUp(withKnowledge, needProfile, withKnowledge.consultationProfile);
  }

  const followUp = resolveNextHappyPathQuestion(needProfile, next.consultationProfile);
  if (followUp && followUp.id !== dismissedQuestionId) {
    let advanced = pushTurn(next, cleverQuestionTurn(followUp));
    advanced = withPendingQuestion(advanced, followUp);
    return { ...advanced, phase: CONVERSATION_PHASE.CONVERSATION };
  }

  return advanceAfterCustomerTurn(next, needProfile, next.consultationProfile, {
    dismissedQuestionId,
  });
}

/**
 * Freitext in der unteren Leiste – Chips sind Vorschläge, Text hat Priorität.
 * @param {object} session
 * @param {string} text
 */
export function submitConversationInput(session, text = '') {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) return session;

  if (session.phase === CONVERSATION_PHASE.OPENING) {
    return submitOpeningMessage(session, trimmed);
  }

  if (session.phase === CONVERSATION_PHASE.RECOMMENDATION) {
    return session;
  }

  if (session.pendingQuestion?.world === CLEVER_WORLD.VEHICLE_CONSULTATION) {
    return submitVehicleContinuingNarrative(session, trimmed);
  }

  if (
    session.phase === CONVERSATION_PHASE.CONVERSATION
    || session.phase === CONVERSATION_PHASE.HANDOFF
    || session.phase === CONVERSATION_PHASE.THINKING
    || isVehicleInputEnabled(session)
  ) {
    return submitContinuingNarrative(session, trimmed);
  }

  return session;
}

function normalizeNeedLabel(label) {
  return String(label ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

const EQUIPMENT_LABEL_TO_WISH_ID = {
  'wärmepumpe': 'heat_pump',
  'waermepumpe': 'heat_pump',
  'v2l': 'v2l',
  'head-up-display': 'head_up_display',
  'hud': 'head_up_display',
  '360° kamera': 'camera_360',
  '360 kamera': 'camera_360',
  'matrix-led': 'matrix_led',
  'anhängerkupplung': 'towbar',
  'anhaengerkupplung': 'towbar',
  'sitzheizung hinten': 'rear_seat_heat',
  'elektrische heckklappe': 'power_tailgate',
  'großes navi': 'large_navi',
  'grosses navi': 'large_navi',
  'kofferraum wichtig': 'large_trunk',
  'panorama': 'panorama_roof',
  'tönung': 'tinting',
  'toenung': 'tinting',
};

/**
 * Entfernt ein verstandenens Label aus dem NeedProfile (Single Source of Truth).
 * Keine neue Wahrheit: wir löschen/neutralisieren die zugrunde liegenden Felder,
 * sodass buildUnderstoodLabels() das Label nicht direkt wieder erzeugt.
 *
 * @param {object} session
 * @param {string} label
 */
export function removeNeedLabel(session, label) {
  const key = normalizeNeedLabel(label);
  if (!key) return session;

  const prevProfile = session.needProfile ?? {};
  const nextProfile = { ...prevProfile };

  // Modelle
  if (/^(ev2|ev3|ev4|ev5|ev6|ev9|sportage|ceed|niro|picanto|sorento)$/.test(key)) {
    nextProfile.modelHint = null;
    nextProfile.selectedModelKey = null;
    nextProfile.world = 'need_consultation';
  }

  // Kraftstoff
  if (/^(elektro|hybrid|plug-in-hybrid|benzin|diesel)$/.test(key)) {
    nextProfile.fuel = null;
  }

  // Budget / Zahlungsart
  if (key === 'leasing' || key === 'finanzierung' || key === 'kauf') {
    nextProfile.budget = { ...(nextProfile.budget ?? {}), paymentType: null, paymentExplicit: false };
  }
  if (key.startsWith('budget')) {
    nextProfile.budget = {
      ...(nextProfile.budget ?? {}),
      maxMonthlyRate: null,
      maxPrice: null,
    };
  }

  // Farbe
  if (/^(blau|rot|weiß|weiss|schwarz|grün|gruen|grau|silber|wolfsgrau)$/.test(key)) {
    nextProfile.colorHint = null;
  }

  // Familie / Personen
  if (key === 'familie') {
    nextProfile.children = null;
    nextProfile.dog = false;
    nextProfile.usage = (nextProfile.usage ?? []).filter((u) => u !== 'family');
    nextProfile.priorities = (nextProfile.priorities ?? []).filter((p) => p !== 'family');
  }

  // Anhänger / AHK / Zuglast
  if (key.includes('anhäng') || key.includes('anhaeng') || key.includes('ahk') || key.includes('anhängelast')) {
    nextProfile.towbar = false;
    nextProfile.towing = null;
    nextProfile.towCapacityKg = null;
    nextProfile.priorities = (nextProfile.priorities ?? []).filter((p) => p !== 'towing');
  }

  // Kilometer / Laufzeit
  if (/\bkm\b/.test(key)) {
    nextProfile.annualKm = null;
  }
  if (/\bmonate\b/.test(key)) {
    nextProfile.leaseDurationMonths = null;
  }

  // Ausstattung
  const equipId = EQUIPMENT_LABEL_TO_WISH_ID[key];
  if (equipId) {
    nextProfile.equipmentWishes = (nextProfile.equipmentWishes ?? []).filter((id) => id !== equipId);
    if (equipId === 'towbar') nextProfile.towbar = false;
  }

  // Offene Fragen / Extras – falls der Chip davon stammt, einfach entfernen.
  nextProfile.openQuestions = (nextProfile.openQuestions ?? []).filter((q) => normalizeNeedLabel(q) !== key);
  nextProfile.extraLabels = (nextProfile.extraLabels ?? []).filter((l) => normalizeNeedLabel(l) !== key);

  nextProfile.understoodLabels = buildUnderstoodLabels(nextProfile);

  return {
    ...session,
    needProfile: nextProfile,
    // Intake: Notizzettel neu aus Profil ableiten – entfernte Chips nicht aus previous behalten
    notepadLabels: buildUnderstoodLabels(nextProfile),
  };
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
  if (session.advisorCollectMode || session.consultationProfile?.advisorCollectMode) {
    return false;
  }
  return session.phase === CONVERSATION_PHASE.OPENING
    || session.phase === CONVERSATION_PHASE.CONVERSATION
    || session.phase === CONVERSATION_PHASE.HANDOFF
    || isVehicleInputEnabled(session);
}

export function isAdvisorCollectMode(session = {}) {
  return Boolean(session.advisorCollectMode || session.consultationProfile?.advisorCollectMode);
}

/**
 * Optionale Schnellaufnahme vor Beraterkontakt – bestehende Parser-Pipeline.
 * @param {object} session
 * @param {{ selectedChipIds?: string[], freetext?: string }} enrichment
 */
export function applyQuickHandoffEnrichment(session, enrichment = {}) {
  const selectedChipIds = filterNewHandoffChipIds(session, enrichment.selectedChipIds ?? []);
  const freetext = String(enrichment.freetext ?? '').trim();
  if (!selectedChipIds.length && !freetext) return session;

  let next = session;

  for (const chipId of selectedChipIds) {
    const chip = QUICK_HANDOFF_ENRICHMENT_CHIPS.find((c) => c.id === chipId);
    if (!chip?.text) continue;
    const needProfile = mergeTextIntoNeedProfile(chip.text, next.needProfile);
    next = {
      ...next,
      needProfile,
      notepadLabels: labelsFromNeedProfile(needProfile, next.notepadLabels),
    };
  }

  if (freetext) {
    const needProfile = mergeTextIntoNeedProfile(freetext, next.needProfile);
    next = {
      ...next,
      needProfile,
      notepadLabels: labelsFromNeedProfile(needProfile, next.notepadLabels),
      turns: [...next.turns, customerTurn(freetext)],
    };
  }

  return next;
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
  buildAdvisorContactPrompt,
  QUICK_HANDOFF_ENRICHMENT_CHIPS,
  QUICK_HANDOFF_COPY,
  buildAdvisorBoostView,
  buildWishProfilePresentation,
  inferRecognizedBoostChipIds,
  countSessionUnderstandingLabels,
  createLeadFromConsultationHappyPath,
  validateHandoffForm,
  isInOfferWorld,
  OFFER_CONVERSATION_PHASE,
  OFFER_TURN_TYPE,
  CONTACT_TIMING_OPTIONS,
} from './consultationOfferHandoff.js';
