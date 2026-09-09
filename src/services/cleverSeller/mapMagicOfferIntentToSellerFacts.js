/**
 * Magic-Offer-Intent → Seller Universal Facts (PDF / Leasingangebot).
 * ERKENNEN ≠ ERFINDEN – nur gesetzte Intent-Felder werden Facts.
 */
import { parseMagicOfferIntent } from '../dealer/magicOfferIntentParser.js';
import { resolveActiveSellerModelInterest } from '../crm/vehicleTrack.js';
import {
  SELLER_FACT_CLASS,
  SELLER_FACT_SOURCE,
} from './sellerFactTypes.js';
import { createExtractedFact } from './cleverSellerTurnResultSchema.js';
import {
  INVALID_DISCOUNT_WARNING,
  validateDiscountPercent,
} from './validateDiscountPercent.js';

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
  gt: 'GT',
  earth: 'Earth',
  air: 'Air',
  spirit: 'Spirit',
  vision: 'Vision',
};

const COLOR_LABEL = {
  terracotta: 'Terracotta',
  snowwhitepearl: 'Schneeweiß',
  clearwhite: 'Clear White',
  white: 'Weiß',
  aurorablackpearl: 'Auroraschwarz Metallic',
  shalegrey: 'Schiefergrau',
  frostblue: 'Frost Blue',
  ivorysilver: 'Ivory Silver',
  aventurinegreen: 'Aventurine Green',
  wolfgray: 'Wolf Grey',
};

const MOTOR_LABEL = {
  'ev-std': '58 kWh / 150 kW',
  'ev-long': '81,4 kWh Long Range',
  'ev-long-awd': '81,4 kWh AWD',
  'ev-84': '84 kWh',
  'ev-84-awd': '84 kWh · AWD',
};

const PACKAGE_CODE_LABEL = {
  P3: 'Winter-Connect-Paket',
  P4: 'Business-Paket',
  P5: 'Upgrade-Paket',
  P6: 'DriveWise-Park-Paket',
  P7: 'Design-Paket',
  P10: 'DriveWise-Park-Paket',
  P11: 'Comfort-Paket',
  P12: 'Glasdach-Paket',
  winter_wheels: 'Winterräder',
};

const EQUIPMENT_LABEL = {
  heat_pump: 'Wärmepumpe',
  towbar: 'Anhängerkupplung',
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
    const basis = commercial.monthlyRateBasis || null;
    const basisLabel = basis === 'net'
      ? 'netto'
      : (basis === 'gross' ? 'brutto' : null);
    // PDF „Alle Preise ohne USt“ = sichere Netto-Wahrheit, kein Review-Zwang
    const netAuthoritative = basis === 'net';
    const total = commercial.monthlyTotalRate != null
      ? Number(commercial.monthlyTotalRate)
      : null;
    const finance = commercial.financeLeaseRate != null
      ? Number(commercial.financeLeaseRate)
      : null;
    const logistics = commercial.logisticsMonthlyRate != null
      ? Number(commercial.logisticsMonthlyRate)
      : null;
    const primaryRate = total != null ? total : rate;
    const hasBreakdown = total != null
      && ((finance != null && finance !== total) || logistics != null);
    push({
      factClass: SELLER_FACT_CLASS.COMMERCIAL_PREFERENCE,
      field: 'monthlyBudget',
      value: (basis || hasBreakdown)
        ? {
          amount: primaryRate,
          basis: basis || null,
          monthlyTotalRate: total,
          financeLeaseRate: finance,
          logisticsMonthlyRate: logistics,
          label: total != null ? 'monthlyTotalRate' : 'monthlyRate',
        }
        : primaryRate,
      label: basisLabel
        ? `${formatEuro(primaryRate)} ${basisLabel} / Monat`
        : `${formatEuro(primaryRate)} / Monat`,
      confidence: netAuthoritative ? 0.93 : (basis === 'net' ? 0.72 : 0.88),
      needsConfirmation: !netAuthoritative && basis === 'net',
    });
    if (finance != null && total != null && finance !== total) {
      push({
        factClass: SELLER_FACT_CLASS.COMMERCIAL_PREFERENCE,
        field: 'financeLeaseRate',
        value: { amount: finance, basis: basis || null },
        label: `${formatEuro(finance)} Finanzleasing`,
        confidence: 0.92,
        needsConfirmation: false,
      });
    }
    if (logistics != null) {
      push({
        factClass: SELLER_FACT_CLASS.COMMERCIAL_PREFERENCE,
        field: 'logisticsMonthlyRate',
        value: { amount: logistics, basis: basis || null },
        label: `${formatEuro(logistics)} Logistik`,
        confidence: 0.92,
        needsConfirmation: false,
      });
    }
  }

  if (commercial.listPrice != null) {
    const upe = Number(commercial.listPrice);
    const basis = commercial.listPriceBasis || null;
    const basisLabel = basis === 'net'
      ? 'netto'
      : (basis === 'gross' ? 'brutto' : null);
    const netAuthoritative = basis === 'net';
    push({
      factClass: SELLER_FACT_CLASS.COMMERCIAL_PREFERENCE,
      field: 'purchasePrice',
      value: basis
        ? { amount: upe, basis }
        : upe,
      label: basisLabel
        ? `Listenpreis ${formatEuro(upe)} ${basisLabel}`
        : `Listenpreis ${formatEuro(upe)}`,
      confidence: netAuthoritative ? 0.92 : (basis === 'net' ? 0.7 : 0.86),
      needsConfirmation: !netAuthoritative && basis === 'net',
    });
  }

  if (commercial.discountPercent != null) {
    const checked = validateDiscountPercent(commercial.discountPercent);
    if (checked.ok) {
      push({
        factClass: SELLER_FACT_CLASS.OFFER_INSTRUCTION,
        field: 'discountPercent',
        value: checked.value,
        label: `${checked.value} % Rabatt`,
        confidence: 0.9,
      });
    } else if (checked.conflict) {
      push({
        factClass: SELLER_FACT_CLASS.OFFER_INSTRUCTION,
        field: 'discountPercentInvalid',
        value: { raw: commercial.discountPercent, conflict: true },
        label: INVALID_DISCOUNT_WARNING,
        confidence: 0.95,
        needsConfirmation: true,
      });
    }
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
    const colorLabel = COLOR_LABEL[vehicle.colorHint] || String(vehicle.colorHint);
    push({
      factClass: SELLER_FACT_CLASS.VEHICLE_INTEREST,
      field: 'colorPreference',
      value: {
        id: vehicle.colorHint,
        color: colorLabel,
        label: colorLabel,
      },
      label: colorLabel,
      confidence: 0.9,
      needsConfirmation: false,
    });
  }

  if (vehicle.motorHint) {
    const motorLabel = MOTOR_LABEL[vehicle.motorHint] || String(vehicle.motorHint);
    push({
      factClass: SELLER_FACT_CLASS.VEHICLE_REQUIREMENT,
      field: 'equipmentWish',
      value: {
        id: vehicle.motorHint,
        label: motorLabel,
        kind: 'motor',
      },
      label: motorLabel,
      confidence: 0.9,
    });
  }

  const packageLabels = Array.isArray(vehicle.packageLabels) ? vehicle.packageLabels : [];
  const seenPackageLabels = new Set(packageLabels.map((l) => String(l).toLowerCase()));
  for (const label of packageLabels) {
    push({
      factClass: SELLER_FACT_CLASS.VEHICLE_REQUIREMENT,
      field: 'equipmentWish',
      value: {
        id: String(label).toLowerCase().replace(/\s+/g, '-'),
        label,
        kind: 'package',
      },
      label,
      confidence: 0.9,
    });
  }
  for (const code of vehicle.packageKeys || []) {
    const label = PACKAGE_CODE_LABEL[code] || code;
    if (seenPackageLabels.has(String(label).toLowerCase())) continue;
    if (seenPackageLabels.has(String(code).toLowerCase())) continue;
    // „Winterräder 21 Zoll“ schon als Label → kein zweites „Winterräder“
    if (
      /winterr/i.test(String(label))
      && [...seenPackageLabels].some((l) => /winterr/i.test(l))
    ) {
      continue;
    }
    seenPackageLabels.add(String(label).toLowerCase());
    push({
      factClass: SELLER_FACT_CLASS.VEHICLE_REQUIREMENT,
      field: 'equipmentWish',
      value: {
        id: String(code).toLowerCase(),
        code,
        label,
        kind: 'package',
      },
      label,
      confidence: 0.88,
    });
  }

  for (const eq of vehicle.equipmentKeys || []) {
    const label = EQUIPMENT_LABEL[eq] || eq;
    push({
      factClass: SELLER_FACT_CLASS.VEHICLE_REQUIREMENT,
      field: 'equipmentWish',
      value: {
        id: eq,
        label,
        kind: 'equipment',
      },
      label,
      confidence: 0.88,
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
 * PDF-Modell vs. aktives Akte-/Seller-Modell: kein stilles Überschreiben.
 * Konditionen bleiben; Fokus-Wechsel nur nach Confirm (acceptModelSwitch).
 * @param {object[]} facts
 * @param {object} [lead]
 * @returns {object[]}
 */
export function reconcileOfferPdfVehicleInterestWithLead(facts = [], lead = {}) {
  const active = resolveActiveSellerModelInterest(lead);
  if (!active?.modelKey) return Array.isArray(facts) ? [...facts] : [];

  const normalizeKey = (raw) => String(raw || '')
    .toLowerCase()
    .replace(/^kia\s+/i, '')
    .replace(/\s+/g, '')
    .trim();

  return (facts || []).map((fact) => {
    if (!fact || fact.field !== 'vehicleInterest') return fact;
    const fromPdf = fact.source === SELLER_FACT_SOURCE.OFFER_PDF
      || fact.value?.fromOfferPdf === true;
    if (!fromPdf) return fact;

    const pdfKey = normalizeKey(fact.value?.modelKey || fact.value?.model || fact.label);
    if (!pdfKey || pdfKey === active.modelKey) return fact;

    const pdfLabel = fact.value?.label
      || fact.label
      || (fact.value?.trim
        ? `${String(pdfKey).toUpperCase().replace(/^EV/, 'EV')} ${fact.value.trim}`
        : String(pdfKey).toUpperCase().replace(/^EV/, 'EV'));
    const activeLabel = active.label
      || `Kia ${active.model || active.modelKey.toUpperCase()}`;

    return {
      ...fact,
      needsConfirmation: true,
      confidence: Math.min(Number(fact.confidence) || 0.9, 0.68),
      label: `PDF: ${pdfLabel} vs Akte: ${activeLabel}`,
      value: {
        ...(typeof fact.value === 'object' && fact.value ? fact.value : {}),
        modelKey: pdfKey,
        model: fact.value?.model || pdfKey,
        trim: fact.value?.trim || null,
        label: pdfLabel,
        conflictWithActive: true,
        preserveActiveFocus: true,
        activeModelKey: active.modelKey,
        activeModel: active.model,
        activeLabel,
        pdfLabel,
        fromOfferPdf: true,
      },
    };
  });
}

/**
 * PDF-/Angebots-Facts in bestehende Fact-Liste mergen (Feld gewinnt: OFFER_PDF > SELLER_FACT).
 * @param {object[]} existing
 * @param {object[]} incoming
 * @returns {object[]}
 */
export function mergeOfferPdfFactsIntoSellerFacts(existing = [], incoming = []) {
  const MULTI_VALUE_FIELDS = new Set([
    'equipmentWish',
    'unresolvedNote',
    'packagePreference',
  ]);
  const factKey = (fact) => {
    if (!fact?.field) return `label:${String(fact?.label || '').toLowerCase()}`;
    if (MULTI_VALUE_FIELDS.has(fact.field)) {
      const id = fact.value?.id || fact.value?.code || fact.label || '';
      return `${fact.field}:${String(id).toLowerCase()}`;
    }
    return fact.field;
  };
  const next = [...existing];
  for (const fact of incoming) {
    if (!fact?.field && !fact?.label) continue;
    const key = factKey(fact);
    const idx = next.findIndex((f) => factKey(f) === key);
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
