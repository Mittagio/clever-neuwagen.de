/** Dokumente pro Angebot (Demo – Metadaten in localStorage) */

const PREFIX = 'clever-neuwagen-offer-docs-';

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
  const doc = {
    id: `odoc-${Date.now()}`,
    offerCode,
    fileName: meta.fileName,
    fileSize: meta.fileSize ?? 0,
    mimeType: meta.mimeType ?? 'application/octet-stream',
    uploadedAt: new Date().toISOString(),
  };
  const next = [doc, ...load(offerCode)];
  save(offerCode, next);
  return doc;
}
