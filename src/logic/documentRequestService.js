import { DOCUMENT_TTL_HOURS } from '../data/documentTypes.js';
import {
  DOCUMENT_REQUEST_STATUS,
  SLOT_STATUS,
  getOfferSlotLabel,
} from '../data/documentRequestTypes.js';
import { generateOfferAccessToken } from './offerAccessToken.js';

const STORAGE_KEY = 'clever-neuwagen-document-requests';
const TTL_MS = DOCUMENT_TTL_HOURS * 60 * 60 * 1000;

function uid(prefix = 'dr') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function loadAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    /* Fallback */
  }
  return [];
}

function saveAll(requests) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(requests));
}

function resolveRequestStatus(request) {
  if (new Date(request.expiresAt).getTime() <= Date.now()) {
    return DOCUMENT_REQUEST_STATUS.expired.id;
  }
  const done = request.slots.filter(
    (s) => s.status === SLOT_STATUS.uploaded || s.status === SLOT_STATUS.completed,
  ).length;
  if (done === 0) return DOCUMENT_REQUEST_STATUS.open.id;
  if (done >= request.slots.length) return DOCUMENT_REQUEST_STATUS.completed.id;
  return DOCUMENT_REQUEST_STATUS.partial.id;
}

export function buildUnterlagenPath(requestId, token) {
  const base = `/mein-bereich/unterlagen/${encodeURIComponent(requestId)}`;
  if (!token) return base;
  return `${base}?token=${encodeURIComponent(token)}`;
}

export function buildUnterlagenUrl(requestId, token) {
  const path = buildUnterlagenPath(requestId, token);
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${path}`;
  }
  return `https://clever-neuwagen.de${path}`;
}

export function createDocumentRequest({
  leadId,
  offerCode,
  customerEmail = '',
  customerName = '',
  slotTypes = [],
  dealerMessage = '',
}) {
  const now = new Date();
  const token = generateOfferAccessToken();
  const request = {
    id: uid(),
    leadId,
    offerCode,
    customerEmail: customerEmail.trim().toLowerCase(),
    customerName: customerName.trim(),
    dealerMessage: dealerMessage.trim(),
    accessToken: token,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + TTL_MS).toISOString(),
    status: DOCUMENT_REQUEST_STATUS.open.id,
    slots: slotTypes.map((type) => ({
      type,
      label: getOfferSlotLabel(type),
      kind: type === 'selbstauskunft' ? 'form' : 'upload',
      status: SLOT_STATUS.pending,
      uploadedDocId: null,
      uploadedAt: null,
      fileName: null,
    })),
  };
  request.status = resolveRequestStatus(request);

  const all = loadAll();
  saveAll([request, ...all.filter((r) => r.id !== request.id)]);
  return request;
}

export function getDocumentRequest(requestId) {
  if (!requestId) return null;
  const request = loadAll().find((r) => r.id === requestId) ?? null;
  if (!request) return null;
  return { ...request, status: resolveRequestStatus(request) };
}

export function getDocumentRequestsForLead(leadId) {
  if (!leadId) return [];
  return loadAll()
    .filter((r) => r.leadId === leadId)
    .map((r) => ({ ...r, status: resolveRequestStatus(r) }))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export function getOpenRequestForOffer(offerCode) {
  if (!offerCode) return null;
  const code = offerCode.toUpperCase();
  return loadAll()
    .map((r) => ({ ...r, status: resolveRequestStatus(r) }))
    .find(
      (r) => r.offerCode?.toUpperCase() === code
        && r.status !== DOCUMENT_REQUEST_STATUS.completed.id
        && r.status !== DOCUMENT_REQUEST_STATUS.expired.id,
    ) ?? null;
}

export function validateDocumentRequestAccess(request, token) {
  if (!request) {
    return { valid: false, code: 'NOT_FOUND', message: 'Anforderung nicht gefunden' };
  }
  if (resolveRequestStatus(request) === DOCUMENT_REQUEST_STATUS.expired.id) {
    return { valid: false, code: 'EXPIRED', message: 'Frist abgelaufen (48h)' };
  }
  if (!token) {
    return { valid: true, via: 'account' };
  }
  if (request.accessToken?.toUpperCase() !== token.trim().toUpperCase()) {
    return { valid: false, code: 'INVALID_TOKEN', message: 'Link ungültig' };
  }
  return { valid: true, via: 'token' };
}

export function markRequestSlotUploaded(requestId, slotType, docMeta = {}) {
  const all = loadAll();
  const idx = all.findIndex((r) => r.id === requestId);
  if (idx < 0) return null;

  const request = { ...all[idx] };
  request.slots = request.slots.map((slot) => {
    if (slot.type !== slotType) return slot;
    return {
      ...slot,
      status: SLOT_STATUS.uploaded,
      uploadedDocId: docMeta.id ?? slot.uploadedDocId,
      uploadedAt: docMeta.uploadedAt ?? new Date().toISOString(),
      fileName: docMeta.fileName ?? slot.fileName,
      expiresAt: docMeta.expiresAt ?? slot.expiresAt,
    };
  });
  request.status = resolveRequestStatus(request);
  all[idx] = request;
  saveAll(all);
  return request;
}

export function markRequestSlotCompleted(requestId, slotType, meta = {}) {
  const all = loadAll();
  const idx = all.findIndex((r) => r.id === requestId);
  if (idx < 0) return null;

  const request = { ...all[idx] };
  request.slots = request.slots.map((slot) => {
    if (slot.type !== slotType) return slot;
    return {
      ...slot,
      status: SLOT_STATUS.completed,
      uploadedAt: meta.completedAt ?? new Date().toISOString(),
      fileName: meta.fileName ?? 'Selbstauskunft (digital)',
    };
  });
  request.status = resolveRequestStatus(request);
  all[idx] = request;
  saveAll(all);
  return request;
}

export function getRequestProgress(request) {
  if (!request?.slots?.length) return { done: 0, total: 0, percent: 0 };
  const total = request.slots.length;
  const done = request.slots.filter(
    (s) => s.status === SLOT_STATUS.uploaded || s.status === SLOT_STATUS.completed,
  ).length;
  return { done, total, percent: Math.round((done / total) * 100) };
}

export function buildDocumentRequestEmailBody(request, url) {
  const slots = request.slots.map((s) => `• ${s.label}`).join('\n');
  return [
    `Guten Tag${request.customerName ? ` ${request.customerName}` : ''},`,
    '',
    'für Ihre Fahrzeugbestellung benötigen wir folgende Unterlagen:',
    '',
    slots,
    '',
    request.dealerMessage ? `${request.dealerMessage}\n` : '',
    `Bitte laden Sie die Dokumente innerhalb von ${DOCUMENT_TTL_HOURS} Stunden hoch:`,
    url,
    '',
    'Die Unterlagen werden verschlüsselt übermittelt und nach 48 Stunden automatisch gelöscht.',
    '',
    request.offerCode ? `Angebotsnummer: ${request.offerCode}` : null,
  ].filter(Boolean).join('\n');
}

export function buildDocumentRequestMailto(request, url) {
  const subject = `Unterlagen anfordern – ${request.offerCode ?? 'Ihr Angebot'}`;
  const body = buildDocumentRequestEmailBody(request, url);
  const to = request.customerEmail ?? '';
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function requestSlotsToLeadDocuments(request) {
  return request.slots
    .filter((s) => s.status === SLOT_STATUS.uploaded || s.status === SLOT_STATUS.completed)
    .map((s) => ({
      id: `${request.id}-${s.type}`,
      type: s.type,
      fileName: s.fileName ?? s.label,
      uploadedAt: s.uploadedAt,
      expiresAt: s.expiresAt ?? request.expiresAt,
      requestId: request.id,
    }));
}

export function formatRequestExpiry(expiresAt) {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return 'Abgelaufen';
  const h = Math.floor(diff / 3600000);
  if (h < 24) return `${h} Std. verbleibend`;
  const d = Math.floor(h / 24);
  return `${d} Tag${d !== 1 ? 'e' : ''} · 48h-Tresor`;
}
