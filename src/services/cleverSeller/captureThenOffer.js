/**
 * Capture then Offer — Produktgesetz.
 * Dump zuerst → Akte; Angebotstool danach; keine Web-/Katalog-Raten als Wahrheit.
 *
 * @see docs/CLEVER_CAPTURE_THEN_OFFER.md
 */

import { isBareOrGenericOfferCue, isBatchOfferCue } from './commercialOfferNl.js';
import { SELLER_FACT_CLASS, SELLER_TURN_INTENTS } from './sellerFactTypes.js';

/** Rate-Autorität für Monatsraten / Budgets */
export const RATE_AUTHORITY = Object.freeze({
  /** Verkäufer / PDF / Bank / Händlerkalkulation im Offer-Kontext */
  AUTHORITATIVE: 'authoritative',
  /** Wunsch-Budget in der Akte – keine Offer-Rate */
  WISH_ONLY: 'wish_only',
  /** Katalog, Web-Spanne, Advisory, baseLeasingRate, Schätzung */
  NON_AUTHORITATIVE: 'non_authoritative',
  /** Identity gewechselt – Rate prüfen */
  STALE: 'stale',
});

const WISH_BUDGET_LABEL_RE = /\b(max\.?|maximal|höchstens|bis|budget|wunsch(?:rate)?|ca\.?|circa|ungefähr|etwa)\b/i;

const OFFER_RATE_FIELDS = new Set([
  'monthlyLeasingRate',
  'monthlyRate',
  'calculatedRate',
]);

const BUDGET_FIELDS = new Set([
  'monthlyBudget',
  'desiredRate',
]);

/**
 * Explizites Angebots-Cue (nicht nur Konditions-Dump).
 * @param {string} text
 */
export function isExplicitOfferCue(text = '') {
  const t = String(text || '').trim();
  if (!t) return false;
  if (isBatchOfferCue(t) || isBareOrGenericOfferCue(t)) return true;
  return /(?:^|[^\wäöüÄÖÜß])(?:erstell(?:e|en)?|mach(?:e|en)?)\s+(?:herrn?\s+|frau\s+|\w+\s+)?(?:ein\s+)?(?:leasing)?angebot\b/i.test(t)
    || /\bein\s+(?:leasing)?angebot\s+(?:für|über)\b/i.test(t)
    || /(?:erstell(?:e|en)?|mach(?:e|en)?)\b.{0,60}\b(?:ein\s+)?[\wÄÖÜäöüß-]+-?angebot\b/i.test(t)
    || (
      /\b(ev\s*[2-9]|sportage|sorento|ceed|xceed|niro|picanto)\b/i.test(t)
      && /\b(?:angebot|entwurf)\b/i.test(t)
      && !/\b(schreib|sag(?:e|en)?\s+ihm|mail\b|nachricht|whatsapp)\b/i.test(t)
    );
}

/**
 * Fact ist Wunsch-Budget (Akte), keine belastbare Offer-Rate.
 * @param {object} fact
 */
export function isWishBudgetFact(fact = {}) {
  if (!fact || !BUDGET_FIELDS.has(fact.field)) return false;
  if (fact.rateAuthority === RATE_AUTHORITY.WISH_ONLY) return true;
  if (fact.rateAuthority === RATE_AUTHORITY.NON_AUTHORITATIVE) return true;
  const label = String(fact.label || '');
  if (WISH_BUDGET_LABEL_RE.test(label)) return true;
  const value = fact.value;
  if (value && typeof value === 'object') {
    if (value.mode === 'max' || value.ceiling === true || value.wishOnly === true) return true;
    if (value.rateAuthority === RATE_AUTHORITY.WISH_ONLY
      || value.rateAuthority === RATE_AUTHORITY.NON_AUTHORITATIVE) {
      return true;
    }
  }
  // desiredRate ohne Offer-Cue-Kontext = Wish
  if (fact.field === 'desiredRate' && fact.source !== 'offer_pdf') return true;
  return false;
}

/**
 * @param {object} fact
 * @returns {string}
 */
export function resolveFactRateAuthority(fact = {}) {
  if (!fact) return RATE_AUTHORITY.NON_AUTHORITATIVE;
  if (fact.rateAuthority) return fact.rateAuthority;
  if (fact.source === 'offer_pdf' || fact.source === 'bank_pdf' || fact.source === 'dealer_calc') {
    return RATE_AUTHORITY.AUTHORITATIVE;
  }
  if (isWishBudgetFact(fact)) return RATE_AUTHORITY.WISH_ONLY;
  if (
    fact.source === 'web'
    || fact.source === 'catalog'
    || fact.source === 'advisory'
    || fact.source === 'base_leasing_rate'
    || fact.source === 'price_hint'
  ) {
    return RATE_AUTHORITY.NON_AUTHORITATIVE;
  }
  if (OFFER_RATE_FIELDS.has(fact.field)) return RATE_AUTHORITY.AUTHORITATIVE;
  if (BUDGET_FIELDS.has(fact.field) && !isWishBudgetFact(fact)) {
    // Explizite „Monatsrate 329“ ohne max/bis → im Offer-Kontext ok
    return RATE_AUTHORITY.AUTHORITATIVE;
  }
  return RATE_AUTHORITY.NON_AUTHORITATIVE;
}

/**
 * @param {unknown} value
 * @returns {number|null}
 */
export function coerceRateAmount(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'object') {
    const n = Number(value.amount ?? value.value ?? value.rate ?? null);
    return Number.isFinite(n) ? n : null;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Nur autoritative Offer-Monatsrate aus Facts (nie Wish-Budget / Web).
 * @param {object[]} facts
 * @returns {{ amount: number|null, authority: string, fact: object|null }}
 */
export function extractAuthoritativeOfferRateFromFacts(facts = []) {
  const list = Array.isArray(facts) ? facts.filter(Boolean) : [];
  for (const fact of list) {
    if (!OFFER_RATE_FIELDS.has(fact.field) && !BUDGET_FIELDS.has(fact.field)) continue;
    const authority = resolveFactRateAuthority(fact);
    if (authority !== RATE_AUTHORITY.AUTHORITATIVE) continue;
    if (isWishBudgetFact(fact)) continue;
    const amount = coerceRateAmount(fact.value);
    if (amount == null || amount < 50 || amount > 5000) continue;
    return { amount, authority, fact };
  }
  return { amount: null, authority: RATE_AUTHORITY.NON_AUTHORITATIVE, fact: null };
}

/**
 * Magic-/Advisory-Rate: nur behalten wenn Seller/PDF gesetzt hat.
 * Katalog-/Calc-Schätzungen strippen.
 *
 * @param {{
 *   sellerFactRate?: number|null,
 *   magicCalculationRate?: number|null,
 *   magicIntentRate?: number|null,
 *   fromPdf?: boolean,
 *   rateAuthority?: string|null,
 * }} input
 * @returns {{ monthlyRate: number|null, rateAuthority: string }}
 */
export function resolveAuthoritativeOfferMonthlyRate(input = {}) {
  const explicitAuthority = input.rateAuthority || null;
  if (explicitAuthority === RATE_AUTHORITY.NON_AUTHORITATIVE
    || explicitAuthority === RATE_AUTHORITY.WISH_ONLY
    || explicitAuthority === RATE_AUTHORITY.STALE) {
    return { monthlyRate: null, rateAuthority: explicitAuthority };
  }

  if (input.sellerFactRate != null && Number.isFinite(Number(input.sellerFactRate))) {
    return {
      monthlyRate: Number(input.sellerFactRate),
      rateAuthority: RATE_AUTHORITY.AUTHORITATIVE,
    };
  }

  // PDF / expliziter Intent vom Verkäufer-Text – keine Engine-Schätzung
  if (input.fromPdf && input.magicIntentRate != null && Number.isFinite(Number(input.magicIntentRate))) {
    return {
      monthlyRate: Number(input.magicIntentRate),
      rateAuthority: RATE_AUTHORITY.AUTHORITATIVE,
    };
  }

  if (input.magicIntentRate != null && Number.isFinite(Number(input.magicIntentRate))) {
    // Intent-Rate = aus NL/PDF geparst, nicht baseLeasingRate
    return {
      monthlyRate: Number(input.magicIntentRate),
      rateAuthority: RATE_AUTHORITY.AUTHORITATIVE,
    };
  }

  // calculation.monthlyRate nur wenn identisch zu Intent (Seller/PDF übernommen)
  if (
    input.magicCalculationRate != null
    && input.magicIntentRate != null
    && Number(input.magicCalculationRate) === Number(input.magicIntentRate)
  ) {
    return {
      monthlyRate: Number(input.magicCalculationRate),
      rateAuthority: RATE_AUTHORITY.AUTHORITATIVE,
    };
  }

  return { monthlyRate: null, rateAuthority: RATE_AUTHORITY.NON_AUTHORITATIVE };
}

/**
 * Strippt nicht-autoritative Raten aus Offer-Payload (Mutation-safe).
 * Cash/Barkauf ohne Monatsrate bleibt gültig — nur Fake-Monatsraten werden entfernt.
 * @param {object} payload
 */
export function stripNonAuthoritativeOfferRates(payload = {}) {
  if (!payload || typeof payload !== 'object') return payload;
  const authority = payload.rateAuthority || null;
  const hasInjectedRate = payload.monthlyRate != null;
  const sourceIsBad = payload.monthlyRateSource === 'catalog'
    || payload.monthlyRateSource === 'web'
    || payload.monthlyRateSource === 'advisory'
    || payload.monthlyRateSource === 'base_leasing_rate'
    || payload.monthlyRateSource === 'wish_budget';
  const authorityForbidsRate = authority === RATE_AUTHORITY.NON_AUTHORITATIVE
    || authority === RATE_AUTHORITY.WISH_ONLY
    || authority === RATE_AUTHORITY.STALE;

  // Keine Monatsrate gesetzt → Payload unverändert lassen (Cash/Shell/missingRate ok)
  if (!hasInjectedRate) {
    return {
      ...payload,
      rateAuthority: authority || RATE_AUTHORITY.NON_AUTHORITATIVE,
    };
  }

  // Monatsrate vorhanden, aber nicht autoritativ → strippen
  if (sourceIsBad || authorityForbidsRate) {
    return {
      ...payload,
      monthlyRate: null,
      rateAuthority: authority || RATE_AUTHORITY.NON_AUTHORITATIVE,
      missingRate: true,
      canCreateOffer: false,
    };
  }

  return {
    ...payload,
    rateAuthority: authority || RATE_AUTHORITY.AUTHORITATIVE,
  };
}

/**
 * Markiert Advisory-/Web-Raten in Facts (nicht löschen – Zero-Loss / Wish behalten).
 * @param {object[]} facts
 */
export function markNonAuthoritativeRateFacts(facts = []) {
  return (facts || []).map((fact) => {
    if (!fact) return fact;
    if (!BUDGET_FIELDS.has(fact.field) && !OFFER_RATE_FIELDS.has(fact.field)) return fact;
    const authority = resolveFactRateAuthority(fact);
    if (authority === RATE_AUTHORITY.AUTHORITATIVE) {
      return { ...fact, rateAuthority: authority };
    }
    return {
      ...fact,
      rateAuthority: authority,
      // Wish bleibt speicherbar; darf nur nicht Offer-Rate werden
      offerRateForbidden: authority !== RATE_AUTHORITY.AUTHORITATIVE,
    };
  });
}

/**
 * Reicher Capture-Dump ohne Offer-Cue → Merken, nicht Offer-Review.
 * @param {object[]} facts
 * @param {string} sellerInput
 */
export function isRichCaptureDump(facts = [], sellerInput = '') {
  if (isExplicitOfferCue(sellerInput)) return false;
  const list = Array.isArray(facts) ? facts.filter(Boolean) : [];
  if (list.length < 2) return false;

  const captureClasses = new Set([
    SELLER_FACT_CLASS.CUSTOMER_FACT,
    SELLER_FACT_CLASS.CUSTOMER_NEED,
    SELLER_FACT_CLASS.VEHICLE_INTEREST,
    SELLER_FACT_CLASS.VEHICLE_REQUIREMENT,
    SELLER_FACT_CLASS.COMMERCIAL_PREFERENCE,
    SELLER_FACT_CLASS.EXISTING_VEHICLE,
    SELLER_FACT_CLASS.TRADE_IN_FACT,
    SELLER_FACT_CLASS.SELLER_NOTE,
  ]);
  const captureCount = list.filter((f) => (
    captureClasses.has(f.factClass)
    || f.field === 'unresolvedNote'
    || f.preserveAsNote
  )).length;
  return captureCount >= 2;
}

/**
 * Nur paymentType (Guess) → kein Offer-Stuck.
 * @param {object[]} facts
 */
export function isPaymentTypeOnlyCommercial(facts = []) {
  const commercial = (facts || []).filter((f) => (
    f?.factClass === SELLER_FACT_CLASS.COMMERCIAL_PREFERENCE
    || f?.factClass === SELLER_FACT_CLASS.OFFER_INSTRUCTION
  ));
  if (!commercial.length) return false;
  return commercial.every((f) => f.field === 'paymentType');
}

/**
 * Capture vor Offer bevorzugen?
 * @param {{ facts?: object[], sellerInput?: string, intents?: object[] }} input
 */
export function shouldCaptureBeforeOffer(input = {}) {
  const facts = input.facts || [];
  const text = input.sellerInput || '';
  if (isExplicitOfferCue(text)) return false;
  if (isPaymentTypeOnlyCommercial(facts) && isRichCaptureDump(facts, text)) return true;
  if (isPaymentTypeOnlyCommercial(facts) && !isExplicitOfferCue(text)) return true;
  return isRichCaptureDump(facts, text);
}

/**
 * PREPARE_OFFER aus Intent-Liste entfernen, wenn Capture-First greift.
 * @param {object[]} intents
 * @param {{ facts?: object[], sellerInput?: string }} ctx
 */
export function filterOfferIntentForCaptureFirst(intents = [], ctx = {}) {
  if (!shouldCaptureBeforeOffer(ctx)) {
    return Array.isArray(intents) ? [...intents] : [];
  }
  return (intents || []).filter((i) => i.type !== SELLER_TURN_INTENTS.PREPARE_OFFER);
}

/**
 * Next-Step-Hinweis nach erfolgreichem Capture (bestehende CTA, kein UI-Redesign).
 * @param {{
 *   trackCount?: number,
 *   hasActiveTrack?: boolean,
 *   hasVehicleModel?: boolean,
 *   modelKey?: string|null,
 *   fuelPreference?: string|null,
 *   needsConsultation?: boolean,
 * }} opts
 */
export function buildCaptureNextStepHint(opts = {}) {
  const hasModel = Boolean(opts.hasVehicleModel || opts.modelKey);
  const fuel = String(opts.fuelPreference || '').toLowerCase();
  const isElectric = fuel === 'electric' || fuel === 'elektro' || fuel === 'bev';

  // Nur ohne Modell → Beratung. Elektro allein reicht nicht, wenn Modell schon da
  // (auch wenn das Modell noch needsConfirmation hat).
  if (!hasModel && opts.needsConsultation) {
    return {
      id: 'capture_then_consult',
      label: 'Passende Fahrzeuge finden',
      cta: 'Beratung',
      hint: 'Passende Fahrzeuge finden',
    };
  }
  if (!hasModel && isElectric) {
    return {
      id: 'capture_then_consult',
      label: 'Passende Fahrzeuge finden',
      cta: 'Beratung',
      hint: 'Passende Fahrzeuge finden',
    };
  }

  if (opts.trackCount > 1 && !opts.hasActiveTrack) {
    return {
      id: 'capture_then_offer',
      label: 'Als Nächstes: Angebot für welches Fahrzeug?',
      cta: 'Angebot',
      hint: 'Spuren sind aufgenommen – Angebotstool öffnen, wenn du soweit bist.',
    };
  }
  return {
    id: 'capture_then_offer',
    label: 'Als Nächstes: Angebot vorbereiten',
    cta: 'Angebot',
    hint: 'Angaben sind in der Akte – Angebotstool öffnen für belastbare Rate (PDF/Bank).',
  };
}

/**
 * Wunsch-Budget darf nicht in Offer-Freitext als „Monatsrate X“ landen.
 * @param {object} lead
 * @param {string} text
 */
export function assertNoWishRateInOfferText(lead = {}, text = '') {
  const wish = lead?.desiredRate ?? lead?.wish?.desiredRate ?? null;
  if (wish == null) return true;
  const t = String(text || '');
  // Explizite Seller-Rate im Text ist ok; stilles Wish-Inject erkennen wir an Enrichment-Pattern
  const injected = new RegExp(
    `${Number(wish)}\\s*(?:€|euro)?\\s*(?:/\\s*monat|pro\\s+monat|(?:monats)?rate)`,
    'i',
  );
  const hasExplicitRateCue = /\b(monats)?rate\b/i.test(t) && t.includes(String(wish));
  if (injected.test(t) && !hasExplicitRateCue) return false;
  return true;
}
