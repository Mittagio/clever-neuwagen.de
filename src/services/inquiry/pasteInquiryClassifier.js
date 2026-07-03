/**
 * Eingefügte Anfragen klassifizieren (Mail, mobile.de, Website, Bestand …)
 */
import {
  cleanMailHtmlArtifacts,
  extractCustomerFromMail,
  preprocessCustomerMail,
} from '../dealerAiMailExtractor.js';
import { parseCustomerPhone } from '../dealerAiParser.js';

export const INQUIRY_TYPES = {
  CUSTOMER_MESSAGE: 'customer_message',
  OFFER_REQUEST: 'offer_request',
  STOCK_VEHICLE_REQUEST: 'stock_vehicle_request',
  ADVISOR_REQUEST: 'advisor_request',
  DOCUMENT_REQUEST: 'document_request',
  UNKNOWN_REQUEST: 'unknown_request',
};

export const INQUIRY_TYPE_LABELS = {
  [INQUIRY_TYPES.CUSTOMER_MESSAGE]: 'Kundenanfrage',
  [INQUIRY_TYPES.OFFER_REQUEST]: 'Angebotsanfrage',
  [INQUIRY_TYPES.STOCK_VEHICLE_REQUEST]: 'Bestandsfahrzeug',
  [INQUIRY_TYPES.ADVISOR_REQUEST]: 'Frag-Clever-Anfrage',
  [INQUIRY_TYPES.DOCUMENT_REQUEST]: 'Unterlagenanfrage',
  [INQUIRY_TYPES.UNKNOWN_REQUEST]: 'Anfrage',
};

const STOCK_SIGNALS = [
  { re: /fahrzeug[-\s]?nr\.?/i, weight: 2, label: 'Fahrzeug-Nr.' },
  { re: /mobile\.de/i, weight: 3, label: 'mobile.de' },
  { re: /autoscout24/i, weight: 3, label: 'AutoScout24' },
  { re: /händlerwebsite|haendlerwebsite|über\s+ihre\s+website|ueber\s+ihre\s+website|fahrzeuganfrage/i, weight: 2, label: 'Website' },
  { re: /vorführ|vorfuehr|vorführwagen/i, weight: 2, label: 'Vorführer' },
  { re: /tageszulassung/i, weight: 2, label: 'Tageszulassung' },
  { re: /lagerwagen|lagerfahrzeug/i, weight: 2, label: 'Lagerwagen' },
  { re: /bestandsfahrzeug|gebrauchtwagen|jahreswagen|sofort\s+verfügbar|sofort\s+verfuegbar/i, weight: 2, label: 'Bestand' },
  { re: /https?:\/\/[^\s]+(?:mobile\.de|autoscout24|gebrauchtwagen|fahrzeug|auto)/i, weight: 2, label: 'Fahrzeuglink' },
];

const OFFER_SIGNALS = [
  { re: /leasing|finanzierung|monatlich|€\s*\/\s*monat|rate\b/i, weight: 1 },
  { re: /neuwagen|konfigurier|bestellfahrzeug|konfiguration/i, weight: 2 },
  { re: /angebot\s+erstell|unverbindlich/i, weight: 1 },
];

const ADVISOR_SIGNALS = [
  { re: /frag\s+clever|clever\s+berat/i, weight: 3 },
];

const DOCUMENT_SIGNALS = [
  { re: /selbstauskunft|unterlagen|dokumente\s+hochladen/i, weight: 3 },
];

function scoreSignals(text, signals) {
  let score = 0;
  const matched = [];
  for (const signal of signals) {
    if (signal.re.test(text)) {
      score += signal.weight;
      if (signal.label) matched.push(signal.label);
    }
  }
  return { score, matched };
}

function parseEuroAmount(raw) {
  if (!raw) return null;
  const cleaned = String(raw).replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '');
  const value = Number(cleaned);
  return Number.isFinite(value) && value > 500 ? Math.round(value) : null;
}

function extractVehicleUrl(text) {
  const match = String(text ?? '').match(/(https?:\/\/[^\s<>"']+)/i);
  return match?.[1]?.replace(/[),.]+$/, '') ?? null;
}

function extractStockNumber(text) {
  const patterns = [
    /fahrzeug[-\s]?nr\.?\s*[:#]?\s*([A-Z0-9\-\/]+)/i,
    /interne\s+nr\.?\s*[:#]?\s*([A-Z0-9\-\/]+)/i,
    /bestands[-\s]?nr\.?\s*[:#]?\s*([A-Z0-9\-\/]+)/i,
    /stock[-\s]?nr\.?\s*[:#]?\s*([A-Z0-9\-\/]+)/i,
  ];
  for (const re of patterns) {
    const m = String(text ?? '').match(re);
    if (m?.[1]) return m[1].trim();
  }
  return null;
}

function extractVehicleTitle(text) {
  const patterns = [
    /fahrzeug\s*[:]\s*(.+?)(?:\n|preis|fahrzeug|$)/i,
    /modell\s*[:]\s*(.+?)(?:\n|preis|$)/i,
    /(?:angeboten|angefragt)\s*[:]\s*(Kia\s+[^\n]+)/i,
    /(Kia\s+[A-Za-z0-9][^\n]{4,60})/i,
  ];
  for (const re of patterns) {
    const m = String(text ?? '').match(re);
    if (m?.[1]) {
      const title = m[1].trim().replace(/\s{2,}/g, ' ');
      if (title.length >= 6) return title;
    }
  }
  return null;
}

function extractPrice(text) {
  const patterns = [
    /preis\s*[:]\s*([\d.,\s]+)\s*€/i,
    /verkaufspreis\s*[:]\s*([\d.,\s]+)\s*€/i,
    /([\d]{1,3}(?:[.\s]\d{3})+)\s*€/,
  ];
  for (const re of patterns) {
    const m = String(text ?? '').match(re);
    if (m?.[1]) {
      const amount = parseEuroAmount(m[1]);
      if (amount) return amount;
    }
  }
  return null;
}

function extractCustomerMessage(text, mailCtx) {
  const patterns = [
    /nachricht\s*(?:des\s+kunden)?\s*[:]\s*([\s\S]+?)(?:\n-{2,}|$)/i,
    /anfrage\s*[:]\s*([\s\S]+?)(?:\n-{2,}|$)/i,
    /mitteilung\s*[:]\s*([\s\S]+?)(?:\n-{2,}|$)/i,
  ];
  for (const re of patterns) {
    const m = String(text ?? '').match(re);
    if (m?.[1]?.trim()) return m[1].trim();
  }
  return mailCtx?.customerMailNote ?? mailCtx?.inquiryText ?? null;
}

function detectSource(text, matchedSignals = []) {
  const lower = String(text ?? '').toLowerCase();
  if (/mobile\.de/.test(lower)) return { source: 'mobile_de', sourceLabel: 'mobile.de' };
  if (/autoscout24/.test(lower)) return { source: 'autoscout24', sourceLabel: 'AutoScout24' };
  if (/website|händlerwebsite|haendlerwebsite/.test(lower) || matchedSignals.includes('Website')) {
    return { source: 'dealer_website', sourceLabel: 'Händlerwebsite' };
  }
  if (/vorführ|vorfuehr/.test(lower)) return { source: 'demo_vehicle', sourceLabel: 'Vorführer' };
  if (/lagerwagen|bestand|gebrauchtwagen/.test(lower)) {
    return { source: 'stock', sourceLabel: 'Bestandsfahrzeug' };
  }
  return { source: 'unknown', sourceLabel: 'Unbekannte Quelle' };
}

function extractCompany(text) {
  const m = String(text ?? '').match(/firma\s*[:]\s*(.+?)(?:\n|$)/i)
    ?? String(text ?? '').match(/unternehmen\s*[:]\s*(.+?)(?:\n|$)/i);
  return m?.[1]?.trim() ?? null;
}

/**
 * @param {string} text
 */
export function classifyPastedInquiry(text) {
  const raw = cleanMailHtmlArtifacts(text);
  if (!raw.trim()) {
    return {
      type: INQUIRY_TYPES.UNKNOWN_REQUEST,
      confidence: 'none',
      uncertain: true,
      signals: [],
      rawText: raw,
    };
  }

  const stock = scoreSignals(raw, STOCK_SIGNALS);
  const offer = scoreSignals(raw, OFFER_SIGNALS);
  const advisor = scoreSignals(raw, ADVISOR_SIGNALS);
  const document = scoreSignals(raw, DOCUMENT_SIGNALS);

  if (advisor.score >= 3) {
    return {
      type: INQUIRY_TYPES.ADVISOR_REQUEST,
      confidence: 'high',
      uncertain: false,
      signals: advisor.matched,
      rawText: raw,
    };
  }

  if (document.score >= 3) {
    return {
      type: INQUIRY_TYPES.DOCUMENT_REQUEST,
      confidence: 'high',
      uncertain: false,
      signals: document.matched,
      rawText: raw,
    };
  }

  if (stock.score >= 4) {
    return {
      type: INQUIRY_TYPES.STOCK_VEHICLE_REQUEST,
      confidence: 'high',
      uncertain: false,
      signals: stock.matched,
      rawText: raw,
    };
  }

  if (stock.score >= 2 && offer.score < 3) {
    return {
      type: INQUIRY_TYPES.STOCK_VEHICLE_REQUEST,
      confidence: 'low',
      uncertain: true,
      signals: stock.matched,
      rawText: raw,
    };
  }

  if (offer.score >= 2) {
    return {
      type: INQUIRY_TYPES.OFFER_REQUEST,
      confidence: offer.score >= 3 ? 'high' : 'low',
      uncertain: offer.score < 3,
      signals: offer.matched,
      rawText: raw,
    };
  }

  if (/\?|bitte|anfrage|interesse/i.test(raw)) {
    return {
      type: INQUIRY_TYPES.CUSTOMER_MESSAGE,
      confidence: 'medium',
      uncertain: false,
      signals: [],
      rawText: raw,
    };
  }

  return {
    type: INQUIRY_TYPES.UNKNOWN_REQUEST,
    confidence: 'low',
    uncertain: true,
    signals: [],
    rawText: raw,
  };
}

function extractCustomerNameFromInquiry(text) {
  const patterns = [
    /name\s*[:]\s*([A-ZÄÖÜ][^\n]+)/i,
    /kunde\s*[:]\s*([A-ZÄÖÜ][^\n]+)/i,
    /anfrage\s+von\s*[:]\s*([A-ZÄÖÜ][^\n]+)/i,
  ];
  for (const re of patterns) {
    const match = String(text ?? '').match(re);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

function extractCustomerEmail(text) {
  const match = String(text ?? '').match(/e-?mail\s*[:]\s*([^\s@]+@[^\s@]+\.[^\s@]+)/i);
  return match?.[1]?.trim() ?? null;
}

function extractCustomerPhone(text) {
  const match = String(text ?? '').match(/telefon\s*[:]\s*([+\d][\d\s\-/()]+)/i);
  return match?.[1]?.trim() ?? null;
}

/**
 * @param {string} text
 */
export function extractStockVehicleInquiry(text) {
  const raw = cleanMailHtmlArtifacts(text);
  const mailCtx = preprocessCustomerMail(raw);
  const customer = extractCustomerFromMail(raw, {}, mailCtx);
  const explicitName = extractCustomerNameFromInquiry(raw);
  const explicitEmail = extractCustomerEmail(raw);
  const explicitPhone = extractCustomerPhone(raw);
  if (explicitName) {
    customer.customerName = explicitName;
    const parts = explicitName.split(/\s+/);
    customer.customerFirstName = parts[0] ?? null;
    customer.customerLastName = parts.slice(1).join(' ') || null;
  }
  if (explicitEmail) customer.customerEmail = explicitEmail;
  if (explicitPhone) customer.customerPhone = explicitPhone;
  const { source, sourceLabel } = detectSource(raw, scoreSignals(raw, STOCK_SIGNALS).matched);

  const vehicleTitle = extractVehicleTitle(raw);
  const price = extractPrice(raw);
  const stockNumber = extractStockNumber(raw);
  const vehicleUrl = extractVehicleUrl(raw);
  const customerMessage = extractCustomerMessage(raw, mailCtx);
  const company = extractCompany(raw);

  return {
    customer: {
      firstName: customer.customerFirstName,
      lastName: customer.customerLastName,
      fullName: customer.customerName,
      salutation: customer.customerSalutation,
      phone: customer.customerPhone ?? parseCustomerPhone(raw),
      email: customer.customerEmail,
      company,
      address: null,
    },
    vehicle: {
      vehicleTitle,
      price,
      stockNumber,
      vehicleUrl,
      availabilityLabel: /sofort/i.test(raw) ? 'Sofort verfügbar' : null,
    },
    source,
    sourceLabel,
    customerMessage,
    rawText: raw,
  };
}

export function buildPasteInquiryPreview(classification, extraction) {
  const customer = extraction?.customer ?? {};
  const vehicle = extraction?.vehicle ?? {};
  const type = classification?.uncertain && classification?.type !== INQUIRY_TYPES.STOCK_VEHICLE_REQUEST
    ? classification.type
    : (classification?.type ?? INQUIRY_TYPES.UNKNOWN_REQUEST);

  const customerLines = [
    customer.fullName,
    customer.phone,
    customer.email,
    customer.company,
  ].filter(Boolean);

  const vehicleLines = [
    vehicle.vehicleTitle,
    vehicle.price != null ? `${Number(vehicle.price).toLocaleString('de-DE')} €` : null,
    vehicle.stockNumber ? `Fahrzeug-Nr. ${vehicle.stockNumber}` : null,
    vehicle.vehicleUrl ? 'Link gefunden' : null,
  ].filter(Boolean);

  return {
    title: classification?.uncertain ? 'Clever ist nicht sicher' : 'Clever hat erkannt',
    inquiryType: type,
    inquiryTypeLabel: INQUIRY_TYPE_LABELS[type] ?? 'Anfrage',
    uncertain: Boolean(classification?.uncertain),
    confidence: classification?.confidence ?? 'low',
    signals: classification?.signals ?? [],
    customerLines,
    vehicleLines,
    customerMessage: extraction?.customerMessage ?? null,
    sourceLabel: extraction?.sourceLabel ?? null,
    vehicleUrl: vehicle.vehicleUrl ?? null,
    stockVehicle: vehicle.vehicleTitle ? {
      source: extraction?.source,
      sourceLabel: extraction?.sourceLabel,
      vehicleTitle: vehicle.vehicleTitle,
      price: vehicle.price,
      stockNumber: vehicle.stockNumber,
      vehicleUrl: vehicle.vehicleUrl,
      availabilityLabel: vehicle.availabilityLabel,
      requestedAt: new Date().toISOString(),
      rawText: extraction?.rawText ?? classification?.rawText ?? '',
    } : null,
  };
}
