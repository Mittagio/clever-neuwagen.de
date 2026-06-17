/**
 * Selbstauskunft-Sessions (Kundenlink, localStorage)
 */
import { generateOfferAccessToken } from './offerAccessToken.js';
import { DOCUMENT_TTL_HOURS } from '../data/documentTypes.js';

const STORAGE_KEY = 'clever-neuwagen-self-disclosures';
const TTL_MS = DOCUMENT_TTL_HOURS * 60 * 60 * 1000;
let memoryStore = null;

function uid() {
  return `sd-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function loadAll() {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    }
  } catch {
    /* ignore */
  }
  return memoryStore ?? [];
}

function saveAll(sessions) {
  memoryStore = sessions;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    }
  } catch {
    /* ignore */
  }
}

export function buildSelfDisclosurePath(token) {
  return `/customer/self-disclosure/${encodeURIComponent(token)}`;
}

export function buildSelfDisclosureUrl(token) {
  const path = buildSelfDisclosurePath(token);
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${path}`;
  }
  return `https://clever-neuwagen.de${path}`;
}

export function createSelfDisclosureSession({
  leadId = '',
  offerCode = '',
  customerName = '',
  customerEmail = '',
  paymentType = 'leasing',
  dealerName = 'Autohaus Trinkle',
  vehicleTitle = '',
  vehicleConditions = '',
  isGewerbe = false,
}) {
  const now = new Date();
  const token = generateOfferAccessToken();
  const session = {
    id: uid(),
    token,
    leadId,
    offerCode,
    customerName: customerName.trim(),
    customerEmail: customerEmail.trim().toLowerCase(),
    paymentType,
    dealerName,
    vehicleTitle,
    vehicleConditions,
    isGewerbe,
    status: 'not_started',
    formData: null,
    uploads: {},
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + TTL_MS).toISOString(),
    openedAt: null,
    startedAt: null,
    submittedAt: null,
  };

  const all = loadAll();
  saveAll([session, ...all.filter((s) => s.token !== token)]);
  return session;
}

export function getSelfDisclosureByToken(token) {
  if (!token) return null;
  const normalized = token.trim().toUpperCase();
  return loadAll().find((s) => s.token?.toUpperCase() === normalized) ?? null;
}

export function getSelfDisclosuresForLead(leadId) {
  if (!leadId) return [];
  return loadAll()
    .filter((s) => s.leadId === leadId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function updateSession(token, patch) {
  const all = loadAll();
  const idx = all.findIndex((s) => s.token?.toUpperCase() === token.trim().toUpperCase());
  if (idx < 0) return null;
  const next = { ...all[idx], ...patch, updatedAt: new Date().toISOString() };
  all[idx] = next;
  saveAll(all);
  return next;
}

export function validateSelfDisclosureAccess(session) {
  if (!session) {
    return { valid: false, message: 'Link nicht gefunden' };
  }
  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    return { valid: false, message: 'Link abgelaufen' };
  }
  return { valid: true };
}

export function markSelfDisclosureOpened(token) {
  const session = getSelfDisclosureByToken(token);
  if (!session || session.openedAt) return session;
  return updateSession(token, {
    status: session.status === 'not_started' || session.status === 'link_sent' ? 'opened' : session.status,
    openedAt: new Date().toISOString(),
  });
}

export function markSelfDisclosureInProgress(token, formData = null) {
  const session = getSelfDisclosureByToken(token);
  if (!session) return null;
  return updateSession(token, {
    status: 'in_progress',
    startedAt: session.startedAt ?? new Date().toISOString(),
    formData: formData ?? session.formData,
  });
}

export function attachSelfDisclosureUpload(token, slotId, fileMeta) {
  const session = getSelfDisclosureByToken(token);
  if (!session) return null;
  return updateSession(token, {
    status: session.status === 'completed' ? 'completed' : 'in_progress',
    startedAt: session.startedAt ?? new Date().toISOString(),
    uploads: {
      ...session.uploads,
      [slotId]: {
        fileName: fileMeta.fileName,
        uploadedAt: fileMeta.uploadedAt ?? new Date().toISOString(),
        mimeType: fileMeta.mimeType,
        sizeBytes: fileMeta.sizeBytes,
        dataUrl: fileMeta.dataUrl ?? null,
      },
    },
  });
}

export function submitSelfDisclosure(token, formData) {
  const session = getSelfDisclosureByToken(token);
  if (!session) return null;
  return updateSession(token, {
    status: 'completed',
    formData,
    submittedAt: new Date().toISOString(),
  });
}

export function countSelfDisclosureUploads(session) {
  return Object.keys(session?.uploads ?? {}).length;
}
