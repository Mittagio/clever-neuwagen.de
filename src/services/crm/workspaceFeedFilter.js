/**
 * Ruhige Filterzeile über dem Kundenverlauf.
 * Alles bleibt Standard – Filter nur eingrenzen, nicht Modulwelten öffnen.
 */
import { MESSAGE_KIND } from './customerMessageService.js';

export const WORKSPACE_FEED_FILTERS = [
  { id: 'all', label: 'Alles' },
  { id: 'messages', label: 'Nachrichten' },
  { id: 'offers', label: 'Angebote' },
  { id: 'documents', label: 'Dokumente' },
  { id: 'appointments', label: 'Termine' },
];

const OFFER_KINDS = new Set([
  MESSAGE_KIND.OFFER_CARD,
]);

const DOCUMENT_KINDS = new Set([
  MESSAGE_KIND.DOCUMENT_CARD,
  MESSAGE_KIND.DOCUMENT_REQUEST,
  MESSAGE_KIND.SELF_DISCLOSURE_CARD,
  MESSAGE_KIND.CHECKLIST_CARD,
  MESSAGE_KIND.SYSTEM_STATUS,
]);

const APPOINTMENT_KINDS = new Set([
  MESSAGE_KIND.APPOINTMENT_CARD,
]);

const MESSAGE_KINDS = new Set([
  MESSAGE_KIND.TEXT,
  MESSAGE_KIND.CLEVER_MESSAGE,
]);

/**
 * @param {object} item
 * @returns {'messages'|'offers'|'documents'|'appointments'|'other'}
 */
export function classifyWorkspaceFeedItem(item = {}) {
  const kind = item.kind || MESSAGE_KIND.TEXT;
  if (OFFER_KINDS.has(kind)) return 'offers';
  if (APPOINTMENT_KINDS.has(kind)) return 'appointments';
  if (DOCUMENT_KINDS.has(kind)) {
    if (kind === MESSAGE_KIND.SYSTEM_STATUS) {
      const blob = `${item.text || ''} ${item.payload?.title || ''} ${item.payload?.statusLabel || ''}`.toLowerCase();
      if (/termin|probefahrt|beratung/.test(blob)) return 'appointments';
      if (/angebot/.test(blob)) return 'offers';
      return 'documents';
    }
    return 'documents';
  }
  if (MESSAGE_KINDS.has(kind)) return 'messages';
  return 'other';
}

/**
 * @param {object[]} items
 * @param {string} filterId
 */
export function filterWorkspaceFeedItems(items = [], filterId = 'all') {
  const list = Array.isArray(items) ? items : [];
  if (!filterId || filterId === 'all') return list;
  return list.filter((item) => classifyWorkspaceFeedItem(item) === filterId);
}

/**
 * @param {object[]} items
 * @returns {Record<string, number>}
 */
export function countWorkspaceFeedFilters(items = []) {
  const counts = {
    all: 0,
    messages: 0,
    offers: 0,
    documents: 0,
    appointments: 0,
  };
  const list = Array.isArray(items) ? items : [];
  counts.all = list.length;
  for (const item of list) {
    const bucket = classifyWorkspaceFeedItem(item);
    if (counts[bucket] != null) counts[bucket] += 1;
  }
  return counts;
}
