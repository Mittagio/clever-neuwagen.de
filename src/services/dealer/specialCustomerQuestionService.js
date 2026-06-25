/**
 * Erkennung spezieller Kundenfragen (Zubehör, Nachrüstung, Transport …).
 */
import { LEXICON_MODEL_ENTRIES } from '../lexicon/cleverLexiconSearchService.js';

export const SPECIAL_QUESTION_CATEGORIES = [
  'Zubehör',
  'Nachrüstung',
  'Anhängerkupplung',
  'Transport',
  'Familie / Hund',
  'Ausstattung',
  'Räder / Reifen',
  'Sonstiges',
];

const CATEGORY_RULES = [
  { category: 'Anhängerkupplung', patterns: [/anhängerkupplung|\bahk\b|zuglast|kupplung\s*nach/i] },
  { category: 'Familie / Hund', patterns: [/hundebox|\bhund\b|kindersitz|isofix|familie|kinderwagen/i] },
  { category: 'Räder / Reifen', patterns: [/winterreifen|winterräder|sommerreifen|allwetter|felgen|reifen|\bräder\b/i] },
  { category: 'Transport', patterns: [/fahrradträger|dachträger|dachbox|dachgepäck|anhänger|transportbox|lastenträger/i] },
  { category: 'Zubehör', patterns: [/windabweiser|dachkoffer|fußmatte|schutz|spoiler|schweller|leiste|zubehör|dachbox/i] },
  { category: 'Nachrüstung', patterns: [/nachrüst|nachträglich|einbau|montier|retrofit|umbau/i] },
  { category: 'Ausstattung', patterns: [/sitzheizung|lenkradheizung|panoramadach|standheizung|klima|ausstattung/i] },
];

const SPECIAL_TOPIC_PATTERNS = [
  /windabweiser/i,
  /hundebox|\bhund\b/i,
  /fahrradträger|dachträger/i,
  /anhängerkupplung|\bahk\b/i,
  /dachbox|dachgepäck/i,
  /winterreifen|winterräder/i,
  /sitzheizung/i,
  /nachrüst|montier|einbau/i,
  /zubehör/i,
];

const QUESTION_START = /^(kann\s+(ich|man)|geht\s|passt\s|ist\s+.+\s+möglich|gibt\s+es|welche|wie\s+(groß|viel|viele)|dürfen\s+ich|könnte\s+ich)/i;

const TOPIC_LABELS = [
  { pattern: /windabweiser/i, label: 'Windabweiser' },
  { pattern: /hundebox/i, label: 'Hundebox' },
  { pattern: /\bhund\b/i, label: 'Hund' },
  { pattern: /fahrradträger/i, label: 'Fahrradträger' },
  { pattern: /anhängerkupplung|\bahk\b/i, label: 'Anhängerkupplung' },
  { pattern: /dachbox/i, label: 'Dachbox' },
  { pattern: /winterreifen|winterräder/i, label: 'Winterräder' },
  { pattern: /sitzheizung/i, label: 'Sitzheizung' },
];

export const SPECIAL_QUESTION_COPY = {
  headline: 'Gute Frage – das prüft Ihr Autohaus am besten.',
  text: 'Clever hat Ihre Frage vorgemerkt. Ein Verkäufer kann prüfen, was bei diesem Fahrzeug möglich ist.',
  altText: 'Bei Zubehör, Nachrüstung und Details ist Ihr Autohaus der sichere Ansprechpartner.',
  contactHeadline: 'Sollen wir das für Sie prüfen lassen?',
  contactCta: 'Verkäufer soll mich kontaktieren',
  dismissCta: 'Weiter ohne Kontakt',
  contactHint: 'Damit Ihr Verkäufer antworten kann, benötigen wir mindestens Telefon oder E-Mail.',
  knowledgeSource: 'Clever Wissen · geprüft',
};

function resolveModelFromQuery(query, fallback = {}) {
  for (const entry of LEXICON_MODEL_ENTRIES) {
    for (const pattern of entry.patterns) {
      if (pattern.test(query)) {
        return {
          modelKey: entry.modelKey,
          modelLabel: `${entry.brand} ${entry.model}`,
          brand: entry.brand,
        };
      }
    }
  }
  if (fallback.modelKey) {
    return {
      modelKey: fallback.modelKey,
      modelLabel: fallback.modelLabel ?? null,
      brand: fallback.brand ?? 'Kia',
    };
  }
  return null;
}

function inferCategory(rawText) {
  for (const rule of CATEGORY_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(rawText))) {
      return rule.category;
    }
  }
  return 'Sonstiges';
}

function hasSpecialTopic(rawText) {
  return SPECIAL_TOPIC_PATTERNS.some((pattern) => pattern.test(rawText));
}

function isQuestionForm(rawText) {
  return QUESTION_START.test(rawText.trim())
    || /\?\s*$/.test(rawText)
    || /^(kann|geht|passt|gibt|welche|ist|darf|könnte)/i.test(rawText.trim());
}

/**
 * @param {string} query
 * @param {{ modelKey?: string, modelLabel?: string, brand?: string }} [ctx]
 */
export function detectSpecialCustomerQuestion(query, ctx = {}) {
  const rawText = String(query ?? '').trim();
  if (rawText.length < 6) return null;

  const hasTopic = hasSpecialTopic(rawText);
  const accessoryContext = /montier|einbau|nachrüst|zubehör|pass|geht|möglich|kupplung|träger|box|reifen|heizung|wind|hund|dach/i.test(rawText);

  if (!hasTopic && !(isQuestionForm(rawText) && accessoryContext)) {
    return null;
  }

  const model = resolveModelFromQuery(rawText, ctx);
  const category = inferCategory(rawText);

  return {
    rawText,
    category,
    modelKey: model?.modelKey ?? ctx.modelKey ?? null,
    modelLabel: model?.modelLabel ?? ctx.modelLabel ?? null,
    status: 'needs_dealer_check',
    createdAt: new Date().toISOString(),
  };
}

export function isLikelySpecialDealerQuestion(query, ctx = {}) {
  if (detectSpecialCustomerQuestion(query, ctx)) return true;
  const rawText = String(query ?? '').trim();
  if (!isQuestionForm(rawText)) return false;
  return /montier|einbau|nachrüst|zubehör|pass|geht|möglich|kupplung|träger|box|reifen|heizung|wind|hund|dach/i.test(rawText);
}

export function buildFallbackSpecialQuestion(query, ctx = {}) {
  const detected = detectSpecialCustomerQuestion(query, ctx);
  if (detected) return detected;
  if (!isLikelySpecialDealerQuestion(query, ctx)) return null;
  return {
    rawText: String(query ?? '').trim(),
    category: inferCategory(query),
    modelKey: ctx.modelKey ?? null,
    modelLabel: ctx.modelLabel ?? null,
    status: 'needs_dealer_check',
    createdAt: new Date().toISOString(),
  };
}

export function shouldShowDealerCheckFlow(query, searchState, ctx = {}) {
  if (detectSpecialCustomerQuestion(query, ctx)) return true;
  if (!['not_found', 'unconfirmed'].includes(searchState?.type)) return false;
  return isLikelySpecialDealerQuestion(query, ctx);
}

export function extractSpecialQuestionTopic(rawText) {
  const text = String(rawText ?? '');
  for (const entry of TOPIC_LABELS) {
    if (entry.pattern.test(text)) return entry.label;
  }
  return null;
}

export function buildSpecialQuestionAkteChips(specialCustomerQuestion, options = {}) {
  if (!specialCustomerQuestion?.rawText) return [];
  const chips = ['Zubehörfrage'];
  const topic = extractSpecialQuestionTopic(specialCustomerQuestion.rawText);
  if (topic) chips.push(`${topic} prüfen`);
  if (options.contactRequested !== false) chips.push('Autohaus soll kontaktieren');
  if (options.answered && topic) chips.push(`Frage zu ${topic} beantwortet`);
  return chips;
}

export function buildKundenhelferNotesForSpecialQuestion(specialCustomerQuestion) {
  const topic = extractSpecialQuestionTopic(specialCustomerQuestion?.rawText);
  const parts = [
    'spezielle Frage vorhanden',
    specialCustomerQuestion?.category ? `${specialCustomerQuestion.category} prüfen` : null,
    topic ? `Frage zu ${topic}` : specialCustomerQuestion?.rawText,
  ].filter(Boolean);
  return parts.join(' · ');
}

export function validateSpecialQuestionContact({ phone = '', email = '' } = {}) {
  const hasPhone = Boolean(String(phone).trim());
  const hasEmail = Boolean(String(email).trim());
  if (hasPhone || hasEmail) {
    return { ok: true, message: null };
  }
  return {
    ok: false,
    message: SPECIAL_QUESTION_COPY.contactHint,
  };
}
