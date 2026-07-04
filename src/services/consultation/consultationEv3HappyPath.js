/**
 * Welt 2 – EV3 Fahrzeugberatung (Happy Path, kein Engine-Overkill).
 */
import { CLEVER_WORLD } from './consultationWorlds.js';
import { beginOfferHandoff } from './consultationOfferHandoff.js';
import {
  equipmentLabelsFromProfile,
  getRecognitionQuestionBlocks,
  shouldSkipEv3EquipmentQuestion,
} from './needRecognitionService.js';

export const VEHICLE_CONVERSATION_PHASE = {
  VEHICLE_CONVERSATION: 'vehicle_conversation',
  VEHICLE_THINKING: 'vehicle_thinking',
  VEHICLE_MINI_REC: 'vehicle_mini_rec',
  DEALER_PREP: 'dealer_prep',
};

export const VEHICLE_TURN_TYPE = {
  VEHICLE_LEARNED: 'vehicle_learned',
  CLEVER_REFLECTION: 'clever_reflection',
  VEHICLE_MINI_RECOMMENDATION: 'vehicle_mini_recommendation',
  DEALER_PREP_CARD: 'dealer_prep_card',
};

const EV3_PRIORITY_QUESTION = {
  id: 'ev3Priority',
  prompt:
    'Beim EV3 gibt es unterschiedliche Varianten. '
    + 'Ist Ihnen eher möglichst viel Reichweite wichtig '
    + '– oder eine besonders gute Ausstattung?',
  optionsHint: 'Zum Beispiel:',
  options: [
    { id: 'range', label: 'Mehr Reichweite' },
    { id: 'equipment', label: 'Mehr Ausstattung' },
    { id: 'balanced', label: 'Beides ausgewogen' },
  ],
};

const EV3_EQUIPMENT_QUESTION = {
  id: 'ev3Equipment',
  prompt: 'Falls Ihnen etwas davon wichtig ist, sagen Sie es einfach.',
  optionsHint: 'Falls davon etwas dabei ist:',
  options: [
    { id: 'heatPump', label: 'Wärmepumpe' },
    { id: 'towbar', label: 'Anhängerkupplung' },
    { id: 'hud', label: 'Head-up-Display' },
    { id: 'camera360', label: '360° Kamera' },
    { id: 'none', label: 'Nichts Bestimmtes' },
  ],
};

const PRIORITY_REFLECTION = {
  range: 'Dann würde ich eher auf die größere Batterie achten.',
  equipment: 'Dann lohnt sich ein Blick auf die hochwertigeren Varianten.',
  balanced: 'Dann schauen wir auf eine gute Balance aus Reichweite und Ausstattung.',
};

const VEHICLE_LEARNED_FROM_ANSWER = {
  ev3Priority: {
    range: ['Größere Reichweite'],
    equipment: ['Hochwertige Ausstattung'],
    balanced: ['Ausgewogene Variante'],
  },
  ev3Equipment: {
    heatPump: ['Wärmepumpe'],
    towbar: ['Anhängerkupplung'],
    hud: ['Head-up-Display'],
    camera360: ['360° Kamera'],
    none: [],
  },
};

const EV3_OPTION_EMOJI = {
  range: '🔋',
  equipment: '✨',
  balanced: '⚖️',
  heatPump: '🌡️',
  towbar: '🔗',
  hud: '🎯',
  camera360: '📷',
  none: '—',
};

function withOptionEmoji(options = []) {
  return options.map((option) => {
    const emoji = EV3_OPTION_EMOJI[option.id];
    if (!emoji || emoji === '—') return option;
    return { ...option, label: `${emoji} ${option.label}` };
  });
}

function buildEv3EquipmentQuestion(needProfile = {}) {
  const blocks = getRecognitionQuestionBlocks(needProfile);
  const optionBlockMap = {
    heatPump: 'heatPump',
    towbar: 'towbar',
    hud: 'hud',
    camera360: 'camera360',
  };
  const options = EV3_EQUIPMENT_QUESTION.options.filter(
    (option) => !blocks.has(optionBlockMap[option.id]),
  );
  return {
    ...EV3_EQUIPMENT_QUESTION,
    options: options.length ? options : [{ id: 'none', label: 'Nichts Bestimmtes' }],
  };
}

function vehicleQuestionTurn(question) {
  return {
    type: 'clever',
    id: `vehicle-clever-${question.id}`,
    questionId: question.id,
    world: CLEVER_WORLD.VEHICLE_CONSULTATION,
    text: question.prompt,
    optionsHint: question.optionsHint ?? 'Zum Beispiel:',
    options: withOptionEmoji(question.options ?? []),
  };
}

function reflectionTurn(text) {
  return {
    type: VEHICLE_TURN_TYPE.CLEVER_REFLECTION,
    id: `reflection-${Date.now()}`,
    text,
  };
}

function customerTurn(text) {
  return {
    type: 'customer',
    id: `vehicle-customer-${Date.now()}`,
    text,
  };
}

function appendVehicleLabels(existing = [], incoming = []) {
  const next = [...existing];
  for (const label of incoming) {
    if (label && !next.includes(label)) next.push(label);
  }
  return next;
}

function labelsForVehicleAnswer(questionId, answerId) {
  return VEHICLE_LEARNED_FROM_ANSWER[questionId]?.[answerId] ?? [];
}

function optionLabel(question, answerId) {
  return question.options?.find((o) => o.id === answerId)?.label ?? answerId;
}

export function buildEv3MiniRecommendation(vehicleProfile = {}, needProfile = {}) {
  const priority = vehicleProfile.answers?.ev3Priority ?? 'balanced';
  const equipment = vehicleProfile.answers?.ev3Equipment ?? 'none';

  let trimHint = 'Earth oder GT-Line prüfen';
  let batteryHint = 'Kia EV3 mit großer Batterie';

  if (priority === 'equipment') {
    trimHint = 'GT-Line oder Earth prüfen';
    batteryHint = 'Kia EV3';
  } else if (priority === 'balanced') {
    trimHint = 'Earth prüfen';
    batteryHint = 'Kia EV3';
  }

  const whyLines = [];
  if (priority === 'range' || needProfile.longDistance === 'often') {
    whyLines.push('mehr Reserven auf längeren Strecken');
  } else {
    whyLines.push('gute Balance für Alltag und Familie');
  }
  if (needProfile.priorities?.includes('family') || needProfile.children) {
    whyLines.push('passt besser zur Familiennutzung');
  }
  if (equipment !== 'none') {
    whyLines.push('gewünschte Ausstattung kann berücksichtigt werden');
  } else {
    whyLines.push('flexibel bei der Ausstattungswahl');
  }

  return {
    world: CLEVER_WORLD.VEHICLE_CONSULTATION,
    ready: true,
    headline: 'Für Ihren Wunsch würde ich beim EV3 zuerst diese Richtung prüfen:',
    batteryLine: batteryHint,
    trimLine: `Ausstattung: ${trimHint}`,
    whyLines,
    hasRate: false,
    hasOffer: false,
  };
}

function buildDealerPrepSummary(session) {
  const wishLabels = session.notepadLabels ?? [];
  const vehicleLabels = session.vehicleNotepadLabels ?? [];
  const mini = session.vehicleMiniRecommendation ?? {};

  return {
    title: 'Ihr Wunsch ist vorbereitet.',
    intro: 'Ihr Berater erhält jetzt:',
    items: [
      'Ihr Wunschprofil',
      'Die EV3-Richtung',
      ...(vehicleLabels.length ? ['wichtige Ausstattungswünsche'] : []),
      'offene Punkte',
    ],
    wishLabels,
    vehicleLabels,
    directionLine: mini.batteryLine ?? null,
    trimLine: mini.trimLine ?? null,
  };
}

function withVehiclePending(session, question) {
  return {
    ...session,
    pendingQuestion: question
      ? { id: question.id, options: question.options ?? [], world: CLEVER_WORLD.VEHICLE_CONSULTATION }
      : null,
  };
}

function startVehicleThinkingPhase(session) {
  return {
    ...session,
    phase: VEHICLE_CONVERSATION_PHASE.VEHICLE_THINKING,
    pendingQuestion: null,
    turns: [
      ...session.turns,
      {
        type: 'thinking',
        id: `vehicle-thinking-${Date.now()}`,
        text: 'Einen Moment …',
      },
    ],
  };
}

function finishVehicleMiniRecommendation(session) {
  const vehicleMiniRecommendation = buildEv3MiniRecommendation(
    session.vehicleProfile,
    session.needProfile,
  );
  return {
    ...session,
    phase: VEHICLE_CONVERSATION_PHASE.VEHICLE_MINI_REC,
    vehicleMiniRecommendation,
    pendingQuestion: null,
    turns: [
      ...session.turns.filter((t) => t.type !== 'thinking'),
      {
        type: VEHICLE_TURN_TYPE.VEHICLE_MINI_RECOMMENDATION,
        id: `vehicle-mini-rec-${Date.now()}`,
        recommendation: vehicleMiniRecommendation,
      },
    ],
  };
}

/**
 * Session-Felder für Welt 2 initialisieren.
 */
export function initVehicleSessionFields(session, modelKey = 'ev3', modelLabel = 'EV3') {
  return {
    ...session,
    vehicleNotepadLabels: session.vehicleNotepadLabels ?? [],
    vehicleProfile: session.vehicleProfile ?? { answers: {} },
    vehicleChapterTitle: `Fahrzeugberatung · Kia ${modelLabel}`,
    vehicleMiniRecommendation: null,
    selectedModelKey: modelKey,
    needProfile: {
      ...session.needProfile,
      selectedModelKey: modelKey,
      world: CLEVER_WORLD.VEHICLE_CONSULTATION,
    },
  };
}

/**
 * Nach „EV3 genauer ansehen“ – Einstieg + erste Frage.
 */
export function beginEv3VehicleConsultation(session, modelKey = 'ev3') {
  const modelLabel = modelKey === 'ev3' ? 'EV3' : modelKey.toUpperCase();
  let next = initVehicleSessionFields(session, modelKey, modelLabel);
  const prefillLabels = equipmentLabelsFromProfile(next.needProfile);
  if (prefillLabels.length) {
    next = {
      ...next,
      vehicleNotepadLabels: appendVehicleLabels(next.vehicleNotepadLabels ?? [], prefillLabels),
    };
  }
  next = {
    ...next,
    phase: VEHICLE_CONVERSATION_PHASE.VEHICLE_CONVERSATION,
    turns: [
      ...next.turns,
      {
        type: 'handoff',
        id: `handoff-${Date.now()}`,
        modelKey,
        modelLabel,
        chapterTitle: next.vehicleChapterTitle,
        text: `Prima. Dann schauen wir uns den Kia ${modelLabel} gemeinsam etwas genauer an.`,
      },
      vehicleQuestionTurn(EV3_PRIORITY_QUESTION),
    ],
  };
  return withVehiclePending(next, EV3_PRIORITY_QUESTION);
}

/**
 * @param {object} session
 * @param {{ answerId?: string, text?: string }} payload
 */
export function submitVehicleQuestionAnswer(session, payload = {}) {
  const questionId = session.pendingQuestion?.id;
  if (!questionId || session.pendingQuestion?.world !== CLEVER_WORLD.VEHICLE_CONSULTATION) {
    return session;
  }

  const answerId = payload.answerId
    ?? mapVehicleFreetextToAnswer(questionId, payload.text);
  if (!answerId) return session;

  const question = questionId === 'ev3Priority'
    ? EV3_PRIORITY_QUESTION
    : buildEv3EquipmentQuestion(session.needProfile);
  const displayText = payload.text?.trim() || optionLabel(question, answerId);
  const learned = labelsForVehicleAnswer(questionId, answerId);
  const vehicleProfile = {
    ...session.vehicleProfile,
    answers: { ...session.vehicleProfile?.answers, [questionId]: answerId },
  };
  const vehicleNotepadLabels = appendVehicleLabels(session.vehicleNotepadLabels, learned);

  let next = {
    ...session,
    vehicleProfile,
    vehicleNotepadLabels,
    pendingQuestion: null,
    turns: [
      ...session.turns,
      customerTurn(displayText),
    ],
  };

  if (questionId === 'ev3Priority') {
    const reflection = PRIORITY_REFLECTION[answerId] ?? PRIORITY_REFLECTION.balanced;
    if (shouldSkipEv3EquipmentQuestion(session.needProfile)) {
      next = {
        ...next,
        turns: [...next.turns, reflectionTurn(reflection)],
      };
      return startVehicleThinkingPhase(next);
    }
    const equipmentQuestion = buildEv3EquipmentQuestion(session.needProfile);
    next = {
      ...next,
      turns: [
        ...next.turns,
        reflectionTurn(reflection),
        vehicleQuestionTurn(equipmentQuestion),
      ],
    };
    return withVehiclePending(next, equipmentQuestion);
  }

  return startVehicleThinkingPhase(next);
}

export function advanceFromVehicleThinking(session) {
  if (session.phase !== VEHICLE_CONVERSATION_PHASE.VEHICLE_THINKING) return session;
  return finishVehicleMiniRecommendation(session);
}

/**
 * Welt 2 → 3: Persönliche Übergabe starten (Screen 5).
 */
export function submitDealerHandoff(session, dealerConditions = {}) {
  return beginOfferHandoff(session, dealerConditions);
}

export function mapVehicleFreetextToAnswer(questionId, text = '') {
  const t = String(text).toLowerCase().trim();
  if (!t) return null;

  if (questionId === 'ev3Priority') {
    if (/reichweite|batterie|weit|lang/.test(t)) return 'range';
    if (/ausstatt|komfort|gt|earth|hochwert/.test(t)) return 'equipment';
    if (/ausgewogen|beides|balance/.test(t)) return 'balanced';
    return 'balanced';
  }

  if (questionId === 'ev3Equipment') {
    if (/wärme|waerme|pumpe/.test(t)) return 'heatPump';
    if (/anhäng|ahk|kupplung/.test(t)) return 'towbar';
    if (/head|hud|display/.test(t)) return 'hud';
    if (/360|kamera|rundum/.test(t)) return 'camera360';
    if (/nichts|egal|offen/.test(t)) return 'none';
    return 'none';
  }

  return null;
}

export function isVehicleInputEnabled(session) {
  return session.phase === VEHICLE_CONVERSATION_PHASE.VEHICLE_CONVERSATION
    && Boolean(session.pendingQuestion?.world === CLEVER_WORLD.VEHICLE_CONSULTATION);
}

export function getVehicleInputPlaceholder() {
  return 'Oder einfach ergänzen …';
}

export function isInVehicleWorld(session) {
  return Object.values(VEHICLE_CONVERSATION_PHASE).includes(session.phase)
    || session.needProfile?.world === CLEVER_WORLD.VEHICLE_CONSULTATION;
}

export { EV3_PRIORITY_QUESTION, EV3_EQUIPMENT_QUESTION };
