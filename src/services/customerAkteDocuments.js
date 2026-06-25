/**
 * Strukturierte Dokumente in der Kundenakte (neben Slot-Checkliste).
 */
import { isAcceptedUnterlagenFile } from './cleverUnterlagen.js';

export const DOCUMENT_CATEGORIES = [
  { id: 'dat_bewertung', label: 'DAT-Bewertung' },
  { id: 'fahrzeugschein', label: 'Fahrzeugschein' },
  { id: 'abloese', label: 'Ablösebestätigung' },
  { id: 'bank', label: 'Bankunterlagen' },
  { id: 'ausweis', label: 'Ausweis' },
  { id: 'gehaltsnachweis', label: 'Gehaltsnachweis' },
  { id: 'selbstauskunft', label: 'Selbstauskunft' },
  { id: 'bankverbindung', label: 'Bankverbindung' },
  { id: 'kaufvertrag', label: 'Kaufvertrag' },
  { id: 'sonstiges', label: 'Sonstiges' },
];

export const DOCUMENT_REFERENCE_TYPES = [
  { id: 'customer', label: 'Kunde' },
  { id: 'vehicle', label: 'Fahrzeug' },
  { id: 'offer', label: 'Angebot' },
  { id: 'trade_in', label: 'Inzahlungnahme' },
];

const CATEGORY_BY_ID = Object.fromEntries(DOCUMENT_CATEGORIES.map((c) => [c.id, c]));
const TRADE_IN_CATEGORIES = new Set(['dat_bewertung', 'abloese', 'fahrzeugschein']);

function createDocId() {
  return `akte-doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * @param {object} unterlagen
 */
export function getAkteDocuments(unterlagen = {}) {
  const docs = unterlagen?.documents;
  return Array.isArray(docs) ? docs : [];
}

/**
 * @param {object} lead
 */
export function countAkteDocuments(lead = {}) {
  const slotItems = Object.values(lead?.crm?.cleverUnterlagen?.items ?? {})
    .filter((item) => item?.dataUrl || item?.fileName);
  const structured = getAkteDocuments(lead?.crm?.cleverUnterlagen);
  return slotItems.length + structured.length;
}

/**
 * @param {number} count
 */
export function formatDocumentsCompactLabel(count = 0) {
  if (count <= 0) return 'Keine Dokumente';
  if (count === 1) return '1 Dokument';
  return `${count} Dokumente`;
}

/**
 * @param {string} categoryId
 */
export function getDocumentCategoryLabel(categoryId) {
  return CATEGORY_BY_ID[categoryId]?.label ?? 'Sonstiges';
}

/**
 * @param {string} categoryId
 */
export function isTradeInDocumentCategory(categoryId) {
  return TRADE_IN_CATEGORIES.has(categoryId);
}

/**
 * @param {object} unterlagen
 * @param {File} file
 * @param {object} meta
 */
export function attachAkteDocument(unterlagen, file, meta = {}) {
  return new Promise((resolve, reject) => {
    if (!isAcceptedUnterlagenFile(file)) {
      reject(new Error('invalid_file'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const doc = {
        id: createDocId(),
        fileName: file.name,
        category: meta.category ?? 'sonstiges',
        referenceType: meta.referenceType ?? 'customer',
        referenceLabel: String(meta.referenceLabel ?? '').trim(),
        description: String(meta.description ?? '').trim(),
        uploadedAt: new Date().toISOString(),
        sizeBytes: file.size,
        mimeType: file.type,
        dataUrl: reader.result,
      };
      resolve({
        ...unterlagen,
        documents: [doc, ...getAkteDocuments(unterlagen)],
        updatedAt: new Date().toISOString(),
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * @param {object} unterlagen
 * @param {string} docId
 * @param {File} file
 */
export function replaceAkteDocumentFile(unterlagen, docId, file) {
  return new Promise((resolve, reject) => {
    if (!isAcceptedUnterlagenFile(file)) {
      reject(new Error('invalid_file'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const docs = getAkteDocuments(unterlagen).map((doc) => {
        if (doc.id !== docId) return doc;
        return {
          ...doc,
          fileName: file.name,
          uploadedAt: new Date().toISOString(),
          sizeBytes: file.size,
          mimeType: file.type,
          dataUrl: reader.result,
        };
      });
      resolve({
        ...unterlagen,
        documents: docs,
        updatedAt: new Date().toISOString(),
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * @param {object} unterlagen
 * @param {string} docId
 */
export function removeAkteDocument(unterlagen, docId) {
  return {
    ...unterlagen,
    documents: getAkteDocuments(unterlagen).filter((doc) => doc.id !== docId),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * @param {object} unterlagen
 * @param {string} docId
 * @param {object} patch
 */
export function updateAkteDocument(unterlagen, docId, patch = {}) {
  return {
    ...unterlagen,
    documents: getAkteDocuments(unterlagen).map((doc) => (
      doc.id === docId ? { ...doc, ...patch } : doc
    )),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * @param {string} text
 */
export function parseEuroAmount(text = '') {
  const match = String(text).match(/(\d{1,3}(?:\.\d{3})*(?:,\d{2})?|\d+(?:,\d{2})?)\s*€?/);
  if (!match) return null;
  const normalized = match[1].replace(/\./g, '').replace(',', '.');
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}
