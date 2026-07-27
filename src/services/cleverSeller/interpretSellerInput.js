/**
 * Deterministische Interpretation von Seller Universal Input.
 * Keine Persistenz – nur Extraktion + Intent-Ranking.
 */
import {
  SELLER_FACT_CLASS,
  SELLER_FACT_SOURCE,
  SELLER_INPUT_MODE,
  SELLER_TURN_INTENTS,
} from './sellerFactTypes.js';
import { createExtractedFact } from './cleverSellerTurnResultSchema.js';
import {
  SELLER_ACTION_INTENTS,
  detectSellerActionIntent,
  extractSellerFactsFromInput,
} from '../dealer/sellerActionIntent.js';

const MONTH_MAP = {
  januar: '01', jan: '01',
  februar: '02', feb: '02',
  märz: '03', maerz: '03', mar: '03',
  april: '04', apr: '04',
  mai: '05',
  juni: '06', jun: '06',
  juli: '07', jul: '07',
  august: '08', aug: '08',
  september: '09', sep: '09', sept: '09',
  oktober: '10', okt: '10',
  november: '11', nov: '11',
  dezember: '12', dez: '12',
};

function pushFact(list, fact) {
  if (!fact?.label) return;
  const key = `${fact.factClass}:${fact.field}:${String(fact.label).toLowerCase()}`;
  if (list.some((f) => `${f.factClass}:${f.field}:${String(f.label).toLowerCase()}` === key)) {
    return;
  }
  list.push(fact);
}

function parseMonthYear(text = '') {
  const t = String(text);
  const numeric = t.match(/\b(0?[1-9]|1[0-2])[./](20\d{2})\b/);
  if (numeric) {
    return `${numeric[2]}-${String(numeric[1]).padStart(2, '0')}`;
  }
  const short = t.match(/\b(0?[1-9]|1[0-2])\/(\d{2})\b/);
  if (short) {
    return `20${short[2]}-${String(short[1]).padStart(2, '0')}`;
  }
  const named = t.match(
    /\b(januar|jan|februar|feb|märz|maerz|mar|april|apr|mai|juni|jun|juli|jul|august|aug|september|sep|sept|oktober|okt|november|nov|dezember|dez)\.?\s*(20\d{2}|\d{2})\b/i,
  );
  if (named) {
    const month = MONTH_MAP[named[1].toLowerCase()];
    let year = named[2];
    if (year.length === 2) year = `20${year}`;
    return `${year}-${month}`;
  }
  return null;
}

/**
 * Multi-Fact Extraktion aus natürlichem Seller-Input.
 * @param {string} text
 */
export function extractUniversalSellerFacts(text = '') {
  const raw = String(text ?? '');
  const t = raw.replace(/\s+/g, ' ').trim();
  const facts = [];
  if (!t) return facts;

  // Self-disclosure / finance
  const net = t.match(/\b(?:netto|nettoeinkommen|einkommen)\s*(?:ca\.?\s*)?(\d{1,2}(?:[.\s]\d{3})*|\d{3,5})\b/i)
    || t.match(/\b(\d{3,5})\s*(?:€|euro)?\s*netto\b/i);
  if (net) {
    const value = Number(String(net[1]).replace(/[.\s]/g, ''));
    pushFact(facts, createExtractedFact({
      factClass: SELLER_FACT_CLASS.SELF_DISCLOSURE_FACT,
      field: 'monthlyNetIncome',
      value,
      label: `Netto ${value.toLocaleString('de-DE')} €`,
      confidence: 0.95,
    }));
  }

  if (/\bverheiratet\b/i.test(t)) {
    pushFact(facts, createExtractedFact({
      factClass: SELLER_FACT_CLASS.CUSTOMER_FACT,
      field: 'maritalStatus',
      value: 'married',
      label: 'verheiratet',
      confidence: 0.98,
    }));
  }
  if (/\bledig\b/i.test(t)) {
    pushFact(facts, createExtractedFact({
      factClass: SELLER_FACT_CLASS.CUSTOMER_FACT,
      field: 'maritalStatus',
      value: 'single',
      label: 'ledig',
      confidence: 0.95,
    }));
  }

  const children = t.match(/\b(\d)\s*kinder?\b/i) || t.match(/\bzwei\s*kinder\b/i);
  if (children) {
    const value = /zwei/i.test(children[0]) ? 2 : Number(children[1]);
    pushFact(facts, createExtractedFact({
      factClass: SELLER_FACT_CLASS.CUSTOMER_FACT,
      field: 'childrenCount',
      value,
      label: `${value} Kinder`,
      confidence: 0.97,
    }));
  }

  // Trade-in / existing vehicle
  const tradeIn = /\b(in\s*zahlung|inzahlungnahme|nehmen wir in zahlung|nehmen wir mit)\b/i.test(t);
  if (tradeIn) {
    pushFact(facts, createExtractedFact({
      factClass: SELLER_FACT_CLASS.TRADE_IN_FACT,
      field: 'tradeInRequested',
      value: true,
      label: 'Inzahlungnahme gewünscht',
      confidence: 0.96,
    }));
  }

  const existing = t.match(/\b(ford|vw|volkswagen|opel|bmw|audi|mercedes|toyota|hyundai|kia|skoda|seat|renault|peugeot)\s+([a-z0-9-]{2,20})\b/i);
  if (existing && !/\b(kia)\s+(ev[2-9]|sportage|sorento|ceed|niro|picanto)\b/i.test(existing[0])) {
    const make = existing[1].replace(/^\w/, (c) => c.toUpperCase());
    const model = existing[2].replace(/^\w/, (c) => c.toUpperCase());
    pushFact(facts, createExtractedFact({
      factClass: SELLER_FACT_CLASS.EXISTING_VEHICLE,
      field: 'existingVehicle',
      value: { make, model },
      label: `${make} ${model}`,
      confidence: 0.9,
    }));
  }

  // Contract end
  if (/\bleasing\b/i.test(t) && (/\b(auslauf|läuft|laeuft|ende|bis)\b/i.test(t) || parseMonthYear(t))) {
    const endDate = parseMonthYear(t);
    pushFact(facts, createExtractedFact({
      factClass: SELLER_FACT_CLASS.CONTRACT_FACT,
      field: 'existingContractEnd',
      value: endDate ? { type: 'leasing', endDate } : { type: 'leasing' },
      label: endDate ? `Leasingende ${endDate}` : 'Leasingvertrag vorhanden',
      confidence: endDate ? 0.93 : 0.8,
      needsConfirmation: !endDate,
    }));
  }

  // Wunschrate / commercial
  const budget = t.match(/\b(\d{2,4})\s*(?:€|euro)?\s*(?:wunsch)?rate\b/i)
    || t.match(/\bwunschrate\s*(?:ca\.?\s*)?(\d{2,4})\b/i)
    || (/\bwunschrate\b/i.test(t) ? t.match(/\b(\d{2,4})\s*(?:€|euro)\b/i) : null);
  if (budget) {
    const value = Number(budget[1]);
    pushFact(facts, createExtractedFact({
      factClass: SELLER_FACT_CLASS.COMMERCIAL_PREFERENCE,
      field: 'monthlyBudget',
      value,
      label: `${value} € Wunschrate`,
      confidence: 0.92,
    }));
  } else if (/\b(\d{2,4})\s*(?:€|euro)\b/i.test(t) && !net && !/\b(rabatt|sonderrabatt|%\b)/i.test(t)) {
    const lone = t.match(/\b(\d{2,4})\s*(?:€|euro)\b/i);
    if (lone && !/\banzahlung|az\b/i.test(t)) {
      pushFact(facts, createExtractedFact({
        factClass: SELLER_FACT_CLASS.COMMERCIAL_PREFERENCE,
        field: 'monthlyBudget',
        value: Number(lone[1]),
        label: `${lone[1]} €`,
        confidence: 0.55,
        needsConfirmation: true,
      }));
    }
  }

  // Vehicle interest (new Kia)
  const interest = t.match(/\b(EV[2-9]|Sportage|Sorento|Ceed|XCeed|Niro|Picanto)\b(?:\s+(GT-Line|Spirit|Earth|Vision|Air|DriveWise))?/i);
  if (interest) {
    const model = interest[1].toUpperCase().replace(/^EV/, 'EV');
    const trim = interest[2] || null;
    const label = trim ? `${model} ${trim}` : model;
    pushFact(facts, createExtractedFact({
      factClass: SELLER_FACT_CLASS.VEHICLE_INTEREST,
      field: 'vehicleInterest',
      value: { modelKey: interest[1].toLowerCase(), trim },
      label,
      confidence: 0.95,
    }));
  }

  // Ambiguous multi interest
  if (/\bev3\s+oder\s+ev5\b/i.test(t) || /\bev5\s+oder\s+ev3\b/i.test(t)) {
    pushFact(facts, createExtractedFact({
      factClass: SELLER_FACT_CLASS.VEHICLE_INTEREST,
      field: 'vehicleInterestMulti',
      value: ['ev3', 'ev5'],
      label: 'EV3 oder EV5',
      confidence: 0.9,
      needsConfirmation: false,
    }));
  }

  const color = t.match(/\b(schwarzmetallic|schwarz|weiß|weiss|terracotta|blau|grau|silber|rot|grün|gruen)\b/i);
  if (color && interest) {
    pushFact(facts, createExtractedFact({
      factClass: SELLER_FACT_CLASS.VEHICLE_INTEREST,
      field: 'colorPreference',
      value: color[1],
      label: color[1],
      confidence: 0.88,
    }));
  }

  if (/\bahk\b|anhängerkupplung|anhaengerkupplung/i.test(t) && /\bwichtig|braucht|mit\b/i.test(t)) {
    pushFact(facts, createExtractedFact({
      factClass: SELLER_FACT_CLASS.VEHICLE_REQUIREMENT,
      field: 'towHitchRequired',
      value: true,
      label: 'AHK wichtig',
      confidence: 0.94,
    }));
  }

  // Offer instructions
  const discount = t.match(/\b(\d{1,2})\s*(?:%|prozent)\s*(?:sonder)?rabatt\b/i)
    || t.match(/\b(\d{1,2})\s*%\b/)
    || t.match(/\b(\d{1,2})\s*prozent\b/i);
  if (discount && (/\brabatt|angebot|erstell|mach|sonder/i.test(t) || Number(discount[1]) >= 10)) {
    pushFact(facts, createExtractedFact({
      factClass: SELLER_FACT_CLASS.OFFER_INSTRUCTION,
      field: 'discountPercent',
      value: Number(discount[1]),
      label: `${discount[1]} % Rabatt`,
      confidence: 0.9,
    }));
  }

  const WORD_MONTHS = {
    einem: 1, eine: 1, zwei: 2, drei: 3, vier: 4, fünf: 5, fuenf: 5,
    sechs: 6, sieben: 7, acht: 8, neun: 9, zehn: 10, elf: 11, zwölf: 12, zwoelf: 12,
  };
  const delivery = t.match(/\b(?:lieferzeit|lieferbar)\s*(?:ca\.?\s*|circa\.?\s*)?(\d{1,2})\s*monate?\b/i)
    || t.match(/\bin\s*(?:ca\.?\s*)?(\d{1,2})\s*monaten?\b/i)
    || t.match(/\blieferzeit\s+(?:ca\.?\s*|circa\.?\s*)?(einem|eine|zwei|drei|vier|fünf|fuenf|sechs|sieben|acht|neun|zehn|elf|zwölf|zwoelf)\s+monate?\b/i);
  if (delivery) {
    const raw = delivery[1];
    const months = WORD_MONTHS[String(raw).toLowerCase()] ?? Number(raw);
    if (months) {
      pushFact(facts, createExtractedFact({
        factClass: SELLER_FACT_CLASS.OFFER_INSTRUCTION,
        field: 'deliveryEstimateMonths',
        value: { value: months, unit: 'months', approximate: true },
        label: `Lieferzeit ca. ${months} Monate`,
        confidence: 0.85,
      }));
    }
  }

  // Mileage correction
  const km = t.match(/\b(\d{1,2}(?:\.\d{3})?|\d{4,6})\s*(?:tkm|km)\b/i)
    || t.match(/\bdoch\s+(\d{4,6})\s*km\b/i);
  if (km) {
    const value = Number(String(km[1]).replace(/\./g, '')) * (/tkm/i.test(km[0]) && Number(km[1]) < 100 ? 1000 : 1);
    const normalized = value < 1000 ? value * 1000 : value;
    pushFact(facts, createExtractedFact({
      factClass: SELLER_FACT_CLASS.COMMERCIAL_PREFERENCE,
      field: 'annualMileage',
      value: normalized,
      label: `${normalized.toLocaleString('de-DE')} km`,
      confidence: /\bdoch\b|statt/i.test(t) ? 0.95 : 0.88,
    }));
  }

  // Document request hint
  if (/\bfahrzeugschein|gehaltsnachweis|ausweis|selbstauskunft|unterlagen?\b/i.test(t)
    && /\b(frag|anforder|fehl|brauch|schick)\b/i.test(t)) {
    pushFact(facts, createExtractedFact({
      factClass: SELLER_FACT_CLASS.DOCUMENT_FACT,
      field: 'documentRequest',
      value: true,
      label: 'Unterlage anfordern',
      confidence: 0.9,
    }));
  }

  // Legacy seller facts (vehicle/rate/discount) as seller_fact fallback labels
  for (const legacy of extractSellerFactsFromInput(t)) {
    if (facts.some((f) => f.label === legacy.label)) continue;
    pushFact(facts, createExtractedFact({
      factClass: SELLER_FACT_CLASS.SELLER_FACT,
      field: legacy.key,
      value: legacy.value ?? legacy.label,
      label: legacy.label,
      source: SELLER_FACT_SOURCE.SELLER_INPUT,
      confidence: 0.8,
    }));
  }

  return facts;
}

/**
 * Multi-Intent Detection (kein Single-Intent-Zwang).
 * @param {string} text
 * @param {object[]} facts
 */
export function detectSellerTurnIntents(text = '', facts = []) {
  const t = String(text ?? '').trim();
  const intents = [];
  const add = (intent, confidence = 0.8) => {
    if (!intents.some((i) => i.type === intent)) {
      intents.push({ type: intent, confidence });
    }
  };

  const hasContextFacts = facts.some((f) => [
    SELLER_FACT_CLASS.CUSTOMER_FACT,
    SELLER_FACT_CLASS.SELF_DISCLOSURE_FACT,
    SELLER_FACT_CLASS.EXISTING_VEHICLE,
    SELLER_FACT_CLASS.CONTRACT_FACT,
    SELLER_FACT_CLASS.COMMERCIAL_PREFERENCE,
    SELLER_FACT_CLASS.VEHICLE_INTEREST,
    SELLER_FACT_CLASS.TRADE_IN_FACT,
  ].includes(f.factClass));

  const primary = detectSellerActionIntent(t);
  const map = {
    [SELLER_ACTION_INTENTS.PREPARE_OFFER]: SELLER_TURN_INTENTS.PREPARE_OFFER,
    [SELLER_ACTION_INTENTS.MESSAGE_CUSTOMER]: SELLER_TURN_INTENTS.DRAFT_MESSAGE,
    [SELLER_ACTION_INTENTS.REQUEST_DOCUMENTS]: SELLER_TURN_INTENTS.REQUEST_DOCUMENTS,
    [SELLER_ACTION_INTENTS.PROPOSE_APPOINTMENT]: SELLER_TURN_INTENTS.PROPOSE_APPOINTMENT,
    [SELLER_ACTION_INTENTS.PREPARE_CALLBACK]: SELLER_TURN_INTENTS.PREPARE_CALLBACK,
    [SELLER_ACTION_INTENTS.ADD_NOTE]: SELLER_TURN_INTENTS.ADD_NOTE,
    [SELLER_ACTION_INTENTS.LOOKUP_FACT]: SELLER_TURN_INTENTS.LOOKUP_VEHICLE_FACT,
  };
  // Multi-Fact-Arbeitsinput ist kein default Message-Draft
  if (map[primary]) {
    const skipMessageDefault = primary === SELLER_ACTION_INTENTS.MESSAGE_CUSTOMER && hasContextFacts;
    if (!skipMessageDefault) add(map[primary], 0.85);
  }

  if (hasContextFacts) add(SELLER_TURN_INTENTS.UPDATE_CUSTOMER_CONTEXT, 0.95);

  if (facts.some((f) => f.factClass === SELLER_FACT_CLASS.TRADE_IN_FACT)) {
    add(SELLER_TURN_INTENTS.PREPARE_TRADE_IN, 0.92);
  }
  if (facts.some((f) => f.factClass === SELLER_FACT_CLASS.DOCUMENT_FACT)) {
    add(SELLER_TURN_INTENTS.REQUEST_DOCUMENTS, 0.9);
  }
  if (facts.some((f) => f.factClass === SELLER_FACT_CLASS.OFFER_INSTRUCTION)
    || /\b(angebot|erstell|mach).{0,40}\b(angebot|ev\d)/i.test(t)) {
    add(SELLER_TURN_INTENTS.PREPARE_OFFER, 0.9);
  }

  if (!intents.length) add(SELLER_TURN_INTENTS.UNKNOWN, 0.4);
  return intents.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Message vs Work Mode.
 * @param {string} text
 * @param {object[]} intents
 * @param {object[]} [facts]
 */
export function resolveSellerInputMode(text = '', intents = [], facts = []) {
  const t = String(text ?? '');
  const workHeavy = intents.some((i) => [
    SELLER_TURN_INTENTS.UPDATE_CUSTOMER_CONTEXT,
    SELLER_TURN_INTENTS.PREPARE_TRADE_IN,
    SELLER_TURN_INTENTS.PREPARE_OFFER,
    SELLER_TURN_INTENTS.REQUEST_DOCUMENTS,
    SELLER_TURN_INTENTS.LOOKUP_VEHICLE_FACT,
  ].includes(i.type)) || facts.length >= 3;

  const explicitMessage = /\b(schreib|sag|informier|whatsapp|mail|schick ihm|schick ihr)\b/i.test(t);
  const messageLike = explicitMessage
    || intents.some((i) => i.type === SELLER_TURN_INTENTS.DRAFT_MESSAGE);

  if (workHeavy && explicitMessage) return SELLER_INPUT_MODE.AMBIGUOUS;
  if (workHeavy) return SELLER_INPUT_MODE.CLEVER_WORK_INPUT;
  if (messageLike) return SELLER_INPUT_MODE.CUSTOMER_MESSAGE;
  if (/\n/.test(String(text)) || (text.match(/,/g) || []).length >= 2) {
    return SELLER_INPUT_MODE.CLEVER_WORK_INPUT;
  }
  return SELLER_INPUT_MODE.CLEVER_WORK_INPUT;
}

/**
 * @param {string} sellerInput
 * @param {{ attachments?: object[] }} [options]
 */
export function interpretSellerInput(sellerInput = '', options = {}) {
  const raw = String(sellerInput ?? '');
  const normalized = raw.replace(/\r\n/g, '\n').trim();
  const facts = extractUniversalSellerFacts(normalized);
  const intents = detectSellerTurnIntents(normalized, facts);
  const inputMode = resolveSellerInputMode(normalized, intents, facts);
  const attachmentTypes = (options.attachments ?? [])
    .map((a) => a?.mimeType || a?.type || a?.kind)
    .filter(Boolean);

  return {
    raw,
    normalized,
    facts,
    intents,
    inputMode,
    attachmentTypes,
    confidence: facts.length
      ? Math.min(0.99, facts.reduce((s, f) => s + (f.confidence || 0), 0) / facts.length)
      : (intents[0]?.confidence ?? 0.4),
  };
}
