/**
 * Optional Intent-Chips für den Clever Composer.
 * One-Turn-Constraint für denselben runCleverSellerTurn – kein zweites Gehirn.
 */
import { SELLER_FACT_CLASS, SELLER_TURN_INTENTS } from './sellerFactTypes.js';

/** Chip / Constraint-IDs (API-stabil) */
export const COMPOSER_INTENT_CONSTRAINT = {
  AUTO: null,
  REMEMBER: 'remember_customer_information',
  MESSAGE: 'draft_customer_message',
  OFFER: 'prepare_or_modify_offer',
  APPOINTMENT: 'propose_appointment',
  SEARCH: 'search_or_knowledge_lookup',
};

export const COMPOSER_INTENT_CHIP_IDS = {
  AUTO: 'clever_decides',
  REMEMBER: 'merken',
  MESSAGE: 'nachricht',
  OFFER: 'angebot',
  APPOINTMENT: 'termin',
  SEARCH: 'suchen',
};

/**
 * UI-Chips (horizontal scroll). Default = Clever entscheidet (kein Constraint).
 * @type {{ id: string, label: string, intentConstraint: string|null }[]}
 */
export const COMPOSER_INTENT_CHIPS = [
  {
    id: COMPOSER_INTENT_CHIP_IDS.AUTO,
    label: 'Clever entscheidet',
    intentConstraint: COMPOSER_INTENT_CONSTRAINT.AUTO,
  },
  {
    id: COMPOSER_INTENT_CHIP_IDS.REMEMBER,
    label: 'Merken',
    intentConstraint: COMPOSER_INTENT_CONSTRAINT.REMEMBER,
  },
  {
    id: COMPOSER_INTENT_CHIP_IDS.MESSAGE,
    label: 'Nachricht',
    intentConstraint: COMPOSER_INTENT_CONSTRAINT.MESSAGE,
  },
  {
    id: COMPOSER_INTENT_CHIP_IDS.OFFER,
    label: 'Angebot',
    intentConstraint: COMPOSER_INTENT_CONSTRAINT.OFFER,
  },
  {
    id: COMPOSER_INTENT_CHIP_IDS.APPOINTMENT,
    label: 'Termin',
    intentConstraint: COMPOSER_INTENT_CONSTRAINT.APPOINTMENT,
  },
  {
    id: COMPOSER_INTENT_CHIP_IDS.SEARCH,
    label: 'Suchen',
    intentConstraint: COMPOSER_INTENT_CONSTRAINT.SEARCH,
  },
];

const VALID_CONSTRAINTS = new Set(
  COMPOSER_INTENT_CHIPS
    .map((c) => c.intentConstraint)
    .filter((v) => v != null),
);

/**
 * @param {string|null|undefined} constraint
 * @returns {string|null}
 */
export function normalizeIntentConstraint(constraint) {
  if (constraint == null || constraint === '' || constraint === 'auto'
    || constraint === COMPOSER_INTENT_CHIP_IDS.AUTO) {
    return null;
  }
  const value = String(constraint).trim();
  if (!VALID_CONSTRAINTS.has(value)) return null;
  return value;
}

/**
 * @param {string|null|undefined} constraint
 * @returns {{ id: string, label: string, intentConstraint: string|null }}
 */
export function resolveIntentChipByConstraint(constraint) {
  const normalized = normalizeIntentConstraint(constraint);
  return COMPOSER_INTENT_CHIPS.find((c) => c.intentConstraint === normalized)
    || COMPOSER_INTENT_CHIPS[0];
}

/**
 * @param {string} chipId
 * @returns {{ id: string, label: string, intentConstraint: string|null }}
 */
export function resolveIntentChipById(chipId) {
  return COMPOSER_INTENT_CHIPS.find((c) => c.id === chipId)
    || COMPOSER_INTENT_CHIPS[0];
}

/**
 * Platzhalter je Chip – {Name} wird ersetzt.
 * @param {string|null|undefined} constraint
 * @param {string} [customerName]
 */
export function resolveIntentPlaceholder(constraint, customerName = '') {
  const name = String(customerName || '').trim() || 'den Kunden';
  const normalized = normalizeIntentConstraint(constraint);
  switch (normalized) {
    case COMPOSER_INTENT_CONSTRAINT.REMEMBER:
      return `Was soll Clever über ${name} merken?`;
    case COMPOSER_INTENT_CONSTRAINT.MESSAGE:
      return `Was möchtest du ${name} schreiben?`;
    case COMPOSER_INTENT_CONSTRAINT.OFFER:
      return `Was soll am Angebot für ${name} geändert werden?`;
    case COMPOSER_INTENT_CONSTRAINT.APPOINTMENT:
      return `Welchen Termin soll Clever für ${name} vorschlagen?`;
    case COMPOSER_INTENT_CONSTRAINT.SEARCH:
      return `Was soll Clever zu ${name} nachschlagen?`;
    default:
      return null;
  }
}

/** Intents, die „Merken“ nie auslösen darf */
const REMEMBER_BLOCKED = new Set([
  SELLER_TURN_INTENTS.DRAFT_MESSAGE,
  SELLER_TURN_INTENTS.DRAFT_CUSTOMER_MESSAGE,
  SELLER_TURN_INTENTS.PREPARE_OFFER,
  SELLER_TURN_INTENTS.PROPOSE_APPOINTMENT,
  SELLER_TURN_INTENTS.PREPARE_CALLBACK,
  SELLER_TURN_INTENTS.LOOKUP_VEHICLE_FACT,
  SELLER_TURN_INTENTS.SEARCH_CUSTOMER_HISTORY,
  SELLER_TURN_INTENTS.SEARCH_CUSTOMER_MESSAGES,
  SELLER_TURN_INTENTS.SEARCH_CUSTOMER_OFFERS,
  SELLER_TURN_INTENTS.SEARCH_CUSTOMER_ACTIVITIES,
  SELLER_TURN_INTENTS.GET_TODAY_OVERVIEW,
  SELLER_TURN_INTENTS.SEND_PORTFOLIO,
  SELLER_TURN_INTENTS.REQUEST_DOCUMENTS,
  SELLER_TURN_INTENTS.INBOUND_LEAD,
  SELLER_TURN_INTENTS.CUSTOMER_REPLY,
  SELLER_TURN_INTENTS.IMPORT_CUSTOMER_CONTRACT,
  SELLER_TURN_INTENTS.COMPARE_CONTRACT_WITH_OFFER,
]);

/** Intents, die „Nachricht“ nie auslösen darf (keine Truth-Mutation) */
const MESSAGE_BLOCKED = new Set([
  SELLER_TURN_INTENTS.UPDATE_CUSTOMER_CONTEXT,
  SELLER_TURN_INTENTS.PREPARE_OFFER,
  SELLER_TURN_INTENTS.PROPOSE_APPOINTMENT,
  SELLER_TURN_INTENTS.PREPARE_TRADE_IN,
  SELLER_TURN_INTENTS.IMPORT_CUSTOMER_CONTRACT,
  SELLER_TURN_INTENTS.INBOUND_LEAD,
]);

/** Intents, die „Suchen“ nie auslösen darf */
const SEARCH_BLOCKED = new Set([
  SELLER_TURN_INTENTS.UPDATE_CUSTOMER_CONTEXT,
  SELLER_TURN_INTENTS.DRAFT_MESSAGE,
  SELLER_TURN_INTENTS.DRAFT_CUSTOMER_MESSAGE,
  SELLER_TURN_INTENTS.PREPARE_OFFER,
  SELLER_TURN_INTENTS.PROPOSE_APPOINTMENT,
  SELLER_TURN_INTENTS.PREPARE_TRADE_IN,
  SELLER_TURN_INTENTS.IMPORT_CUSTOMER_CONTRACT,
  SELLER_TURN_INTENTS.INBOUND_LEAD,
  SELLER_TURN_INTENTS.CUSTOMER_REPLY,
]);

const SAFE_REMEMBER_FACT_CLASSES = new Set([
  SELLER_FACT_CLASS.CUSTOMER_FACT,
  SELLER_FACT_CLASS.CUSTOMER_NEED,
  SELLER_FACT_CLASS.SELLER_NOTE,
  SELLER_FACT_CLASS.SELLER_FACT,
  SELLER_FACT_CLASS.VEHICLE_REQUIREMENT,
]);

const SENSITIVE_REMEMBER_FACT_CLASSES = new Set([
  SELLER_FACT_CLASS.SELF_DISCLOSURE_FACT,
  SELLER_FACT_CLASS.FINANCE_FACT,
  SELLER_FACT_CLASS.COMMERCIAL_PREFERENCE,
  SELLER_FACT_CLASS.CONTRACT_FACT,
  SELLER_FACT_CLASS.TRADE_IN_FACT,
  SELLER_FACT_CLASS.EXISTING_VEHICLE,
  SELLER_FACT_CLASS.APPOINTMENT_FACT,
  SELLER_FACT_CLASS.DOCUMENT_FACT,
  SELLER_FACT_CLASS.OFFER_INSTRUCTION,
  SELLER_FACT_CLASS.MESSAGE_INSTRUCTION,
  SELLER_FACT_CLASS.PROCESS_INSTRUCTION,
]);

const SAFE_REMEMBER_MIN_CONFIDENCE = 0.9;

function pushIntent(intents, type, confidence = 0.99) {
  if (!intents.some((i) => i.type === type)) {
    intents.push({ type, confidence });
  }
}

/**
 * Mappt Constraint → Ziel-Intents (SELLER_TURN_INTENTS).
 * @param {string|null|undefined} constraint
 * @returns {string[]}
 */
export function mapIntentConstraintToTurnIntentTypes(constraint) {
  switch (normalizeIntentConstraint(constraint)) {
    case COMPOSER_INTENT_CONSTRAINT.REMEMBER:
      return [SELLER_TURN_INTENTS.UPDATE_CUSTOMER_CONTEXT];
    case COMPOSER_INTENT_CONSTRAINT.MESSAGE:
      return [
        SELLER_TURN_INTENTS.DRAFT_MESSAGE,
        SELLER_TURN_INTENTS.DRAFT_CUSTOMER_MESSAGE,
      ];
    case COMPOSER_INTENT_CONSTRAINT.OFFER:
      return [SELLER_TURN_INTENTS.PREPARE_OFFER];
    case COMPOSER_INTENT_CONSTRAINT.APPOINTMENT:
      return [
        SELLER_TURN_INTENTS.PROPOSE_APPOINTMENT,
        SELLER_TURN_INTENTS.RESOLVE_CUSTOMER_CONTEXT,
        SELLER_TURN_INTENTS.RESOLVE_RELATIVE_DATETIME,
      ];
    case COMPOSER_INTENT_CONSTRAINT.SEARCH:
      return [
        SELLER_TURN_INTENTS.SEARCH_CUSTOMER_HISTORY,
        SELLER_TURN_INTENTS.SEARCH_CUSTOMER_MESSAGES,
        SELLER_TURN_INTENTS.SEARCH_CUSTOMER_OFFERS,
        SELLER_TURN_INTENTS.SEARCH_CUSTOMER_ACTIVITIES,
        SELLER_TURN_INTENTS.LOOKUP_VEHICLE_FACT,
        SELLER_TURN_INTENTS.FIND_CUSTOMER,
        SELLER_TURN_INTENTS.SUMMARIZE_CUSTOMER_CONTEXT,
        SELLER_TURN_INTENTS.SEARCH_CUSTOMER_CONTRACTS,
        SELLER_TURN_INTENTS.GET_TODAY_OVERVIEW,
      ];
    default:
      return [];
  }
}

/**
 * Wendet One-Turn-Constraint auf erkannte Intents an.
 * @param {object[]} intents
 * @param {string|null|undefined} constraint
 * @param {{ sellerInput?: string }} [options]
 * @returns {object[]}
 */
export function applyIntentConstraintToIntents(intents = [], constraint = null, options = {}) {
  void options;
  const normalized = normalizeIntentConstraint(constraint);
  if (!normalized) return Array.isArray(intents) ? [...intents] : [];

  let next = Array.isArray(intents) ? [...intents] : [];

  if (normalized === COMPOSER_INTENT_CONSTRAINT.REMEMBER) {
    next = next.filter((i) => !REMEMBER_BLOCKED.has(i.type));
    pushIntent(next, SELLER_TURN_INTENTS.UPDATE_CUSTOMER_CONTEXT, 0.99);
    return next;
  }

  if (normalized === COMPOSER_INTENT_CONSTRAINT.MESSAGE) {
    next = next.filter((i) => !MESSAGE_BLOCKED.has(i.type));
    pushIntent(next, SELLER_TURN_INTENTS.DRAFT_MESSAGE, 0.99);
    return next;
  }

  if (normalized === COMPOSER_INTENT_CONSTRAINT.OFFER) {
    next = next.filter((i) => (
      i.type !== SELLER_TURN_INTENTS.PROPOSE_APPOINTMENT
      && i.type !== SELLER_TURN_INTENTS.PREPARE_CALLBACK
      && i.type !== SELLER_TURN_INTENTS.INBOUND_LEAD
    ));
    pushIntent(next, SELLER_TURN_INTENTS.PREPARE_OFFER, 0.99);
    return next;
  }

  if (normalized === COMPOSER_INTENT_CONSTRAINT.APPOINTMENT) {
    next = next.filter((i) => (
      i.type !== SELLER_TURN_INTENTS.PREPARE_OFFER
      && i.type !== SELLER_TURN_INTENTS.INBOUND_LEAD
      && i.type !== SELLER_TURN_INTENTS.IMPORT_CUSTOMER_CONTRACT
    ));
    pushIntent(next, SELLER_TURN_INTENTS.PROPOSE_APPOINTMENT, 0.99);
    pushIntent(next, SELLER_TURN_INTENTS.RESOLVE_CUSTOMER_CONTEXT, 0.95);
    pushIntent(next, SELLER_TURN_INTENTS.RESOLVE_RELATIVE_DATETIME, 0.95);
    return next;
  }

  if (normalized === COMPOSER_INTENT_CONSTRAINT.SEARCH) {
    next = next.filter((i) => !SEARCH_BLOCKED.has(i.type));
    const searchTypes = mapIntentConstraintToTurnIntentTypes(normalized);
    const hasSearch = next.some((i) => searchTypes.includes(i.type));
    if (!hasSearch) {
      pushIntent(next, SELLER_TURN_INTENTS.SEARCH_CUSTOMER_HISTORY, 0.95);
      pushIntent(next, SELLER_TURN_INTENTS.LOOKUP_VEHICLE_FACT, 0.9);
    }
    return next;
  }

  return next;
}

/**
 * Prüft, ob Merken-Facts sicher auto-speicherbar sind.
 * @param {object[]} facts
 * @param {object} [lead]
 * @returns {{ mode: 'save_with_undo'|'review', reason: string, safeFacts: object[], reviewFacts: object[] }}
 */
export function evaluateRememberDecision(facts = [], lead = {}) {
  const list = Array.isArray(facts) ? facts.filter(Boolean) : [];
  if (!list.length) {
    return {
      mode: 'review',
      reason: 'no_facts',
      safeFacts: [],
      reviewFacts: [],
    };
  }

  const labels = new Set(
    (lead?.crm?.needProfile?.understoodLabels || []).map((l) => String(l).toLowerCase()),
  );
  const insightTexts = (lead?.crm?.sellerInsights || [])
    .map((i) => String(i?.text || '').toLowerCase())
    .filter(Boolean);

  const safeFacts = [];
  const reviewFacts = [];
  let reason = 'safe';

  for (const fact of list) {
    const confidence = Number(fact.confidence ?? 0);
    const factClass = fact.factClass;
    const label = String(fact.label || '').toLowerCase();

    if (fact.needsConfirmation) {
      reviewFacts.push(fact);
      reason = 'needs_confirmation';
      continue;
    }
    if (SENSITIVE_REMEMBER_FACT_CLASSES.has(factClass)) {
      reviewFacts.push(fact);
      reason = 'sensitive_or_business_critical';
      continue;
    }
    if (!SAFE_REMEMBER_FACT_CLASSES.has(factClass)) {
      reviewFacts.push(fact);
      reason = 'unsupported_fact_class';
      continue;
    }
    if (confidence < SAFE_REMEMBER_MIN_CONFIDENCE) {
      reviewFacts.push(fact);
      reason = 'low_confidence';
      continue;
    }
    // Widerspruch zu bekannten Labels / Insights
    if (label && (
      (fact.field === 'childrenCount' && [...labels].some((l) => /\bkinder\b/.test(l) && !l.includes(String(fact.value))))
      || insightTexts.some((t) => t.includes(label) === false && conflictingHouseholdHint(t, fact))
    )) {
      reviewFacts.push(fact);
      reason = 'contradictory';
      continue;
    }
    safeFacts.push(fact);
  }

  if (reviewFacts.length) {
    return {
      mode: 'review',
      reason,
      safeFacts,
      reviewFacts,
    };
  }

  return {
    mode: 'save_with_undo',
    reason: 'safe_unambiguous',
    safeFacts,
    reviewFacts: [],
  };
}

function conflictingHouseholdHint(insightText, fact) {
  if (fact.field !== 'childrenCount' || fact.value == null) return false;
  const m = String(insightText).match(/(\d+)\s*kinder/i);
  if (!m) return false;
  return Number(m[1]) !== Number(fact.value);
}

/**
 * Filtert Facts für Merken-Constraint (keine Message-/Offer-/Termin-Instruktionen).
 * @param {object[]} facts
 * @param {string|null|undefined} constraint
 */
export function filterFactsForIntentConstraint(facts = [], constraint = null) {
  const normalized = normalizeIntentConstraint(constraint);
  if (normalized !== COMPOSER_INTENT_CONSTRAINT.REMEMBER) {
    return Array.isArray(facts) ? [...facts] : [];
  }
  return (facts || []).filter((f) => (
    f
    && f.factClass !== SELLER_FACT_CLASS.MESSAGE_INSTRUCTION
    && f.factClass !== SELLER_FACT_CLASS.OFFER_INSTRUCTION
    && f.factClass !== SELLER_FACT_CLASS.PROCESS_INSTRUCTION
    && f.factClass !== SELLER_FACT_CLASS.APPOINTMENT_FACT
    && f.factClass !== SELLER_FACT_CLASS.VEHICLE_FACT_REQUEST
  ));
}

/**
 * Attachment-Klassifikation → kontextuelle Aktionsvorschläge (UI-Stub / Review).
 * Nutzt bestehende PDF-Kinds; Fahrzeugschein = Heuristik über Dateiname/Text.
 *
 * @param {{ kind?: string, fileName?: string, extractedText?: string, sourceType?: string }} attachment
 * @returns {{ classification: string, confidence: number, suggestedActions: object[], needsReview: boolean }}
 */
export function resolveAttachmentIntentActions(attachment = {}) {
  const kind = attachment.kind || attachment.sourceType || '';
  const fileName = String(attachment.fileName || attachment.name || '').toLowerCase();
  const text = String(attachment.extractedText || attachment.text || '').toLowerCase();

  if (kind === 'contract_pdf' || kind === 'contract_pdf_ocr'
    || /\b(vertrag|altvertrag|leasingvertrag|finanzierungsvertrag)\b/.test(fileName)) {
    return {
      classification: 'altvertrag',
      confidence: kind === 'contract_pdf' || kind === 'contract_pdf_ocr' ? 0.92 : 0.78,
      suggestedActions: [
        {
          id: 'import_customer_contract',
          label: 'Altvertrag übernehmen',
          intentConstraint: COMPOSER_INTENT_CONSTRAINT.REMEMBER,
          path: 'import_customer_contract',
        },
      ],
      needsReview: true,
      preselect: true,
    };
  }

  if (kind === 'configurator_pdf'
    || /\b(leasingangebot|kaufangebot|angebot|konfigurator)\b/.test(fileName)
    || /\b(monatsrate|leasingangebot)\b/.test(text)) {
    return {
      classification: 'offer_pdf',
      confidence: kind === 'configurator_pdf' ? 0.9 : 0.75,
      suggestedActions: [
        {
          id: 'prepare_or_modify_offer',
          label: 'Als Angebot nutzen',
          intentConstraint: COMPOSER_INTENT_CONSTRAINT.OFFER,
          path: 'prepare_offer',
        },
      ],
      needsReview: true,
      preselect: kind === 'configurator_pdf',
    };
  }

  if (/\b(fahrzeugschein|zulassungsbescheinigung|brief)\b/.test(fileName)
    || /\b(fahrzeugschein|zulassungsbescheinigung\s*teil)\b/.test(text)) {
    return {
      classification: 'fahrzeugschein',
      confidence: 0.8,
      suggestedActions: [
        {
          id: 'remember_trade_in_docs',
          label: 'Fahrzeugschein merken',
          intentConstraint: COMPOSER_INTENT_CONSTRAINT.REMEMBER,
          path: 'trade_in_registration',
        },
      ],
      needsReview: true,
      preselect: true,
    };
  }

  return {
    classification: 'unknown',
    confidence: 0.4,
    suggestedActions: [],
    needsReview: true,
    preselect: false,
  };
}

/**
 * Default-Chip nach Turn (Apply / Discard / Undo / Erfolg).
 * @returns {{ id: string, label: string, intentConstraint: null }}
 */
export function resetIntentConstraintToDefault() {
  return COMPOSER_INTENT_CHIPS[0];
}
