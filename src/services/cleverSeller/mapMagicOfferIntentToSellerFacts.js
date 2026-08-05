/**
 * Magic-Offer-Intent → Seller Universal Facts (PDF / Leasingangebot).
 * ERKENNEN ≠ ERFINDEN – nur gesetzte Intent-Felder werden Facts.
 */
import { parseMagicOfferIntent } from '../dealer/magicOfferIntentParser.js';
import {
  SELLER_FACT_CLASS,
  SELLER_FACT_SOURCE,
} from './sellerFactTypes.js';
import { createExtractedFact } from './cleverSellerTurnResultSchema.js';

const PAYMENT_LABEL = {
  leasing: 'Leasing',
  financing: 'Finanzierung',
  purchase: 'Kauf / Bar',
  cash: 'Kauf / Bar',
};

const PAYMENT_VALUE = {
  leasing: 'leasing',
  financing: 'financing',
  purchase: 'cash',
  cash: 'cash',
};

const TRIM_LABEL = {
  'gt-line': 'GT-Line',
  earth: 'Earth',
  air: 'Air',
  spirit: 'Spirit',
  vision: 'Vision',
};

function formatEuro(value) {
  return `${Number(value).toLocaleString('de-DE')} €`;
}

function formatKm(value) {
  return `${Number(value).toLocaleString('de-DE')} km`;
}

/**
 * @param {object} intent – parseMagicOfferIntent Result
 * @returns {object[]}
 */
export function mapMagicOfferIntentToSellerFacts(intent = {}) {
  const facts = [];
  const commercial = intent.commercialInput ?? {};
  const vehicle = intent.vehicleRequest ?? {};
  const source = SELLER_FACT_SOURCE.OFFER_PDF;

  const push = (partial) => {
    if (!partial?.label) return;
    facts.push(createExtractedFact({
      source,
      confidence: 0.92,
      ...partial,
    }));
  };

  const paymentValue = PAYMENT_VALUE[intent.offerType];
  if (paymentValue) {
    push({
      factClass: SELLER_FACT_CLASS.COMMERCIAL_PREFERENCE,
      field: 'paymentType',
      value: paymentValue,
      label: PAYMENT_LABEL[intent.offerType] || paymentValue,
      confidence: 0.94,
    });
  }

  if (commercial.durationMonths != null) {
    push({
      factClass: SELLER_FACT_CLASS.COMMERCIAL_PREFERENCE,
      field: 'termMonths',
      value: Number(commercial.durationMonths),
      label: `${commercial.durationMonths} Monate`,
      confidence: 0.94,
    });
  }

  if (commercial.annualMileageKm != null) {
    const km = Number(commercial.annualMileageKm);
    push({
      factClass: SELLER_FACT_CLASS.COMMERCIAL_PREFERENCE,
      field: 'annualMileage',
      value: km,
      label: formatKm(km),
      confidence: 0.94,
    });
  }

  if (commercial.downPayment != null || commercial.specialPayment != null) {
    const down = Number(commercial.downPayment ?? commercial.specialPayment);
    push({
      factClass: SELLER_FACT_CLASS.COMMERCIAL_PREFERENCE,
      field: 'downPayment',
      value: down,
      label: down === 0 ? 'Anzahlung 0 €' : `Anzahlung ${formatEuro(down)}`,
      confidence: 0.93,
    });
  }

  if (commercial.monthlyRate != null) {
    const rate = Number(commercial.monthlyRate);
    push({
      factClass: SELLER_FACT_CLASS.COMMERCIAL_PREFERENCE,
      field: 'monthlyBudget',
      value: rate,
      label: `${formatEuro(rate)} Rate`,
      confidence: 0.88,
      needsConfirmation: true,
    });
  }

  if (commercial.discountPercent != null) {
    push({
      factClass: SELLER_FACT_CLASS.OFFER_INSTRUCTION,
      field: 'discountPercent',
      value: Number(commercial.discountPercent),
      label: `${commercial.discountPercent} % Rabatt`,
      confidence: 0.9,
    });
  }

  if (commercial.transferCost != null) {
    push({
      factClass: SELLER_FACT_CLASS.OFFER_INSTRUCTION,
      field: 'transferCost',
      value: Number(commercial.transferCost),
      label: `Überführung ${formatEuro(commercial.transferCost)}`,
      confidence: 0.9,
    });
  }

  if (commercial.finalPayment != null) {
    push({
      factClass: SELLER_FACT_CLASS.COMMERCIAL_PREFERENCE,
      field: 'finalPayment',
      value: Number(commercial.finalPayment),
      label: `Schlussrate ${formatEuro(commercial.finalPayment)}`,
      confidence: 0.9,
    });
  }

  if (vehicle.modelHint) {
    const modelKey = String(vehicle.modelHint).replace(/\s+/g, '').toLowerCase();
    const modelLabel = modelKey.toUpperCase().replace(/^EV/, 'EV');
    const trimHint = vehicle.trimHint ? TRIM_LABEL[vehicle.trimHint] || vehicle.trimHint : null;
    push({
      factClass: SELLER_FACT_CLASS.VEHICLE_INTEREST,
      field: 'vehicleInterest',
      value: {
        modelKey,
        trim: trimHint,
        label: trimHint ? `${modelLabel} ${trimHint}` : modelLabel,
      },
      label: trimHint ? `${modelLabel} ${trimHint}` : modelLabel,
      confidence: 0.93,
    });
  } else if (vehicle.trimHint) {
    const trimHint = TRIM_LABEL[vehicle.trimHint] || vehicle.trimHint;
    push({
      factClass: SELLER_FACT_CLASS.VEHICLE_REQUIREMENT,
      field: 'trimPreference',
      value: [trimHint],
      label: trimHint,
      confidence: 0.88,
    });
  }

  if (vehicle.colorHint) {
    push({
      factClass: SELLER_FACT_CLASS.VEHICLE_INTEREST,
      field: 'colorPreference',
      value: vehicle.colorHint,
      label: String(vehicle.colorHint),
      confidence: 0.85,
      needsConfirmation: true,
    });
  }

  return facts;
}

/**
 * @param {string} text
 * @returns {object[]}
 */
export function extractSellerFactsFromOfferPdfText(text = '') {
  return mapMagicOfferIntentToSellerFacts(parseMagicOfferIntent(text));
}

/**
 * PDF-/Angebots-Facts in bestehende Fact-Liste mergen (Feld gewinnt: OFFER_PDF > SELLER_FACT).
 * @param {object[]} existing
 * @param {object[]} incoming
 * @returns {object[]}
 */
export function mergeOfferPdfFactsIntoSellerFacts(existing = [], incoming = []) {
  const next = [...existing];
  for (const fact of incoming) {
    if (!fact?.field && !fact?.label) continue;
    const idx = fact.field
      ? next.findIndex((f) => f.field === fact.field)
      : next.findIndex((f) => String(f.label).toLowerCase() === String(fact.label).toLowerCase());
    if (idx < 0) {
      next.push(fact);
      continue;
    }
    const prev = next[idx];
    const preferIncoming = prev.factClass === SELLER_FACT_CLASS.SELLER_FACT
      || prev.source !== SELLER_FACT_SOURCE.OFFER_PDF
      || (prev.confidence || 0) < (fact.confidence || 0);
    if (preferIncoming) next[idx] = fact;
  }
  return next;
}

/**
 * @param {object[]} [attachments]
 */
export function hasOfferOrConfiguratorPdfAttachment(attachments = []) {
  return (attachments || []).some((a) => (
    a?.kind === 'configurator_pdf'
    || a?.kind === 'offer_pdf'
  ));
}

/**
 * @param {object[]} [attachments]
 * @param {string} [sellerInput]
 */
export function shouldEnrichSellerInputFromOfferPdf(attachments = [], sellerInput = '') {
  const list = attachments ?? [];
  // Contract-PDF → Contract Memory (Slice 11), nicht Offer-Enrichment
  if (list.some((a) => a?.kind === 'contract_pdf' || a?.sourceType === 'contract_pdf')) {
    return false;
  }
  const hasPdfAttachment = list.some((a) => (
    a?.kind === 'configurator_pdf'
    || a?.kind === 'offer_pdf'
    || /pdf/i.test(String(a?.mimeType || a?.type || ''))
  ));
  if (hasPdfAttachment) return true;
  return /^\s*PDF\s*:/i.test(String(sellerInput ?? ''));
}

/**
 * Offer-/Konfigurator-PDF-Drop (nicht Altvertrag) – inkl. „PDF:“-Seed aus Attach-Pfad.
 * @param {object[]} [attachments]
 * @param {string} [sellerInput]
 */
export function isOfferPdfDropContext(attachments = [], sellerInput = '') {
  const list = attachments ?? [];
  if (list.some((a) => (
    a?.kind === 'contract_pdf'
    || a?.sourceType === 'contract_pdf'
    || a?.sourceType === 'contract_pdf_ocr'
  ))) {
    return false;
  }
  if (hasOfferOrConfiguratorPdfAttachment(list)) return true;
  return shouldEnrichSellerInputFromOfferPdf(list, sellerInput)
    && /^\s*PDF\s*:/i.test(String(sellerInput ?? ''));
}

/**
 * Expliziter Verkäufer-Terminbefehl – nicht PDF-Boilerplate
 * („Beratung“, „Termin nach Vereinbarung“, „kommen Sie vorbei“, Gültigkeitsdatum).
 * @param {string} [text]
 */
export function hasExplicitAppointmentSellerCue(text = '') {
  const t = String(text ?? '');
  if (!t.trim()) return false;
  if (/\b(schlag(?:e|en)?|biet(?:e|en)?|trag(?:e|en)?)\b[\s\S]{0,80}\b(termin|probefahrt|beratung(?:sgespräch|sgesprach)?)\b/i.test(t)) {
    return true;
  }
  if (/\b(termin|probefahrt)\b[\s\S]{0,60}\b(vor(?:schlagen)?|anbieten|eintragen)\b/i.test(t)) {
    return true;
  }
  if (
    /\b(montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag|morgen|übermorgen|uebermorgen)\b/i.test(t)
    && /\b\d{1,2}([:.]\d{2})?\s*uhr\b/i.test(t)
    && /\b(schlag|biet|trag|termin|probefahrt|vor)\b/i.test(t)
  ) {
    return true;
  }
  return false;
}
