/**
 * Inzahlungnahme – strukturierte Werte für Angebot & Finanzierung.
 */
import { getAkteDocuments, isTradeInDocumentCategory, parseEuroAmount } from './customerAkteDocuments.js';
import { buildCustomerUnderstanding } from './dealer/customerUnderstanding.js';

export function createEmptyTradeIn() {
  return {
    vehicle: '',
    datValue: null,
    payoffAmount: null,
    bank: '',
    contractNumber: '',
    validUntil: '',
    difference: null,
    notes: '',
    updatedAt: null,
  };
}

/**
 * @param {object} lead
 */
export function getTradeIn(lead = {}) {
  const raw = lead?.crm?.tradeIn;
  if (!raw || typeof raw !== 'object') return createEmptyTradeIn();
  return { ...createEmptyTradeIn(), ...raw };
}

/**
 * @param {object} tradeIn
 * @param {object} patch
 */
export function patchTradeIn(tradeIn = {}, patch = {}) {
  const next = {
    ...createEmptyTradeIn(),
    ...tradeIn,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  if (next.datValue != null && next.payoffAmount != null) {
    next.difference = Math.round((Number(next.datValue) - Number(next.payoffAmount)) * 100) / 100;
  }
  return next;
}

/**
 * @param {object} lead
 * @param {object[]} [documents]
 */
export function shouldShowTradeInSection(lead = {}, documents = null) {
  const tradeIn = getTradeIn(lead);
  if (tradeIn.vehicle?.trim() || tradeIn.datValue != null || tradeIn.payoffAmount != null) {
    return true;
  }
  const understanding = buildCustomerUnderstanding(lead);
  const labels = understanding?.verstaendnis?.labels ?? [];
  if (labels.some((label) => /inzahlungnahme/i.test(label))) return true;

  const docs = documents ?? getAkteDocuments(lead?.crm?.cleverUnterlagen);
  return docs.some((doc) => isTradeInDocumentCategory(doc.category));
}

/**
 * Vorschläge aus Dokument-Metadaten.
 * @param {object} doc
 * @param {object} tradeIn
 */
export function suggestTradeInFromDocument(doc, tradeIn = {}) {
  const patch = {};
  if (doc.referenceLabel?.trim() && !tradeIn.vehicle?.trim()) {
    patch.vehicle = doc.referenceLabel.trim();
  }
  const amount = parseEuroAmount(doc.description);
  if (amount != null) {
    if (doc.category === 'dat_bewertung' && tradeIn.datValue == null) {
      patch.datValue = amount;
    }
    if (doc.category === 'abloese' && tradeIn.payoffAmount == null) {
      patch.payoffAmount = amount;
    }
  }
  if (doc.category === 'abloese' && doc.description?.toLowerCase().includes('bank11') && !tradeIn.bank?.trim()) {
    patch.bank = 'Bank11';
  }
  return Object.keys(patch).length ? patchTradeIn(tradeIn, patch) : tradeIn;
}

/**
 * @param {number|null} datValue
 * @param {number|null} payoffAmount
 */
export function computeTradeDifference(datValue, payoffAmount) {
  if (datValue == null || payoffAmount == null) return null;
  return Math.round((Number(datValue) - Number(payoffAmount)) * 100) / 100;
}
