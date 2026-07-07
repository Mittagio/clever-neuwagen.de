/**
 * Customer Understanding – kanonische Ableitung aus Lead-Daten.
 * Eine Wahrheit für Verkäuferakte, Inbox, Lead, Angebotsvorbereitung.
 */
import { CLEVER_WORLD } from '../consultation/consultationWorlds.js';
import {
  buildUnderstoodLabels,
  createEmptyNeedProfile,
  getNeedProfileFromLead,
  mergeTextIntoNeedProfile,
  modelDisplayLabel,
} from '../consultation/needProfileService.js';

const CONCERN_PATTERNS = [
  {
    id: 'battery',
    label: 'Batterie unsicher',
    test: (text = '') => (
      /batterie|reichweite/i.test(text)
      && /unsicher|weiß nicht|weiss nicht|nicht sicher|angst|reicht nicht|zweifel|nicht reicht/i.test(text)
    ),
  },
];

function pushUnique(list = [], item) {
  if (!item || list.includes(item)) return list;
  return [...list, item];
}

function mergeLabelLists(...sections) {
  const out = [];
  const seen = new Set();
  for (const section of sections) {
    for (const label of section ?? []) {
      if (!label || seen.has(label)) continue;
      seen.add(label);
      out.push(label);
    }
  }
  return out;
}

function labelDelta(before = [], after = []) {
  const prev = new Set(before);
  return after.filter((label) => !prev.has(label));
}

/**
 * @param {string} text
 */
export function detectConcernsFromText(text = '') {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) return [];
  return CONCERN_PATTERNS
    .filter((pattern) => pattern.test(trimmed))
    .map((pattern) => pattern.label);
}

/**
 * @param {string[]} messages
 */
function detectConcernsFromMessages(messages = []) {
  const concerns = [];
  for (const message of messages) {
    for (const concern of detectConcernsFromText(message)) {
      concerns.push(concern);
    }
  }
  return [...new Set(concerns)];
}

/**
 * @param {object} lead
 */
function collectCustomerMessages(lead = {}) {
  const fromProfile = (lead?.crm?.needProfile?.rawMessages ?? [])
    .map((message) => String(message ?? '').trim())
    .filter(Boolean);
  if (fromProfile.length) return fromProfile;

  const initial = lead?.sonderwuensche?.consultation?.consultationProfile?.initialWish
    ?? lead?.inquiryBrief?.searchQuery
    ?? '';
  if (initial) return [String(initial).trim()];

  return (lead?.advisorConversation?.messages ?? [])
    .filter((message) => message.role === 'user')
    .map((message) => String(message.text ?? '').trim())
    .filter(Boolean);
}

/**
 * @param {object} lead
 */
function resolveNeedProfileForUnderstanding(lead = {}) {
  const stored = lead?.crm?.needProfile ?? null;
  const messages = collectCustomerMessages(lead);

  if (stored?.rawMessages?.length) {
    return stored;
  }

  if (stored) {
    return stored;
  }

  if (!messages.length) {
    return getNeedProfileFromLead(lead);
  }

  return messages.reduce(
    (profile, text) => mergeTextIntoNeedProfile(text, profile),
    createEmptyNeedProfile(messages[0]),
  );
}

/**
 * @param {string[]} messages
 */
export function buildUnderstandingEvolution(messages = []) {
  if (!messages.length) return [];

  let profile = createEmptyNeedProfile(messages[0]);
  let labelsBefore = [];
  let concernsBefore = [];
  const steps = [];

  for (const customerText of messages) {
    profile = mergeTextIntoNeedProfile(customerText, profile);
    const messageConcerns = detectConcernsFromText(customerText);
    const concernsAfter = [...new Set([...concernsBefore, ...messageConcerns])];
    const labelsAfter = mergeLabelLists(
      buildUnderstoodLabels(profile),
      concernsAfter,
    );
    const newLabels = labelDelta(
      mergeLabelLists(labelsBefore, concernsBefore),
      labelsAfter,
    );

    steps.push({
      customerText,
      newLabels,
      labelsAfter,
    });

    labelsBefore = buildUnderstoodLabels(profile);
    concernsBefore = concernsAfter;
  }

  return steps;
}

/**
 * @param {object} verstaendnis
 * @param {object} profile
 */
export function buildGespraechseinstieg(verstaendnis = {}, profile = {}) {
  const labels = verstaendnis.labels ?? [];
  const concerns = verstaendnis.concerns ?? [];
  const labelText = labels.join(' ').toLowerCase();

  const hasEv3 = /ev3/.test(labelText)
    || profile.selectedModelKey === 'ev3'
    || profile.modelHint === 'ev3';
  const hasBatteryConcern = concerns.includes('Batterie unsicher')
    || labels.some((label) => /batterie.*unsicher/i.test(label));
  const hasLongDistance = labels.some((label) => (
    /langstrecke|urlaub|reichweite wichtig/i.test(label)
  )) || profile.longDistance === 'often' || profile.longDistance === 'sometimes';
  const hasZugfahrzeug = labels.some((label) => /zugfahrzeug/i.test(label))
    || (profile.usage ?? []).includes('zugfahrzeug');
  const hasTow = labels.some((label) => /anhängelast|anhängerkupplung/i.test(label))
    || (profile.towCapacityKg ?? 0) >= 750
    || profile.towbar;

  let leadLine;
  if (hasEv3 && hasBatteryConcern) {
    leadLine = 'Beginnen Sie mit der Batteriegröße.';
  } else if (hasEv3 && hasLongDistance) {
    leadLine = 'Beginnen Sie mit der Reichweite.';
  } else if (hasZugfahrzeug && hasTow) {
    leadLine = 'Beginnen Sie mit der Anhängelast und Nutzung des Anhängers.';
  } else if (hasTow) {
    leadLine = 'Beginnen Sie mit der Anhängelast und Nutzung des Anhängers.';
  } else {
    leadLine = 'Beginnen Sie mit dem Wunsch des Kunden.';
  }

  const contextParts = [];
  if (hasEv3) {
    contextParts.push('Der Kunde interessiert sich bereits stark für den EV3');
  }
  if (hasBatteryConcern) {
    contextParts.push('hat aber Unsicherheit bei der Batteriegröße');
  } else if (hasLongDistance && hasEv3) {
    contextParts.push('fährt aber auch regelmäßig längere Strecken');
  }
  if (hasZugfahrzeug) {
    contextParts.push('sucht ein Zugfahrzeug');
  }
  if (hasTow && !hasZugfahrzeug) {
    contextParts.push('hat Anhänger-Anforderungen genannt');
  }

  let context = contextParts.join(', ');
  if (context) {
    context = `${context}.`;
    context = context.replace(', hat', ', hat');
  }

  return {
    lead: leadLine,
    context,
  };
}

/**
 * @param {object} lead
 * @param {string[]} profileMessages
 */
function buildOriginalton(lead = {}, profileMessages = []) {
  const advisorMessages = (lead?.advisorConversation?.messages ?? [])
    .filter((message) => message.role === 'user')
    .map((message) => String(message.text ?? '').trim())
    .filter(Boolean);

  const messages = profileMessages.length ? profileMessages : advisorMessages;
  const unique = [];
  const seen = new Set();
  for (const message of messages) {
    if (!message || seen.has(message)) continue;
    seen.add(message);
    unique.push(message);
  }

  let source = 'beratung';
  if (profileMessages.length && advisorMessages.length) {
    source = 'mixed';
  } else if (!profileMessages.length && advisorMessages.length) {
    source = 'frag_clever';
  }

  return {
    messages: unique,
    source,
  };
}

function resolveVehicles(profile = {}, labels = []) {
  const vehicles = [];
  if (profile.selectedModelKey) {
    vehicles.push(modelDisplayLabel(profile.selectedModelKey));
  } else if (profile.modelHint) {
    vehicles.push(modelDisplayLabel(profile.modelHint));
  }

  for (const label of labels) {
    if (/^ev\d/i.test(label) || /^sportage/i.test(label)) {
      vehicles.push(label);
    }
  }

  return [...new Set(vehicles)];
}

function resolveOpenPoints(profile = {}, lead = {}) {
  const handoffOpen = lead?.sonderwuensche?.consultation?.consultationHandoff?.openQuestions ?? [];
  const open = [
    ...(profile.openQuestions ?? []),
    ...handoffOpen,
  ].filter(Boolean);
  return [...new Set(open)];
}

function resolveUnderstandingSource(lead = {}) {
  const sources = [];
  if (lead?.crm?.needProfile) sources.push('need_profile');
  if (lead?.sonderwuensche?.consultation) sources.push('consultation');
  if (lead?.advisorConversation?.messages?.length) sources.push('advisor_conversation');
  if (lead?.inquiryBrief?.searchQuery) sources.push('inquiry_brief');
  if (sources.length === 0) return 'none';
  if (sources.length === 1) return sources[0];
  return 'mixed';
}

/**
 * @param {object} lead
 */
export function hasCustomerUnderstanding(lead = {}) {
  const profile = lead?.crm?.needProfile;
  if (profile && (
    (profile.rawMessages?.length ?? 0) > 0
    || (profile.understoodLabels?.length ?? 0) > 0
    || profile.initialWish
    || profile.selectedModelKey
  )) {
    return true;
  }

  if (lead?.sonderwuensche?.consultation?.consultationProfile?.initialWish) return true;
  if (lead?.sonderwuensche?.consultation?.cleverRecommendation?.vehicleTitle) return true;

  if ((lead?.advisorConversation?.messages ?? []).some((message) => message.role === 'user' && message.text)) {
    return true;
  }

  if (String(lead?.inquiryBrief?.searchQuery ?? '').trim()) return true;

  return false;
}

/**
 * @param {object} lead
 */
export function buildCustomerUnderstanding(lead = {}) {
  if (!hasCustomerUnderstanding(lead)) return null;

  const profile = resolveNeedProfileForUnderstanding(lead) ?? createEmptyNeedProfile();
  const customerMessages = collectCustomerMessages(lead);
  const concerns = detectConcernsFromMessages(customerMessages);
  const labels = mergeLabelLists(
    profile.understoodLabels?.length ? profile.understoodLabels : buildUnderstoodLabels(profile),
    concerns,
  );

  const entwicklung = buildUnderstandingEvolution(
    profile.rawMessages?.length ? profile.rawMessages : customerMessages,
  );

  const verstaendnis = {
    labels,
    concerns,
    openPoints: resolveOpenPoints(profile, lead),
    vehicles: resolveVehicles(profile, labels),
    priorities: [...(profile.priorities ?? [])],
  };

  const gespraechseinstieg = buildGespraechseinstieg(verstaendnis, profile);
  const originalton = buildOriginalton(lead, profile.rawMessages?.length ? profile.rawMessages : customerMessages);

  const resolvedWorld = lead?.crm?.needProfile?.world
    ?? (profile.selectedModelKey
      ? CLEVER_WORLD.VEHICLE_CONSULTATION
      : CLEVER_WORLD.NEED_CONSULTATION);

  return {
    meta: {
      hasData: true,
      world: resolvedWorld,
      confidence: profile.confidence ?? 0,
      updatedAt: profile.updatedAt ?? lead?.updatedAt ?? null,
      source: resolveUnderstandingSource(lead),
    },
    verstaendnis,
    entwicklung,
    gespraechseinstieg,
    originalton,
  };
}
