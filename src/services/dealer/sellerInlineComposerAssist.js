/**
 * Clever Inline Assistant – Live-Kundenkontext im Seller-Composer.
 * Deterministisch, grounded (verified facts). Keine zweite Kundenwahrheit.
 */
import { getVerifiedVehicleFacts } from '../clever/openai/tools/getVerifiedVehicleFacts.js';
import { formatHumanFactChip } from '../clever/openai/conversationFactDisplay.js';
import {
  buildAttributedWishChips,
  buildCustomerUnderstanding,
} from './customerUnderstanding.js';
import { filterNotepadChipsExcludingKonditionen } from '../customerAkte.js';
import {
  extractSellerFactsFromInput,
  detectSellerActionIntent,
  SELLER_ACTION_INTENTS,
} from './sellerActionIntent.js';
import { prepareSellerWorkspacePackage } from '../crm/sharedWorkspaceService.js';
import { buildCleverGreeting } from '../cleverAntworten.js';

export const INLINE_RESULT_TYPES = {
  FACT_SUGGESTION: 'fact_suggestion',
  MESSAGE_DRAFT: 'message_draft',
  CONTEXT_REMINDER: 'context_reminder',
  ACTION_DRAFT: 'action_draft',
  CONFLICT_WARNING: 'conflict_warning',
  MISSING_FACT: 'missing_fact',
};

const LOOKUP_TOPICS = [
  {
    id: 'towing_capacity',
    factKey: 'towingCapacity',
    patterns: [/anhängelast/i, /\btow/i, /\bziehen\b/i, /kupplung/i, /\bahk\b/i],
    needPatterns: [/ahk|anhänger|kupplung|zug/i],
  },
  {
    id: 'wltp_range',
    factKey: 'wltpRange',
    patterns: [/reichweite/i, /\bwltp\b/i, /\brange\b/i],
    needPatterns: [/reichweite|wltp|langstrecke/i],
  },
  {
    id: 'head_up_display',
    factKey: 'headUpDisplay',
    patterns: [/\bhud\b/i, /head-?\s*up/i, /headup/i],
    needPatterns: [/\bhud\b|head-?\s*up|anzeige/i],
  },
];

function customerDisplayName(lead = {}) {
  const raw = lead?.name
    || [lead?.firstName, lead?.lastName].filter(Boolean).join(' ')
    || lead?.contact?.name
    || '';
  return String(raw).trim() || 'der Kunde';
}

function buildInlineContextChips(lead = {}, sellerFacts = []) {
  const attributed = filterNotepadChipsExcludingKonditionen(
    buildAttributedWishChips(lead),
  );
  const customer = attributed
    .filter((c) => c.origin === 'customer')
    .slice(0, 6)
    .map((c) => ({ ...c, group: 'customer' }));
  const sellerFromAkte = attributed
    .filter((c) => c.origin === 'seller')
    .slice(0, 4)
    .map((c) => ({ ...c, group: 'seller' }));
  const sellerCurrent = (sellerFacts ?? []).map((f) => ({
    label: f.label,
    origin: 'seller',
    badge: null,
    group: 'seller_current',
    source: f.source ?? 'seller_input',
  }));
  return {
    customer,
    seller: [...sellerCurrent, ...sellerFromAkte],
  };
}

function buildInlineMessageDraft(lead = {}, sellerInput = '', sellerFacts = []) {
  const understanding = buildCustomerUnderstanding(lead);
  const labels = understanding?.verstaendnis?.labels ?? [];
  const name = customerDisplayName(lead);
  const greeting = buildCleverGreeting(name, lead?.salutation ?? null);
  const vehicleFact = sellerFacts.find((f) => f.key === 'vehicle');
  const colorFact = sellerFacts.find((f) => f.key === 'color');
  const availFact = sellerFacts.find((f) => f.key === 'availability');
  const preferredColor = labels.find((l) => /terracotta|farbe|blau|weiß|weiss|schwarz/i.test(l));
  const towWish = labels.find((l) => /ahk|anhänger|kupplung|zug/i.test(l));

  const paragraphs = [greeting.replace(/!$/, ',')];
  if (vehicleFact || colorFact || availFact) {
    const vehicleLine = [vehicleFact?.label, colorFact?.label, availFact?.label].filter(Boolean).join(' ');
    paragraphs.push(`ich hätte sogar einen ${vehicleLine}.`.replace(/\s+/g, ' ').trim());
  } else if (sellerInput) {
    paragraphs.push(`${sellerInput.trim().replace(/\.$/, '')}.`);
  }
  if (preferredColor && colorFact && !new RegExp(preferredColor.split(/\s+/)[0], 'i').test(colorFact.label)) {
    paragraphs.push(
      `Ursprünglich hatten Sie ${preferredColor.replace(/ interessiert| gewünscht| interessant/gi, '')} angefragt. `
      + `Falls ${colorFact.label} für Sie ebenfalls infrage kommt, könnte ich Ihnen das Fahrzeug direkt anbieten.`,
    );
  }
  if (towWish) {
    paragraphs.push(
      'Die Anhängerkupplung berücksichtige ich natürlich ebenfalls für Sie. '
      + 'Die genaue Anhängelast prüfe ich noch und gebe sie Ihnen verbindlich durch.',
    );
  }
  paragraphs.push('Soll ich Ihnen das Fahrzeug kurz vorstellen?');
  const sellerName = lead?.ownerName ?? 'Ihr Verkaufsteam';
  return {
    channel: 'preferred',
    subject: vehicleFact ? `${vehicleFact.label} für Sie` : 'Kurze Rückmeldung',
    body: `${paragraphs.filter(Boolean).join('\n\n')}\n\nViele Grüße\n${sellerName}`,
  };
}

function modelKeyFromLabel(label = '') {
  const m = String(label).match(/\b(EV[2-9]|Sportage|Sorento|Ceed|XCeed|Niro|Picanto)\b/i);
  if (!m) return null;
  return m[1].toLowerCase();
}

function modelKeyFromText(text = '') {
  const facts = extractSellerFactsFromInput(text);
  const vehicle = facts.find((f) => f.key === 'vehicle');
  if (vehicle) return modelKeyFromLabel(vehicle.label);
  const m = String(text).match(/\b(EV[2-9]|Sportage|Sorento|Ceed|XCeed|Niro|Picanto)\b/i);
  return m ? m[1].toLowerCase() : null;
}

function detectLookupTopics(text = '') {
  return LOOKUP_TOPICS.filter((topic) => topic.patterns.some((re) => re.test(text)));
}

function extractClaimedKg(text = '') {
  const m = String(text).match(/\b(\d{3,4})\s*(?:kg|kilo)/i)
    || String(text).match(/(?:zieht|ziehen|anhängelast|tow(?:ing)?)\s*(?:bis\s*(?:zu\s*)?)?(\d{3,4})/i);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

function hudLabel(value) {
  if (value === 'standard') return 'serienmäßig verfügbar';
  if (value === 'package') return 'im Paket verfügbar';
  return String(value);
}

function buildFactInsertSentence(factKey, value, modelLabel) {
  if (factKey === 'towingCapacity') {
    const n = Number(value);
    const kg = Number.isFinite(n) ? n.toLocaleString('de-DE') : value;
    return `Beim angebotenen ${modelLabel} liegt die Anhängelast bei bis zu ${kg} kg.`;
  }
  if (factKey === 'wltpRange') {
    const n = Number(value);
    const km = Number.isFinite(n) ? n.toLocaleString('de-DE') : value;
    return `Die WLTP-Reichweite des ${modelLabel} liegt bei bis zu ${km} km.`;
  }
  if (factKey === 'headUpDisplay') {
    return `Beim ${modelLabel} ist ein Head-up-Display ${hudLabel(value)}.`;
  }
  const human = formatHumanFactChip(factKey, value);
  return human?.chip
    ? `Zum ${modelLabel}: ${human.chip}.`
    : null;
}

/**
 * Kompakter Live-Kontext aus denselben Chips wie der Notizzettel.
 */
export function buildSellerInlineContext(lead = {}, draftText = '') {
  const sellerFacts = extractSellerFactsFromInput(draftText);
  const chips = buildInlineContextChips(lead, sellerFacts);
  const topics = detectLookupTopics(draftText);
  const modelKey = modelKeyFromText(draftText)
    || modelKeyFromLabel(chips.customer.find((c) => /EV\d|Sportage|Sorento/i.test(c.label))?.label);

  const relevantCustomer = chips.customer.filter((chip) => {
    if (!topics.length) return true;
    return topics.some((topic) => topic.needPatterns.some((re) => re.test(chip.label)));
  });

  const reminderChips = (relevantCustomer.length ? relevantCustomer : chips.customer).slice(0, 3);

  return {
    customerChips: chips.customer,
    sellerChips: chips.seller,
    reminderChips,
    sellerFacts,
    modelKey,
    topics,
    customerName: customerDisplayName(lead),
  };
}

function buildFactSuggestion({
  context,
  topic,
  fact,
  modelKey,
}) {
  const modelLabel = modelKey.toUpperCase().startsWith('EV')
    ? `Kia ${modelKey.toUpperCase()}`
    : `Kia ${modelKey}`;
  const human = formatHumanFactChip(fact.key, fact.value, fact.unit);
  const relatedNeed = context.customerChips.find((c) => (
    topic.needPatterns.some((re) => re.test(c.label))
  )) ?? null;

  let valueLabel = human?.chip ?? String(fact.value);
  if (fact.key === 'headUpDisplay') {
    valueLabel = `Head-up-Display: ${hudLabel(fact.value)}`;
  }

  return {
    type: INLINE_RESULT_TYPES.FACT_SUGGESTION,
    entity: topic.id,
    modelKey,
    factKey: fact.key,
    value: fact.value,
    unit: fact.unit,
    valueLabel,
    sourceStatus: 'verified',
    source: 'verified_vehicle_data',
    relatedCustomerNeed: relatedNeed?.label ?? null,
    title: '✨ Clever weiß',
    headline: modelLabel,
    body: valueLabel,
    hint: relatedNeed
      ? `${relatedNeed.label} ist ${context.customerName} wichtig.`
      : null,
    insertText: buildFactInsertSentence(fact.key, fact.value, modelLabel),
    primaryCta: 'In Nachricht übernehmen',
    secondaryCta: 'Antwort vorbereiten',
  };
}

function buildMissingFact(context, topic, modelKey) {
  const modelLabel = modelKey ? `Kia ${modelKey.toUpperCase()}` : 'dieses Fahrzeug';
  return {
    type: INLINE_RESULT_TYPES.MISSING_FACT,
    entity: topic.id,
    modelKey,
    sourceStatus: 'missing',
    title: '✨ Clever',
    body: `Dazu habe ich für ${modelLabel} noch keinen sicher verifizierten Wert.`,
    insertText: topic.id === 'towing_capacity'
      ? 'Die Anhängerkupplung ist für Sie wichtig. Die genaue Anhängelast prüfe ich Ihnen noch.'
      : null,
    primaryCta: 'Ohne Wert formulieren',
    secondaryCta: null,
  };
}

function buildConflictWarning({ claimed, verified, modelKey, context }) {
  const modelLabel = modelKey ? modelKey.toUpperCase() : 'Fahrzeug';
  return {
    type: INLINE_RESULT_TYPES.CONFLICT_WARNING,
    entity: 'towing_capacity',
    modelKey,
    claimed,
    verified,
    sourceStatus: 'verified',
    title: '⚠ Bitte prüfen',
    body: `Für den gewählten ${modelLabel} habe ich ${Number(verified).toLocaleString('de-DE')} kg verifiziert. Sie haben ${Number(claimed).toLocaleString('de-DE')} kg genannt.`,
    insertText: buildFactInsertSentence(
      'towingCapacity',
      verified,
      modelKey?.toUpperCase()?.startsWith('EV') ? `Kia ${modelKey.toUpperCase()}` : `Kia ${modelKey}`,
    ),
    relatedCustomerNeed: context.reminderChips.find((c) => /ahk|anhänger/i.test(c.label))?.label ?? null,
    primaryCta: `${Number(verified).toLocaleString('de-DE')} kg verwenden`,
    secondaryCta: 'Trotzdem bearbeiten',
  };
}

function buildContextReminder(context) {
  if (!context.reminderChips.length || !context.modelKey) return null;
  return {
    type: INLINE_RESULT_TYPES.CONTEXT_REMINDER,
    title: `✨ Kontext für ${context.customerName}`,
    chips: context.reminderChips.map((c) => ({
      label: c.label,
      source: c.source || (c.origin === 'seller' ? 'seller_input' : 'customer_need'),
    })),
    body: null,
    primaryCta: null,
  };
}

/**
 * Debounced Inline-Assist für den Seller-Composer.
 */
export function runSellerInlineAssist(lead = {}, draftText = '', options = {}) {
  const text = String(draftText ?? '').trim();
  if (!text || text.length < 3) {
    return { ok: false, results: [], context: buildSellerInlineContext(lead, '') };
  }

  const context = buildSellerInlineContext(lead, text);
  const intent = detectSellerActionIntent(text);
  const results = [];
  const topics = context.topics;
  const modelKey = context.modelKey;

  if (intent === SELLER_ACTION_INTENTS.REQUEST_DOCUMENTS || options.forceMode === 'act') {
    const pkg = prepareSellerWorkspacePackage(lead, text);
    results.push({
      type: INLINE_RESULT_TYPES.ACTION_DRAFT,
      title: '✨ Clever hat vorbereitet',
      body: pkg.body,
      actions: pkg.actions,
      draft: { body: pkg.body },
      primaryCta: 'Senden',
      secondaryCta: 'Bearbeiten',
    });
    return { ok: true, mode: 'act', results, context };
  }

  const claimedKg = extractClaimedKg(text);
  if (modelKey && (topics.some((t) => t.id === 'towing_capacity') || claimedKg != null)) {
    const verified = getVerifiedVehicleFacts({
      modelKey,
      requestedFacts: ['towingCapacity'],
    });
    const towFact = verified.facts?.find((f) => f.key === 'towingCapacity');
    if (claimedKg != null && towFact && Number(towFact.value) !== claimedKg) {
      results.push(buildConflictWarning({
        claimed: claimedKg,
        verified: towFact.value,
        modelKey,
        context,
      }));
      return { ok: true, mode: 'lookup', results, context };
    }
  }

  if (modelKey && topics.length) {
    const requestedFacts = topics.map((t) => t.factKey);
    const verified = getVerifiedVehicleFacts({ modelKey, requestedFacts });
    for (const topic of topics) {
      const fact = verified.facts?.find((f) => f.key === topic.factKey);
      if (fact) {
        results.push(buildFactSuggestion({
          context,
          topic,
          fact,
          modelKey,
        }));
      } else {
        results.push(buildMissingFact(context, topic, modelKey));
      }
    }
  }

  const isWrite = intent === SELLER_ACTION_INTENTS.MESSAGE_CUSTOMER
    || /\b(schreib|sag|informier|meld)\b/i.test(text)
    || options.forceMode === 'write';
  if (isWrite && text.length >= 12 && !topics.length) {
    const draft = buildInlineMessageDraft(lead, text, context.sellerFacts);
    results.push({
      type: INLINE_RESULT_TYPES.MESSAGE_DRAFT,
      title: '✨ Clever Vorschlag',
      body: draft.body,
      draft,
      factChips: [],
      primaryCta: 'Senden',
      secondaryCta: 'Bearbeiten',
    });
  }

  if (modelKey && context.reminderChips.length && !results.some((r) => (
    r.type === INLINE_RESULT_TYPES.MESSAGE_DRAFT
    || r.type === INLINE_RESULT_TYPES.ACTION_DRAFT
  ))) {
    const reminder = buildContextReminder(context);
    if (reminder && (topics.length || /EV\d|Sportage|Sorento/i.test(text))) {
      results.push(reminder);
    }
  }

  return {
    ok: results.length > 0,
    mode: results[0]?.type === INLINE_RESULT_TYPES.MESSAGE_DRAFT
      ? 'write'
      : results[0]?.type === INLINE_RESULT_TYPES.ACTION_DRAFT
        ? 'act'
        : 'lookup',
    results,
    context,
  };
}

/**
 * Fakt-Satz in bestehenden Draft einfügen (nicht alles ersetzen).
 */
export function insertInlineFactIntoDraft(draft = '', insertText = '') {
  const base = String(draft ?? '').trim();
  const add = String(insertText ?? '').trim();
  if (!add) return base;
  if (!base) return add;
  if (base.includes(add)) return base;
  let next = base;
  if (/Anhängelast/i.test(add)) {
    next = next.replace(/\b\d{3,4}\s*(?:kg|kilo)\b/gi, '').replace(/\s{2,}/g, ' ').trim();
  }
  if (/[.!?]$/.test(next)) return `${next}\n\n${add}`;
  return `${next}.\n\n${add}`;
}
