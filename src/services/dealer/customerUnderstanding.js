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
import {
  getSellerInsightsFromLead,
  hasSellerInsights,
  SELLER_BADGE_FALLBACK,
} from './sellerInsights.js';

function normalizeChipKey(text = '') {
  return String(text).toLowerCase().replace(/\s+/g, ' ').trim();
}
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
      text: customerText,
      source: 'customer',
      newLabels,
      labelsAfter,
    });

    labelsBefore = buildUnderstoodLabels(profile);
    concernsBefore = concernsAfter;
  }

  return steps;
}

/**
 * @param {object[]} insights
 */
export function buildSellerInsightEvolution(insights = []) {
  if (!insights.length) return [];

  let labelsBefore = [];
  let concernsBefore = [];
  const steps = [];

  for (const insight of insights) {
    const sellerText = String(insight.text ?? '').trim();
    if (!sellerText) continue;

    const profile = mergeTextIntoNeedProfile(sellerText);
    const messageConcerns = detectConcernsFromText(sellerText);
    const concernsAfter = [...new Set([...concernsBefore, ...messageConcerns])];
    const labelsAfter = mergeLabelLists(
      insight.understoodLabels?.length
        ? insight.understoodLabels
        : buildUnderstoodLabels(profile),
      concernsAfter,
    );
    const newLabels = labelDelta(
      mergeLabelLists(labelsBefore, concernsBefore),
      labelsAfter,
    );

    steps.push({
      customerText: sellerText,
      text: sellerText,
      source: 'seller',
      context: insight.context ?? null,
      createdAt: insight.createdAt ?? null,
      sellerInitials: insight.sellerInitials || SELLER_BADGE_FALLBACK,
      sellerName: insight.sellerName || null,
      newLabels,
      labelsAfter,
    });

    labelsBefore = labelsAfter;
    concernsBefore = concernsAfter;
  }

  return steps;
}

/**
 * @param {object[]} customerSteps
 * @param {object[]} sellerSteps
 */
export function mergeUnderstandingEvolution(customerSteps = [], sellerSteps = []) {
  return [
    ...customerSteps.map((step) => ({ ...step, source: step.source ?? 'customer' })),
    ...sellerSteps.map((step) => ({ ...step, source: step.source ?? 'seller' })),
  ];
}

/**
 * Ephemeres Profil nur für Ableitung – needProfile bleibt unverändert.
 * @param {object} customerProfile
 * @param {object[]} sellerInsights
 */
export function buildEphemeralMergedProfile(customerProfile = {}, sellerInsights = []) {
  let merged = { ...customerProfile };
  for (const insight of sellerInsights) {
    const text = String(insight.text ?? '').trim();
    if (!text) continue;
    merged = mergeTextIntoNeedProfile(text, merged);
  }
  return merged;
}

/**
 * @param {object} verstaendnis
 * @param {object} profile
 */
export function buildGespraechseinstieg(verstaendnis = {}, profile = {}) {
  const labels = verstaendnis.labels ?? [];
  const concerns = verstaendnis.concerns ?? [];
  const openPoints = verstaendnis.openPoints ?? [];
  const labelText = labels.join(' ').toLowerCase();
  const openText = openPoints.join(' ').toLowerCase();

  const hasEv3 = /ev3/.test(labelText)
    || profile.selectedModelKey === 'ev3'
    || profile.modelHint === 'ev3';
  const hasEv4 = /ev4/.test(labelText)
    || profile.selectedModelKey === 'ev4'
    || profile.modelHint === 'ev4';
  const hasEvUncertainty = /ev3 oder ev4 offen/i.test(labelText)
    || openText.includes('ev3 oder ev4 offen')
    || openPoints.some((point) => /ev3 oder ev4/i.test(point));
  const hasBatteryConcern = concerns.includes('Batterie unsicher')
    || labels.some((label) => /batterie.*unsicher/i.test(label));
  const hasLongDistance = labels.some((label) => (
    /langstrecke|urlaub|reichweite wichtig/i.test(label)
  )) || profile.longDistance === 'often' || profile.longDistance === 'sometimes';
  const hasUrlaub = labels.some((label) => /urlaub/i.test(label))
    || (profile.usage ?? []).includes('urlaub');
  const hasLieferzeitPriority = labels.some((label) => /lieferzeit wichtiger|schnell verfügbar/i.test(label));
  const hasSpiritPreferred = labels.some((label) => /spirit bevorzugt/i.test(label));
  const hasAnschluss = labels.some((label) => /anschlussmobilität|fahrzeugwechsel|restwertübernahme|ford kuga/i.test(label))
    || Boolean(profile.timelineLabel)
    || profile.residualTakeover === true;
  const hasZugfahrzeug = labels.some((label) => /zugfahrzeug/i.test(label))
    || (profile.usage ?? []).includes('zugfahrzeug');
  const hasTow = labels.some((label) => /anhängelast|anhängerkupplung/i.test(label))
    || (profile.towCapacityKg ?? 0) >= 750
    || profile.towbar;

  let leadLine;
  if (hasAnschluss && (/\bkuga\b/i.test(labelText) || profile.timelineLabel)) {
    leadLine = 'Beginnen Sie mit der Anschlusslösung zum Ford Kuga und der gewünschten Übernahmeoption.';
  } else if (hasSpiritPreferred) {
    leadLine = 'Beginnen Sie mit der Spirit-Ausstattung und bestätigen Sie die Alltagstauglichkeit.';
  } else if (hasLieferzeitPriority) {
    leadLine = 'Beginnen Sie mit Verfügbarkeit und möglichen Lieferterminen.';
  } else if ((hasEv3 || hasEv4) && (hasLongDistance || hasUrlaub)) {
    if (hasBatteryConcern || hasEvUncertainty) {
      leadLine = 'Beginnen Sie mit Reichweite und Batteriegröße sowie der Nutzung im Urlaub.';
    } else {
      leadLine = 'Beginnen Sie mit der Reichweite und der Nutzung im Urlaub.';
    }
  } else if (hasEv3 && hasBatteryConcern) {
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
  if (hasSellerInsights(lead)) sources.push('seller_insights');
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

  if (hasSellerInsights(lead)) return true;

  return false;
}

/**
 * Chips mit Herkunft: Kunde (ohne Badge) vs. Verkäufer (Kürzel MQ/CG, Fallback VK).
 * needProfile bleibt kundenrein – Attribution ist nur Display.
 *
 * @param {object} lead
 * @param {string[]} [customerLabels]
 * @param {object[]} [sellerInsights]
 */
export function buildAttributedWishChips(
  lead = {},
  customerLabels = null,
  sellerInsights = null,
) {
  const profile = resolveNeedProfileForUnderstanding(lead) ?? createEmptyNeedProfile();
  const customer = customerLabels ?? (
    profile.understoodLabels?.length
      ? profile.understoodLabels
      : buildUnderstoodLabels(profile)
  );
  const insights = sellerInsights ?? getSellerInsightsFromLead(lead);
  const chips = [];
  const seen = new Set();

  for (const label of customer) {
    const key = normalizeChipKey(label);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    chips.push({
      label,
      origin: 'customer',
      badge: null,
      sellerName: null,
    });
  }

  for (const insight of insights) {
    const badge = insight.sellerInitials || SELLER_BADGE_FALLBACK;
    const sellerName = insight.sellerName || null;
    const labels = insight.understoodLabels?.length
      ? insight.understoodLabels
      : [insight.text].filter(Boolean);
    for (const label of labels) {
      const key = normalizeChipKey(label);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      chips.push({
        label,
        origin: 'seller',
        badge,
        sellerName,
      });
    }
  }

  return chips;
}

/**
 * @param {object} lead
 */
export function buildCustomerUnderstanding(lead = {}) {
  if (!hasCustomerUnderstanding(lead)) return null;

  const profile = resolveNeedProfileForUnderstanding(lead) ?? createEmptyNeedProfile();
  const sellerInsights = getSellerInsightsFromLead(lead);
  const customerMessages = collectCustomerMessages(lead);
  const sellerMessages = sellerInsights.map((insight) => insight.text);

  const customerConcerns = detectConcernsFromMessages(customerMessages);
  const sellerConcerns = detectConcernsFromMessages(sellerMessages);
  const concerns = [...new Set([...customerConcerns, ...sellerConcerns])];

  const sellerLabels = sellerInsights.flatMap((insight) => insight.understoodLabels ?? []);
  const sellerPriorities = sellerInsights.flatMap((insight) => insight.priorities ?? []);

  const customerLabels = profile.understoodLabels?.length
    ? profile.understoodLabels
    : buildUnderstoodLabels(profile);

  const labels = mergeLabelLists(
    customerLabels,
    sellerLabels,
    concerns,
  );

  const customerEvolution = buildUnderstandingEvolution(
    profile.rawMessages?.length ? profile.rawMessages : customerMessages,
  );
  const sellerEvolution = buildSellerInsightEvolution(sellerInsights);
  const entwicklung = mergeUnderstandingEvolution(customerEvolution, sellerEvolution);

  const mergedProfile = buildEphemeralMergedProfile(profile, sellerInsights);

  const attributedLabels = buildAttributedWishChips(lead, customerLabels, sellerInsights);

  const verstaendnis = {
    labels,
    attributedLabels,
    concerns,
    openPoints: resolveOpenPoints(profile, lead),
    vehicles: resolveVehicles(mergedProfile, labels),
    priorities: [...new Set([...(profile.priorities ?? []), ...sellerPriorities])],
  };

  const gespraechseinstieg = buildGespraechseinstieg(verstaendnis, mergedProfile);
  const originalton = buildOriginalton(lead, profile.rawMessages?.length ? profile.rawMessages : customerMessages);

  const resolvedWorld = lead?.crm?.needProfile?.world
    ?? (mergedProfile.selectedModelKey
      ? CLEVER_WORLD.VEHICLE_CONSULTATION
      : CLEVER_WORLD.NEED_CONSULTATION);

  const latestSellerAt = sellerInsights.length
    ? sellerInsights[sellerInsights.length - 1].updatedAt
    : null;

  return {
    meta: {
      hasData: true,
      world: resolvedWorld,
      confidence: profile.confidence ?? 0,
      updatedAt: latestSellerAt ?? profile.updatedAt ?? lead?.updatedAt ?? null,
      source: resolveUnderstandingSource(lead),
      sellerInsightCount: sellerInsights.length,
    },
    verstaendnis,
    entwicklung,
    gespraechseinstieg,
    originalton,
  };
}
