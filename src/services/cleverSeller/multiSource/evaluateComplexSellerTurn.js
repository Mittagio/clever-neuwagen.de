/**
 * Complexity Router: wann ein Seller-Turn OpenAI (Multi-Source) braucht.
 * Kein manuell wählbarer Modus – nur Heuristik. Flag/API-Key prüft der Caller.
 */
import { shouldBuildMultiSourceIntake } from './buildMultiSourceIntake.js';
import {
  extractTradeInCandidates,
  hasTradeInCue,
} from '../detectTradeInFromSellerInput.js';
import { isCustomerContractIntakeText } from '../extractCustomerContractFromText.js';
import { isNumberBoundToMileage } from '../normalizeSellerUnits.js';

const WISH_RE = /\b(?:ev\s*\d|sportage|xceed|ceed|niro|sorento|ahk|\bair\b|vision|gt[-\s]?line)\b/i;
const ABGLEICH_RE = /\babgleich\b|\baltvertrag\b|\bvertrag\s*\+\s*dump\b|\bmulti[-\s]?source\b/i;
const NAME_LINE_RE = /^[A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+){1,2}$/m;

function hasContractAttachment(attachments = []) {
  return (attachments || []).some((a) => (
    a?.kind === 'contract_pdf'
    || a?.sourceType === 'contract_pdf'
    || a?.sourceType === 'contract_pdf_ocr'
    || /vertrag|contract|finanz|leasing|bank/i.test(a?.fileName || '')
  ));
}

function hasAnyAttachment(attachments = []) {
  return Array.isArray(attachments) && attachments.length > 0;
}

function isMultiLineDump(text = '') {
  const lines = String(text || '').replace(/\r\n/g, '\n').split('\n').map((l) => l.trim()).filter(Boolean);
  return lines.length >= 4;
}

function hasStrongUnitAmbiguity(text = '', facts = []) {
  const raw = String(text || '');
  const pricedFact = (facts || []).find((f) => f.field === 'purchasePrice');
  if (pricedFact && isNumberBoundToMileage(raw, Number(pricedFact.value))) {
    return true;
  }
  const vehicleHits = (raw.match(/\b(?:kia|ford|vw|bmw|ev\s*\d|picanto|sportage|xceed|niro)\b/gi) || []).length;
  const hasTrade = hasTradeInCue(raw);
  const hasWish = WISH_RE.test(raw);
  if (vehicleHits >= 3 && hasTrade && hasWish && !/\bgw\b/i.test(raw)) {
    return true;
  }
  return false;
}

function countDomainIntents(text = '', facts = []) {
  let n = 0;
  if (WISH_RE.test(text) || facts.some((f) => f.factClass === 'vehicle_interest')) n += 1;
  if (hasTradeInCue(text) || facts.some((f) => f.field === 'tradeInVehicle')) n += 1;
  if (/\b\d{1,2}\s*kinder\b|\bhaus\b/i.test(text) || facts.some((f) => f.field === 'childrenCount')) n += 1;
  if (/\b\d+\s*(?:monate?|km)\b|\b\d{1,3}\s+\d{1,3}(?:\.\d{3})?\s*km\b/i.test(text)
    || facts.some((f) => f.field === 'termMonths' || f.field === 'annualMileage')) n += 1;
  if (isCustomerContractIntakeText(text) || /\bvertrag\b/i.test(text)) n += 1;
  return n;
}

/**
 * @param {{
 *   sellerInput?: string,
 *   attachments?: object[],
 *   facts?: object[],
 *   interpreted?: object,
 *   appContext?: object,
 *   workingContext?: object|object[],
 * }} params
 * @returns {{
 *   isComplex: boolean,
 *   reason: string|null,
 *   path: 'multi_source'|null,
 *   complexityReasons: string[],
 * }}
 */
export function evaluateComplexSellerTurn(params = {}) {
  const text = String(
    params.sellerInput
    ?? params.interpreted?.normalized
    ?? params.interpreted?.raw
    ?? '',
  ).trim();
  const attachments = Array.isArray(params.attachments) ? params.attachments : [];
  const working = params.workingContext
    ?? params.appContext?.attachedWorkingObjects
    ?? [];
  const workingItems = Array.isArray(working) ? working : (working ? [working] : []);
  const allAttachments = [
    ...attachments,
    ...workingItems.filter((w) => w?.extractedText || /contract|pdf|vertrag/i.test(w?.kind || w?.type || '')),
  ];

  const facts = Array.isArray(params.facts)
    ? params.facts
    : (params.interpreted?.facts || []);

  /** @type {string[]} */
  const complexityReasons = [];

  if (text.length < 8 && !hasAnyAttachment(allAttachments)) {
    return {
      isComplex: false,
      reason: null,
      path: null,
      complexityReasons: [],
    };
  }

  if (hasAnyAttachment(allAttachments)) complexityReasons.push('attachment');
  if (hasContractAttachment(allAttachments) || isCustomerContractIntakeText(text)) {
    complexityReasons.push('document_contract');
  }
  if (hasTradeInCue(text) || extractTradeInCandidates(text).length > 0) {
    complexityReasons.push('trade_in');
  }
  if (NAME_LINE_RE.test(text) && WISH_RE.test(text)) {
    complexityReasons.push('customer_candidate');
  }
  if (countDomainIntents(text, facts) >= 2) {
    complexityReasons.push('multi_intent');
  }
  if (
    hasContractAttachment(allAttachments)
    || /\baltvertrag\b|\bvertrag\s+liegt\b|\bhistorisch\b/i.test(text)
  ) {
    complexityReasons.push('historical_contract');
  }
  if (isMultiLineDump(text)) complexityReasons.push('multi_source_dump');
  if (hasStrongUnitAmbiguity(text, facts) || (params.interpreted?.inputMode === 'ambiguous')) {
    complexityReasons.push('ambiguities');
  }
  if (
    facts.some((f) => f.field === 'purchasePrice' && isNumberBoundToMileage(text, Number(f.value)))
    || (extractTradeInCandidates(text).length && facts.some((f) => (
      f.factClass === 'vehicle_interest'
      && extractTradeInCandidates(text).some((t) => (
        String(f.label || '').toLowerCase().includes(String(t.model || '').toLowerCase())
      ))
    )))
  ) {
    complexityReasons.push('contradictory_types');
  }

  if (shouldBuildMultiSourceIntake({ sellerInput: text, attachments: allAttachments, facts })) {
    if (!complexityReasons.includes('multi_source_dump')) complexityReasons.push('multi_source_dump');
    return {
      isComplex: true,
      reason: 'multi_source',
      path: 'multi_source',
      complexityReasons: unique(complexityReasons),
    };
  }

  const hasTrade = complexityReasons.includes('trade_in');
  const hasWish = WISH_RE.test(text) || facts.some((f) => f.factClass === 'vehicle_interest');
  const contractAtt = hasContractAttachment(allAttachments);
  const contractText = isCustomerContractIntakeText(text);
  const abgleich = ABGLEICH_RE.test(text);

  if (hasTrade && (contractAtt || contractText)) {
    return {
      isComplex: true,
      reason: 'trade_in_with_contract',
      path: 'multi_source',
      complexityReasons: unique(complexityReasons),
    };
  }
  if (abgleich && (hasWish || hasTrade || contractAtt || contractText)) {
    return {
      isComplex: true,
      reason: 'abgleich_cue',
      path: 'multi_source',
      complexityReasons: unique(complexityReasons),
    };
  }
  if (hasWish && hasTrade && hasAnyAttachment(allAttachments)) {
    return {
      isComplex: true,
      reason: 'wish_tradein_attachment',
      path: 'multi_source',
      complexityReasons: unique(complexityReasons),
    };
  }
  if (complexityReasons.includes('ambiguities') || complexityReasons.includes('contradictory_types')) {
    return {
      isComplex: true,
      reason: complexityReasons.includes('contradictory_types')
        ? 'contradictory_types'
        : 'ambiguous_units',
      path: 'multi_source',
      complexityReasons: unique(complexityReasons),
    };
  }

  // Mehrere starke Signale ohne klassischen Multi-Source-Trigger
  if (complexityReasons.length >= 3 && (hasWish || hasTrade || contractAtt)) {
    return {
      isComplex: true,
      reason: 'multi_signal',
      path: 'multi_source',
      complexityReasons: unique(complexityReasons),
    };
  }

  return {
    isComplex: false,
    reason: null,
    path: null,
    complexityReasons: [],
  };
}

/**
 * Composer-Einstieg: Semantic Interpreter ja/nein (ohne Flag-Prüfung).
 */
export function shouldUseSemanticInterpreter(params = {}) {
  const complexity = evaluateComplexSellerTurn(params);
  return {
    use: complexity.isComplex,
    path: complexity.path,
    reason: complexity.reason,
    complexityReasons: complexity.complexityReasons,
  };
}

/**
 * Ob der Turn serverseitig / async interpretiert werden soll (UI-Routing).
 * Flag separat prüfen.
 */
export function shouldRouteComplexSellerTurnToServer(params = {}, clientFlagEnabled = false) {
  if (!clientFlagEnabled) return false;
  return evaluateComplexSellerTurn(params).isComplex;
}

function unique(list = []) {
  return [...new Set(list)];
}
