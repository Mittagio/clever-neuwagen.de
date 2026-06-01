import { DOCUMENT_TTL_HOURS } from '../data/documentTypes.js';

export function formatExpiryCountdown(expiresAt, now = Date.now()) {
  if (!expiresAt) return '–';
  const ms = new Date(expiresAt).getTime() - now;
  if (ms <= 0) return 'Abgelaufen';

  const totalHours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));

  if (totalHours >= 1) {
    return `${totalHours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

export function getDocumentStatus(doc) {
  if (doc.deletedAt) return { label: 'Gelöscht', emoji: '⚪', tone: 'deleted' };
  const ms = new Date(doc.expiresAt).getTime() - Date.now();
  if (ms <= 0) return { label: 'Abgelaufen', emoji: '🟠', tone: 'expired' };
  return { label: 'Aktiv', emoji: '🟢', tone: 'active' };
}

export function formatGermanDateTime(iso) {
  if (!iso) return '–';
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export { DOCUMENT_TTL_HOURS };
