/** Dokumente pro Angebot (Demo – Metadaten in localStorage, 48h-Tresor) */

import { DOCUMENT_TTL_HOURS } from '../data/documentTypes.js';
import { getOfferSlotLabel } from '../data/documentRequestTypes.js';

const PREFIX = 'clever-neuwagen-offer-docs-';
const TTL_MS = DOCUMENT_TTL_HOURS * 60 * 60 * 1000;

function load(offerCode) {
  try {
    const raw = localStorage.getItem(`${PREFIX}${offerCode}`);
    if (raw) return JSON.parse(raw);
  } catch {
    /* Fallback */
  }
  return [];
}

function save(offerCode, docs) {
  localStorage.setItem(`${PREFIX}${offerCode}`, JSON.stringify(docs));
}

export function getOfferDocuments(offerCode) {
  return load(offerCode);
}

export function addOfferDocument(offerCode, meta) {
  const uploadedAt = new Date().toISOString();
  const doc = {
    id: `odoc-${Date.now()}`,
    offerCode,
    fileName: meta.fileName,
    fileSize: meta.fileSize ?? 0,
    mimeType: meta.mimeType ?? 'application/octet-stream',
    slotType: meta.slotType ?? null,
    requestId: meta.requestId ?? null,
    slotLabel: meta.slotType ? getOfferSlotLabel(meta.slotType) : null,
    uploadedAt,
    expiresAt: new Date(Date.now() + TTL_MS).toISOString(),
  };
  const next = [doc, ...load(offerCode)];
  save(offerCode, next);
  return doc;
}

export function getDocumentsByRequest(requestId) {
  if (!requestId) return [];
  const results = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!key?.startsWith(PREFIX)) continue;
    try {
      const docs = JSON.parse(localStorage.getItem(key));
      if (Array.isArray(docs)) {
        results.push(...docs.filter((d) => d.requestId === requestId));
      }
    } catch {
      /* ignorieren */
    }
  }
  return results;
}
