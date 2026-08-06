/**
 * Optional Intent-Chips für den Clever Composer.
 * One-Turn-Constraint für denselben runCleverSellerTurn – kein zweites Gehirn.
 *
 * UI-Hierarchie: eine Hauptzeile (Was soll Clever tun?) + optionale
 * kontextuelle Sekundäraktionen (keine permanente zweite Chip-Reihe).
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
  DOCUMENTS: 'request_documents',
  TRADE_IN: 'prepare_trade_in',
  /** Alias-kompatibel: Aufgabe / Wiedervorlage */
  FOLLOW_UP: 'create_follow_up',
};

export const COMPOSER_INTENT_CHIP_IDS = {
  AUTO: 'clever_decides',
  REMEMBER: 'merken',
  MESSAGE: 'nachricht',
  OFFER: 'angebot',
  APPOINTMENT: 'termin',
  SEARCH: 'suchen',
  DOCUMENTS: 'dokumente',
  TRADE_IN: 'inzahlungnahme',
  FOLLOW_UP: 'aufgabe',
};

/** Nachricht · konkreter Anlass */
export const COMPOSER_MESSAGE_PURPOSE = Object.freeze({
  FOLLOW_UP: 'follow_up',
  SEND_OFFER: 'send_offer',
  EXPLAIN_OFFER: 'explain_offer',
  DELIVERY_TIME: 'delivery_time',
  REQUEST_DOCS: 'request_documents',
  PROPOSE_APPOINTMENT: 'propose_appointment',
  FREE: 'free_message',
});

/** Merken · Kategorie-Absichtshilfe */
export const COMPOSER_MEMORY_CATEGORY = Object.freeze({
  CUSTOMER_INFO: 'customer_info',
  VEHICLE_WISH: 'vehicle_wish',
  BUDGET_TERMS: 'budget_terms',
  TRADE_IN: 'trade_in',
  EQUIPMENT: 'equipment',
  PERSONAL_NOTE: 'personal_note',
});

/** Angebot · Aktion */
export const COMPOSER_OFFER_ACTION = Object.freeze({
  NEW: 'new_offer',
  MODIFY: 'modify_existing',
  READ_PDF: 'read_pdf',
  COMPARE: 'compare_offers',
  ASSEMBLE: 'assemble_customer_offer',
});

/**
 * Hauptzeile (default): Clever | Merken | Nachricht | Angebot | (+ Mehr in UI)
 * @type {{ id: string, label: string, intentConstraint: string|null }[]}
 */
export const COMPOSER_INTENT_PRIMARY_CHIPS = [
  {
    id: COMPOSER_INTENT_CHIP_IDS.AUTO,
    label: 'Clever',
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
];

/**
 * Unter „Mehr“: Termin, Suchen, Dokumente, Inzahlungnahme, Aufgabe
 * @type {{ id: string, label: string, intentConstraint: string|null }[]}
 */
export const COMPOSER_INTENT_MORE_CHIPS = [
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
  {
    id: COMPOSER_INTENT_CHIP_IDS.DOCUMENTS,
    label: 'Dokumente',
    intentConstraint: COMPOSER_INTENT_CONSTRAINT.DOCUMENTS,
  },
  {
    id: COMPOSER_INTENT_CHIP_IDS.TRADE_IN,
    label: 'Inzahlungnahme',
    intentConstraint: COMPOSER_INTENT_CONSTRAINT.TRADE_IN,
  },
  {
    id: COMPOSER_INTENT_CHIP_IDS.FOLLOW_UP,
    label: 'Aufgabe / Wiedervorlage',
    intentConstraint: COMPOSER_INTENT_CONSTRAINT.FOLLOW_UP,
  },
];

/**
 * Alle Constraint-Chips (Lookup / Reset / Attachment).
 * @type {{ id: string, label: string, intentConstraint: string|null }[]}
 */
export const COMPOSER_INTENT_CHIPS = [
  ...COMPOSER_INTENT_PRIMARY_CHIPS,
  ...COMPOSER_INTENT_MORE_CHIPS,
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
 * Sichtbare Hauptzeile – feste Reihenfolge (Clever ist Standard, kein CTA-Umbau).
 * Clever | Merken | Nachricht | Angebot  (+ „Mehr“ in der UI)
 *
 * @param {string|null|undefined} [_selectedChipId]
 * @returns {{ id: string, label: string, intentConstraint: string|null }[]}
 */
export function resolveVisiblePrimaryIntentChips(_selectedChipId) {
  return [...COMPOSER_INTENT_PRIMARY_CHIPS];
}

/**
 * Desktop-Hover: nur Erklärung, kein Menü.
 * @param {string} chipId
 * @returns {string}
 */
export function resolveIntentChipTooltip(chipId) {
  switch (chipId) {
    case COMPOSER_INTENT_CHIP_IDS.AUTO:
      return 'Clever erkennt selbst, was du wissen oder erledigen möchtest.';
    case COMPOSER_INTENT_CHIP_IDS.REMEMBER:
      return 'Informationen über den Kunden strukturieren und in der Kundenakte speichern.';
    case COMPOSER_INTENT_CHIP_IDS.MESSAGE:
      return 'Eine Kundennachricht vorbereiten, ohne Kundenwissen zu verändern.';
    case COMPOSER_INTENT_CHIP_IDS.OFFER:
      return 'Ein Angebot erstellen, einlesen, vergleichen oder ändern.';
    case 'mehr':
      return 'Termin, Suche, Dokumente, Inzahlungnahme und Aufgaben.';
    case COMPOSER_INTENT_CHIP_IDS.APPOINTMENT:
      return 'Einen Terminvorschlag vorbereiten – ohne Auto-Buchung.';
    case COMPOSER_INTENT_CHIP_IDS.SEARCH:
      return 'In Akte, Nachrichten, Angeboten und Wissen nachschlagen.';
    case COMPOSER_INTENT_CHIP_IDS.DOCUMENTS:
      return 'Dokumente hochladen oder Unterlagen vorbereiten.';
    case COMPOSER_INTENT_CHIP_IDS.TRADE_IN:
      return 'Inzahlungnahme erfassen oder ergänzen.';
    case COMPOSER_INTENT_CHIP_IDS.FOLLOW_UP:
      return 'Aufgabe oder Wiedervorlage anlegen.';
    default:
      return '';
  }
}

/**
 * Mobile Kurz-Erklärung unter dem Composer (kein Hover).
 * @param {string|null|undefined} constraint
 * @param {{ purposeLabel?: string, customerName?: string }} [options]
 * @returns {string}
 */
export function resolveIntentModeHint(constraint, options = {}) {
  const name = String(options.customerName || '').trim() || 'den Kunden';
  const purposeLabel = String(options.purposeLabel || '').trim();
  const normalized = normalizeIntentConstraint(constraint);
  if (!normalized) {
    return 'Clever · Frei schreiben – Clever erkennt den Auftrag selbst.';
  }
  const chip = resolveIntentChipByConstraint(normalized);
  const head = purposeLabel
    ? `${chip.label} · ${purposeLabel}`
    : resolveIntentComposerLabels(normalized, name, { purposeLabel }).label;
  const body = resolveIntentChipTooltip(chip.id)
    || resolveIntentChipTooltip('mehr');
  return `${head}\n${body}`;
}

/**
 * Platzhalter je Chip / Untermodus – {Name} wird ersetzt.
 * @param {string|null|undefined} constraint
 * @param {string} [customerName]
 * @param {{ messagePurpose?: string, memoryCategory?: string, offerAction?: string, purposeId?: string }} [options]
 */
export function resolveIntentPlaceholder(constraint, customerName = '', options = {}) {
  const name = String(customerName || '').trim() || 'den Kunden';
  const normalized = normalizeIntentConstraint(constraint);
  const messagePurpose = options.messagePurpose || null;
  const memoryCategory = options.memoryCategory || null;
  const offerAction = options.offerAction || options.purposeId || null;

  if (normalized === COMPOSER_INTENT_CONSTRAINT.REMEMBER) {
    switch (memoryCategory) {
      case COMPOSER_MEMORY_CATEGORY.CUSTOMER_INFO:
        return 'Zum Beispiel: zwei Kinder, Hund, eigenes Haus …';
      case COMPOSER_MEMORY_CATEGORY.VEHICLE_WISH:
        return 'Zum Beispiel: Grau, Automatik, EV2 GT-Line …';
      case COMPOSER_MEMORY_CATEGORY.BUDGET_TERMS:
        return 'Zum Beispiel: maximal 300 €, 48 Monate, 15.000 km …';
      case COMPOSER_MEMORY_CATEGORY.TRADE_IN:
        return 'Welches Bestandsfahrzeug soll Clever erfassen?';
      case COMPOSER_MEMORY_CATEGORY.EQUIPMENT:
        return 'Zum Beispiel: AHK muss, Ladezeit wichtig, 800 V erforderlich …';
      case COMPOSER_MEMORY_CATEGORY.PERSONAL_NOTE:
        return 'Welche persönliche Notiz soll Clever merken?';
      default:
        return `Was soll Clever über ${name} merken?`;
    }
  }

  if (normalized === COMPOSER_INTENT_CONSTRAINT.MESSAGE) {
    switch (messagePurpose) {
      case COMPOSER_MESSAGE_PURPOSE.FOLLOW_UP:
        return `Was möchtest du ${name} noch mitgeben?`;
      case COMPOSER_MESSAGE_PURPOSE.SEND_OFFER:
        return `Wie soll Clever das Angebot an ${name} vorstellen?`;
      case COMPOSER_MESSAGE_PURPOSE.EXPLAIN_OFFER:
        return `Was soll Clever ${name} zum Angebot erklären?`;
      case COMPOSER_MESSAGE_PURPOSE.DELIVERY_TIME:
        return `Was soll Clever ${name} zur Lieferzeit schreiben?`;
      case COMPOSER_MESSAGE_PURPOSE.REQUEST_DOCS:
        return `Welche Unterlagen soll Clever bei ${name} anfordern?`;
      case COMPOSER_MESSAGE_PURPOSE.PROPOSE_APPOINTMENT:
        return `Welchen Termin soll Clever ${name} vorschlagen?`;
      case COMPOSER_MESSAGE_PURPOSE.FREE:
        return `Was möchtest du ${name} schreiben?`;
      default:
        return `Was möchtest du ${name} schreiben?`;
    }
  }

  if (normalized === COMPOSER_INTENT_CONSTRAINT.OFFER) {
    switch (offerAction) {
      case COMPOSER_OFFER_ACTION.NEW:
        return 'Welches Fahrzeug und welche Konditionen soll Clever vorbereiten?';
      case COMPOSER_OFFER_ACTION.MODIFY:
        return 'Was soll am aktuellen Angebot geändert werden?';
      case COMPOSER_OFFER_ACTION.READ_PDF:
        return 'PDF hochladen oder kurz sagen, was Clever damit tun soll.';
      case COMPOSER_OFFER_ACTION.COMPARE:
        return 'Welche Angebote soll Clever gegenüberstellen?';
      case COMPOSER_OFFER_ACTION.ASSEMBLE:
        return 'Was soll im Kundenangebot enthalten sein?';
      default:
        return `Welches Angebot soll Clever für ${name} vorbereiten oder ändern?`;
    }
  }

  switch (normalized) {
    case COMPOSER_INTENT_CONSTRAINT.APPOINTMENT:
      return `Welchen Termin soll Clever für ${name} vorschlagen?`;
    case COMPOSER_INTENT_CONSTRAINT.SEARCH:
      return 'Was soll Clever finden oder nachschlagen?';
    case COMPOSER_INTENT_CONSTRAINT.DOCUMENTS:
      return 'Dokument hochladen oder sagen, was Clever damit tun soll.';
    case COMPOSER_INTENT_CONSTRAINT.TRADE_IN:
      return 'Welches Fahrzeug soll Clever als Inzahlungnahme erfassen?';
    case COMPOSER_INTENT_CONSTRAINT.FOLLOW_UP:
      return 'Wann und warum soll Clever dich erinnern?';
    default:
      return null;
  }
}

/**
 * Modus-Label + Send-Label am Composer.
 * @param {string|null|undefined} constraint
 * @param {string} [customerName]
 * @param {{ purposeLabel?: string, messagePurpose?: string, memoryCategory?: string, offerAction?: string, offerLabel?: string }} [options]
 * @returns {{ label: string, hint?: string, sendLabel: string, sendAriaLabel: string }}
 */
export function resolveIntentComposerLabels(constraint, customerName = '', options = {}) {
  const name = String(customerName || '').trim() || 'den Kunden';
  const normalized = normalizeIntentConstraint(constraint);
  const purposeLabel = String(options.purposeLabel || '').trim();
  const offerLabel = String(options.offerLabel || '').trim();

  if (!normalized) {
    return {
      label: '',
      hint: 'Eingabe absenden – Clever schlägt vor …',
      sendLabel: '',
      sendAriaLabel: 'Clever ausführen',
    };
  }

  const modeWord = resolveIntentChipByConstraint(normalized).label;
  const forName = `Für ${name}`;
  const toName = `An ${name}`;

  if (normalized === COMPOSER_INTENT_CONSTRAINT.REMEMBER) {
    return {
      label: purposeLabel
        ? `Merken · ${purposeLabel}`
        : `Merken · ${forName}`,
      hint: purposeLabel ? forName : 'Kundeninformationen eintragen, diktieren oder einfügen.',
      sendLabel: `Für ${name} merken`,
      sendAriaLabel: `Für ${name} merken`,
    };
  }

  if (normalized === COMPOSER_INTENT_CONSTRAINT.MESSAGE) {
    return {
      label: purposeLabel
        ? `Nachricht · ${purposeLabel}`
        : `Nachricht · ${toName}`,
      hint: purposeLabel ? toName : `Was möchtest du ${name} schreiben?`,
      sendLabel: 'Entwurf erstellen',
      sendAriaLabel: 'Entwurf erstellen',
    };
  }

  if (normalized === COMPOSER_INTENT_CONSTRAINT.OFFER) {
    const modify = options.offerAction === COMPOSER_OFFER_ACTION.MODIFY;
    return {
      label: purposeLabel
        ? `Angebot · ${purposeLabel}`
        : `Angebot · ${forName}`,
      hint: offerLabel || (modify ? 'Aktuelles Angebot' : forName),
      sendLabel: modify ? 'Änderung vorbereiten' : 'Angebot vorbereiten',
      sendAriaLabel: modify ? 'Änderung vorbereiten' : 'Angebot vorbereiten',
    };
  }

  if (normalized === COMPOSER_INTENT_CONSTRAINT.APPOINTMENT) {
    return {
      label: `Termin · ${forName}`,
      hint: forName,
      sendLabel: 'Terminvorschlag vorbereiten',
      sendAriaLabel: 'Terminvorschlag vorbereiten',
    };
  }

  if (normalized === COMPOSER_INTENT_CONSTRAINT.SEARCH) {
    return {
      label: purposeLabel ? `Suchen · ${purposeLabel}` : `Suchen · ${name}`,
      hint: forName,
      sendLabel: 'Suche starten',
      sendAriaLabel: 'Suche starten',
    };
  }

  if (normalized === COMPOSER_INTENT_CONSTRAINT.DOCUMENTS) {
    return {
      label: `Dokumente · ${name}`,
      hint: forName,
      sendLabel: 'Unterlagen vorbereiten',
      sendAriaLabel: 'Unterlagen vorbereiten',
    };
  }

  if (normalized === COMPOSER_INTENT_CONSTRAINT.TRADE_IN) {
    return {
      label: `Inzahlungnahme · ${name}`,
      hint: forName,
      sendLabel: 'Inzahlungnahme vorbereiten',
      sendAriaLabel: 'Inzahlungnahme vorbereiten',
    };
  }

  if (normalized === COMPOSER_INTENT_CONSTRAINT.FOLLOW_UP) {
    return {
      label: `Aufgabe · ${forName}`,
      hint: forName,
      sendLabel: 'Wiedervorlage vorbereiten',
      sendAriaLabel: 'Wiedervorlage vorbereiten',
    };
  }

  return {
    label: modeWord,
    hint: '',
    sendLabel: '',
    sendAriaLabel: 'Clever ausführen',
  };
}

/**
 * Kontextuelle Quick Actions – eine Ebene unter dem Hauptmodus (kein Inline-Chip-Stapel).
 * @param {string|null|undefined} constraint
 * @param {{
 *   customerName?: string,
 *   missingDocuments?: boolean,
 *   hasOpenOffer?: boolean,
 *   hasOpenAppointment?: boolean,
 * }} [options]
 * @returns {{
 *   id: string,
 *   label: string,
 *   messagePurpose?: string,
 *   memoryCategory?: string,
 *   offerAction?: string,
 *   draftSeed?: string,
 * }[]}
 */
export function resolveIntentSecondaryActions(constraint, options = {}) {
  const name = String(options.customerName || '').trim() || 'den Kunden';
  const normalized = normalizeIntentConstraint(constraint);

  if (!normalized) {
    return [];
  }

  let actions = [];

  if (normalized === COMPOSER_INTENT_CONSTRAINT.REMEMBER) {
    actions = [
      {
        id: 'mem_customer',
        label: 'Kundeninfo',
        memoryCategory: COMPOSER_MEMORY_CATEGORY.CUSTOMER_INFO,
      },
      {
        id: 'mem_vehicle',
        label: 'Fahrzeugwunsch',
        memoryCategory: COMPOSER_MEMORY_CATEGORY.VEHICLE_WISH,
      },
      {
        id: 'mem_budget',
        label: 'Budget & Konditionen',
        memoryCategory: COMPOSER_MEMORY_CATEGORY.BUDGET_TERMS,
      },
      {
        id: 'mem_tradein',
        label: 'Bestandsfahrzeug / Inzahlungnahme',
        memoryCategory: COMPOSER_MEMORY_CATEGORY.TRADE_IN,
      },
      {
        id: 'mem_equip',
        label: 'Ausstattung & Technik',
        memoryCategory: COMPOSER_MEMORY_CATEGORY.EQUIPMENT,
      },
      {
        id: 'mem_note',
        label: 'Persönliche Notiz',
        memoryCategory: COMPOSER_MEMORY_CATEGORY.PERSONAL_NOTE,
      },
    ];
  } else if (normalized === COMPOSER_INTENT_CONSTRAINT.MESSAGE) {
    actions = [
      {
        id: 'msg_follow_up',
        label: 'Nachfassen',
        messagePurpose: COMPOSER_MESSAGE_PURPOSE.FOLLOW_UP,
      },
      {
        id: 'msg_send_offer',
        label: 'Angebot senden',
        messagePurpose: COMPOSER_MESSAGE_PURPOSE.SEND_OFFER,
      },
      {
        id: 'msg_explain_offer',
        label: 'Angebot erklären',
        messagePurpose: COMPOSER_MESSAGE_PURPOSE.EXPLAIN_OFFER,
      },
      {
        id: 'msg_delivery',
        label: 'Lieferzeit beantworten',
        messagePurpose: COMPOSER_MESSAGE_PURPOSE.DELIVERY_TIME,
      },
      {
        id: 'msg_docs',
        label: 'Unterlagen anfordern',
        messagePurpose: COMPOSER_MESSAGE_PURPOSE.REQUEST_DOCS,
        draftSeed: options.missingDocuments
          ? `Schreib ${name} wegen der fehlenden Unterlagen.`
          : undefined,
      },
      {
        id: 'msg_appointment',
        label: 'Termin vorschlagen',
        messagePurpose: COMPOSER_MESSAGE_PURPOSE.PROPOSE_APPOINTMENT,
      },
      {
        id: 'msg_free',
        label: 'Freie Nachricht',
        messagePurpose: COMPOSER_MESSAGE_PURPOSE.FREE,
      },
    ];
  } else if (normalized === COMPOSER_INTENT_CONSTRAINT.OFFER) {
    actions = [
      {
        id: 'offer_new',
        label: 'Neues Angebot',
        offerAction: COMPOSER_OFFER_ACTION.NEW,
      },
      {
        id: 'offer_change',
        label: 'Vorhandenes ändern',
        offerAction: COMPOSER_OFFER_ACTION.MODIFY,
      },
      {
        id: 'offer_pdf',
        label: 'PDF einlesen',
        offerAction: COMPOSER_OFFER_ACTION.READ_PDF,
      },
      {
        id: 'offer_compare',
        label: 'Angebote vergleichen',
        offerAction: COMPOSER_OFFER_ACTION.COMPARE,
      },
      {
        id: 'offer_assemble',
        label: 'Kundenangebot zusammenstellen',
        offerAction: COMPOSER_OFFER_ACTION.ASSEMBLE,
      },
    ];
  } else if (normalized === COMPOSER_INTENT_CONSTRAINT.APPOINTMENT
    || normalized === COMPOSER_INTENT_CONSTRAINT.SEARCH
    || normalized === COMPOSER_INTENT_CONSTRAINT.DOCUMENTS
    || normalized === COMPOSER_INTENT_CONSTRAINT.TRADE_IN
    || normalized === COMPOSER_INTENT_CONSTRAINT.FOLLOW_UP) {
    // Mehr-Untermodi: keine dritte Ebene – freie Composer-Eingabe
    return [];
  }

  return sortIntentQuickActions(actions, {
    constraint: normalized,
    missingDocuments: Boolean(options.missingDocuments),
    hasOpenOffer: Boolean(options.hasOpenOffer),
    hasOpenAppointment: Boolean(options.hasOpenAppointment),
  });
}

/**
 * Kontextuelle Sortierung der Quick Actions (nur bei echtem Kontext).
 * @param {object[]} actions
 * @param {{
 *   constraint?: string|null,
 *   missingDocuments?: boolean,
 *   hasOpenOffer?: boolean,
 *   hasOpenAppointment?: boolean,
 * }} [context]
 */
export function sortIntentQuickActions(actions = [], context = {}) {
  const list = Array.isArray(actions) ? [...actions] : [];
  if (!list.length) return list;

  const preferIds = [];
  if (context.constraint === COMPOSER_INTENT_CONSTRAINT.MESSAGE) {
    if (context.missingDocuments) {
      preferIds.push('msg_docs', 'msg_follow_up', 'msg_free');
    } else if (context.hasOpenOffer) {
      preferIds.push('msg_send_offer', 'msg_explain_offer', 'msg_follow_up');
    }
  }
  if (context.constraint === COMPOSER_INTENT_CONSTRAINT.OFFER && context.hasOpenOffer) {
    preferIds.push('offer_change', 'offer_pdf', 'offer_compare');
  }
  if (!preferIds.length) return list;

  const rank = new Map(preferIds.map((id, i) => [id, i]));
  return list.sort((a, b) => {
    const ra = rank.has(a.id) ? rank.get(a.id) : 1000;
    const rb = rank.has(b.id) ? rank.get(b.id) : 1000;
    if (ra !== rb) return ra - rb;
    return 0;
  });
}

/** @deprecated Alias – gleiche API wie resolveIntentSecondaryActions */
export function resolveIntentQuickActions(constraint, options = {}) {
  return resolveIntentSecondaryActions(constraint, options);
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

/** VEHICLE_INTEREST nur für eindeutige Präferenz-Felder (Farbe), nicht Modellwahl. */
const SAFE_REMEMBER_VEHICLE_INTEREST_FIELDS = new Set([
  'colorPreference',
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
    case COMPOSER_INTENT_CONSTRAINT.DOCUMENTS:
      return [SELLER_TURN_INTENTS.REQUEST_DOCUMENTS];
    case COMPOSER_INTENT_CONSTRAINT.TRADE_IN:
      return [SELLER_TURN_INTENTS.PREPARE_TRADE_IN];
    case COMPOSER_INTENT_CONSTRAINT.FOLLOW_UP:
      return [SELLER_TURN_INTENTS.PREPARE_CALLBACK];
    default:
      return [];
  }
}

/**
 * Wendet One-Turn-Constraint auf erkannte Intents an.
 * @param {object[]} intents
 * @param {string|null|undefined} constraint
 * @param {{ sellerInput?: string, messagePurpose?: string|null }} [options]
 * @returns {object[]}
 */
export function applyIntentConstraintToIntents(intents = [], constraint = null, options = {}) {
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
    // Purpose „Unterlagen anfordern“: Dokument-Intent zusätzlich, ohne Truth-Mutation
    if (options.messagePurpose === COMPOSER_MESSAGE_PURPOSE.REQUEST_DOCS) {
      pushIntent(next, SELLER_TURN_INTENTS.REQUEST_DOCUMENTS, 0.95);
    }
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

  if (normalized === COMPOSER_INTENT_CONSTRAINT.DOCUMENTS) {
    next = next.filter((i) => (
      i.type !== SELLER_TURN_INTENTS.PREPARE_OFFER
      && i.type !== SELLER_TURN_INTENTS.INBOUND_LEAD
      && i.type !== SELLER_TURN_INTENTS.UPDATE_CUSTOMER_CONTEXT
    ));
    pushIntent(next, SELLER_TURN_INTENTS.REQUEST_DOCUMENTS, 0.99);
    return next;
  }

  if (normalized === COMPOSER_INTENT_CONSTRAINT.TRADE_IN) {
    next = next.filter((i) => (
      i.type !== SELLER_TURN_INTENTS.PREPARE_OFFER
      && i.type !== SELLER_TURN_INTENTS.INBOUND_LEAD
      && i.type !== SELLER_TURN_INTENTS.DRAFT_MESSAGE
    ));
    pushIntent(next, SELLER_TURN_INTENTS.PREPARE_TRADE_IN, 0.99);
    return next;
  }

  if (normalized === COMPOSER_INTENT_CONSTRAINT.FOLLOW_UP) {
    next = next.filter((i) => (
      i.type !== SELLER_TURN_INTENTS.PREPARE_OFFER
      && i.type !== SELLER_TURN_INTENTS.INBOUND_LEAD
      && i.type !== SELLER_TURN_INTENTS.UPDATE_CUSTOMER_CONTEXT
    ));
    pushIntent(next, SELLER_TURN_INTENTS.PREPARE_CALLBACK, 0.99);
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
    const safeVehicleInterest = factClass === SELLER_FACT_CLASS.VEHICLE_INTEREST
      && SAFE_REMEMBER_VEHICLE_INTEREST_FIELDS.has(fact.field);
    if (!SAFE_REMEMBER_FACT_CLASSES.has(factClass) && !safeVehicleInterest) {
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
