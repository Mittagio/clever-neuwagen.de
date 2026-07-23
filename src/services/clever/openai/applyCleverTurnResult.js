/**
 * CleverTurnResult → Consultation-Session (bestehender Chatverlauf).
 */
import {
  CONVERSATION_PHASE,
  TURN_TYPE,
} from '../../consultation/consultationHappyPath.js';
import {
  buildUnderstoodLabels,
  mergeTextIntoNeedProfile,
} from '../../consultation/needProfileService.js';
import { KIA_MODEL_ATTRIBUTES } from '../../../data/kia/kiaModelAttributes.js';
import { getKiaModelMediaEntry } from '../../../data/kia/kiaModelImages.js';
import { applyNeedProfilePatch, sanitizeNeedProfilePatch } from './needProfilePatch.js';
import { formatHumanFactChip } from './conversationFactDisplay.js';
import { getVerifiedVehicleFacts } from './tools/getVerifiedVehicleFacts.js';
import { keepPublicIntakeMessenger } from '../../consultation/safeIntakeFallback.js';
import {
  buildDeterministicNextTopics,
  sanitizeNextTopics,
} from '../../consultation/conversationNextTopics.js';
import { maybeAppendProgressiveVehicleDirections } from '../../consultation/progressiveVehicleDirections.js';

function appendLabels(existing = [], incoming = []) {
  const next = [...existing];
  for (const label of incoming) {
    if (label && !next.includes(label)) next.push(label);
  }
  return next;
}

function isAnnualKmOnlyUtterance(text = '') {
  const t = String(text).toLowerCase();
  if (!/\d/.test(t) || !/\bkm\b/.test(t)) return false;
  if (/\breichweite|wltp|langstrecke|autobahn|pendeln\b/.test(t)) return false;
  return /\d{1,2}(?:\.\d{3})?\s*[–\-]\s*\d{1,2}(?:\.\d{3})?\s*km/.test(t)
    || /\bbis\s+\d/.test(t)
    || /\b\d{1,2}(?:\.\d{3})?\s*km(?:\s*\/?\s*jahr)?/.test(t)
    || /\büber\s*20/.test(t);
}

function stripLangstreckeFromAnnualKmPatch(patch = {}, customerMessage = '') {
  if (!isAnnualKmOnlyUtterance(customerMessage)) return patch;
  const next = { ...patch };
  if ('longDistance' in next) delete next.longDistance;
  if (Array.isArray(next.usage)) {
    next.usage = next.usage.filter((item) => !/langstrecke/i.test(String(item)));
    if (!next.usage.length) delete next.usage;
  }
  return next;
}

function customerTurn(text) {
  return {
    type: TURN_TYPE.CUSTOMER,
    id: `customer-${Date.now()}`,
    text,
  };
}

function formatFactValue(fact) {
  const value = fact?.value;
  if (value == null) return '–';

  if (typeof value === 'object' && !Array.isArray(value)) {
    if (fact.key === 'dimensions' || value.lengthMm != null || value.wheelbaseMm != null) {
      const parts = [];
      if (value.lengthMm != null) parts.push(`Länge ${Number(value.lengthMm).toLocaleString('de-DE')} mm`);
      if (value.widthMm != null) parts.push(`Breite ${Number(value.widthMm).toLocaleString('de-DE')} mm`);
      if (value.heightMm != null) parts.push(`Höhe ${Number(value.heightMm).toLocaleString('de-DE')} mm`);
      if (value.wheelbaseMm != null) parts.push(`Radstand ${Number(value.wheelbaseMm).toLocaleString('de-DE')} mm`);
      return parts.length ? parts.join(' · ') : 'Abmessungen verfügbar';
    }
    if (fact.key === 'charging' || value.dcCharge10_80Min != null || value.acCharge0_100Min != null) {
      const parts = [];
      if (value.dcCharge10_80Min != null) parts.push(`DC 10–80 %: ${value.dcCharge10_80Min} Min`);
      if (value.acCharge0_100Min != null) parts.push(`AC 0–100 %: ${value.acCharge0_100Min} Min`);
      return parts.length ? parts.join(' · ') : 'Ladedaten verfügbar';
    }
    return Object.entries(value)
      .filter(([, v]) => v != null && v !== '')
      .map(([k, v]) => `${k}: ${v}`)
      .join(' · ') || '–';
  }

  if (fact.unit) return `${value} ${fact.unit}`;
  return String(value);
}

function buildFactsFromUsedIds(usedFactIds = [], vehicleDirections = []) {
  const facts = [];
  const modelKeys = new Set([
    ...vehicleDirections.map((d) => d.modelKey),
  ]);

  for (const modelKey of modelKeys) {
    const requestedFacts = [];
    for (const factId of usedFactIds) {
      if (String(factId).includes(`:${modelKey}:`)) {
        const key = String(factId).split(':').pop();
        requestedFacts.push(key);
      }
    }
    if (!requestedFacts.length) continue;
    const result = getVerifiedVehicleFacts({ modelKey, requestedFacts: [...new Set(requestedFacts)] });
    for (const fact of result.facts ?? []) {
      const human = formatHumanFactChip(fact.key, fact.value, fact.unit ?? null);
      if (human) {
        facts.push({
          key: fact.key,
          icon: human.icon,
          chip: human.chip,
          label: human.label,
          value: human.value,
        });
        continue;
      }
      const readable = formatFactValue(fact);
      if (readable && readable !== '–' && !/^[a-zA-Z]+$/.test(String(fact.key))) {
        facts.push({
          key: fact.key,
          icon: '·',
          chip: readable,
          label: readable,
          value: readable,
        });
      }
    }
  }
  return facts.slice(0, 4);
}

function compactFactLine(modelKey) {
  const result = getVerifiedVehicleFacts({
    modelKey,
    requestedFacts: ['wltpRange', 'seats', 'towingCapacity'],
  });
  const parts = [];
  for (const fact of result.facts ?? []) {
    const human = formatHumanFactChip(fact.key, fact.value, fact.unit ?? null);
    if (!human) continue;
    if (fact.key === 'wltpRange') parts.push(human.text.replace(/\s*WLTP\s*$/i, '').trim());
    else if (fact.key === 'seats') parts.push(human.text);
    else if (fact.key === 'towingCapacity') parts.push(human.text);
    if (parts.length >= 2) break;
  }
  return parts.join(' · ');
}

function buildModelCards(vehicleDirections = []) {
  return vehicleDirections
    .filter((d) => d.status === 'candidate' || d.status === 'interesting')
    .slice(0, 2)
    .map((d) => {
      const attrs = KIA_MODEL_ATTRIBUTES[d.modelKey] ?? {};
      const name = attrs.label ?? d.modelKey;
      const shortName = String(name).replace(/^Kia\s+/i, '');
      const image = getKiaModelMediaEntry(d.modelKey, 'card').card;
      const factLine = compactFactLine(d.modelKey);
      return {
        modelKey: d.modelKey,
        name,
        subtitle: attrs.tagline || attrs.bodyTypeLabel || null,
        factLine: factLine || null,
        image,
        ctaLabel: `${shortName} ansehen`,
        bullets: [d.reason].filter(Boolean).slice(0, 2),
      };
    });
}

function buildQuestionFromNextAction(nextAction = {}) {
  if (!nextAction.question) return null;
  const questionId = nextAction.targetField
    ? `ai_${nextAction.targetField}`
    : `ai_${nextAction.type}`;

  return {
    id: questionId,
    prompt: nextAction.question,
    options: (nextAction.options ?? []).map((opt) => ({
      id: String(opt.value),
      label: opt.label,
    })),
    hint: nextAction.reason ?? null,
    aiGenerated: true,
  };
}

function resolveTurnNextTopics({
  turnResult,
  needProfile,
  notepadLabels,
  customerMessage,
  answeredTopicIds = [],
}) {
  const fromAi = sanitizeNextTopics(turnResult.nextTopics ?? []);
  if (fromAi.length) return fromAi;
  return buildDeterministicNextTopics({
    needProfile,
    notepadLabels,
    text: customerMessage,
    answeredTopicIds,
  });
}

function cleverAiTurn(turnResult, nextTopics = []) {
  const facts = buildFactsFromUsedIds(turnResult.usedFactIds ?? [], turnResult.vehicleDirections ?? []);
  const modelCards = buildModelCards(turnResult.vehicleDirections ?? []);
  const isKnowledge = turnResult.intent === 'knowledge_question';
  const offerHandoff = turnResult.nextAction?.type === 'offer_handoff'
    || Boolean(turnResult.handoff?.ready);

  return {
    type: TURN_TYPE.CLEVER,
    id: `clever-ai-${Date.now()}`,
    text: turnResult.reply,
    answerKind: isKnowledge || facts.length ? 'knowledge' : undefined,
    facts,
    modelCards,
    nextTopics,
    knowledgeOnly: isKnowledge && turnResult.nextAction?.type === 'none',
    aiTurn: true,
    mode: 'ai',
    intent: turnResult.intent,
    offerHandoff,
  };
}

function cleverQuestionTurn(question) {
  return {
    type: TURN_TYPE.CLEVER,
    id: `clever-${question.id}`,
    questionId: question.id,
    text: question.prompt,
    options: question.options ?? [],
    hint: question.hint ?? null,
    optionsHint: '',
    aiGenerated: true,
  };
}

/**
 * @param {object} session
 * @param {{ customerMessage: string, turnResult: object }} payload
 */
export function applyCleverTurnToSession(session, { customerMessage, turnResult }) {
  const trimmed = String(customerMessage ?? '').trim();
  if (!trimmed || !turnResult) return session;

  let needProfile = mergeTextIntoNeedProfile(trimmed, session.needProfile);
  const prevNeedProfile = session.needProfile ?? {};
  let { patch, rejectedKeys } = sanitizeNeedProfilePatch(turnResult.needProfilePatch ?? {});
  if (rejectedKeys.length) {
    throw new Error(`rejected_need_profile_fields:${rejectedKeys.join(',')}`);
  }
  patch = stripLangstreckeFromAnnualKmPatch(patch, trimmed);
  needProfile = applyNeedProfilePatch(needProfile, patch);

  // Jahres-km-Äußerung: Langstrecke aus Merge/Patch entfernen
  if (isAnnualKmOnlyUtterance(trimmed)) {
    needProfile = {
      ...needProfile,
      longDistance: prevNeedProfile.longDistance ?? null,
      usage: (needProfile.usage ?? []).filter((item) => !/langstrecke/i.test(String(item))),
      understoodLabels: (needProfile.understoodLabels ?? [])
        .filter((label) => !/^langstrecke$/i.test(String(label))),
    };
    needProfile.understoodLabels = buildUnderstoodLabels(needProfile);
  }

  const notepadLabels = appendLabels(
    session.notepadLabels ?? [],
    buildUnderstoodLabels(needProfile),
  ).filter((label) => !(isAnnualKmOnlyUtterance(trimmed) && /^langstrecke$/i.test(String(label))));

  let next = {
    ...session,
    needProfile,
    notepadLabels,
    pendingQuestion: null,
    conversationMode: 'ai',
    cleverVehicleDirections: turnResult.vehicleDirections ?? [],
    turns: [...(session.turns ?? []), customerTurn(trimmed)],
    phase: session.phase === CONVERSATION_PHASE.OPENING
      ? CONVERSATION_PHASE.CONVERSATION
      : session.phase,
  };

  const topics = resolveTurnNextTopics({
    turnResult,
    needProfile,
    notepadLabels,
    customerMessage: trimmed,
    answeredTopicIds: session.answeredNextTopicIds ?? [],
  });

  next = {
    ...next,
    turns: [...next.turns, cleverAiTurn(turnResult, topics)],
  };

  if (turnResult.nextAction?.type && turnResult.nextAction.type !== 'none') {
    const question = buildQuestionFromNextAction(turnResult.nextAction);
    if (question?.prompt) {
      const hasOptions = (question.options?.length ?? 0) > 0;
      next = {
        ...next,
        turns: [
          ...next.turns.map((turn, index, arr) => (
            index === arr.length - 1 && turn.type === TURN_TYPE.CLEVER
              ? { ...turn, nextTopics: [] }
              : turn
          )),
          {
            ...cleverQuestionTurn(question),
            nextTopics: topics,
          },
        ],
        pendingQuestion: hasOptions
          ? { id: question.id, options: question.options }
          : null,
        phase: CONVERSATION_PHASE.CONVERSATION,
      };
    }
  }

  if (turnResult.nextAction?.type === 'offer_handoff' || turnResult.handoff?.ready) {
    // Richtungen zuerst anhängen, bevor Handoff-Flags greifen
    next = maybeAppendProgressiveVehicleDirections(next, prevNeedProfile);
    next = {
      ...next,
      sellerReady: Boolean(turnResult.handoff?.ready) || next.sellerReady,
      offerRequested: true,
      phase: turnResult.handoff?.ready ? CONVERSATION_PHASE.HANDOFF : next.phase,
    };
    return keepPublicIntakeMessenger(next);
  }

  return keepPublicIntakeMessenger(
    maybeAppendProgressiveVehicleDirections(next, prevNeedProfile),
  );
}
