import { formatHistoryWhen } from './dealerAiLeadCrm.js';

const SYSTEM_TEXT_PATTERNS = [
  /^Clever Kundenhelfer aktualisiert/i,
  /^Clever empfahl:/i,
  /^Clever-Empfehlung befolgt:/i,
  /^Status intern geändert/i,
  /^Nachfassen geplant:/i,
  /^Rate aktualisiert:/i,
];

const CONTACT_TEXT_PATTERNS = [
  /e-mail gesendet/i,
  /whatsapp/i,
  /anruf/i,
  /telefon/i,
  /rückruf/i,
  /angebot gesendet/i,
  /angebot geöffnet/i,
  /angebot versendet/i,
  /angebot erstellt/i,
  /kunde hat.*geöffnet/i,
  /probefahrt/i,
  /status:\s*angebot/i,
];

const CONTACT_TYPES = new Set(['communication', 'offer', 'offer_dialog']);

export function sortHistoryNewestFirst(history = []) {
  return [...history].sort((a, b) => new Date(b.at ?? 0) - new Date(a.at ?? 0));
}

export function isSystemHistoryEntry(entry = {}) {
  if (!entry) return true;
  if (entry.type === 'system') return true;
  const text = String(entry.text ?? '').trim();
  return SYSTEM_TEXT_PATTERNS.some((pattern) => pattern.test(text));
}

export function isCustomerContactEntry(entry = {}) {
  if (!entry || isSystemHistoryEntry(entry)) return false;

  if (entry.channel) return true;

  const text = String(entry.text ?? '');

  if (entry.type === 'communication') return true;

  if (entry.type === 'status') {
    return /angebot|versendet|geöffnet|probefahrt/i.test(text);
  }

  if (CONTACT_TYPES.has(entry.type)) {
    if (/rate aktualisiert/i.test(text)) return false;
    return CONTACT_TEXT_PATTERNS.some((pattern) => pattern.test(text));
  }

  return CONTACT_TEXT_PATTERNS.some((pattern) => pattern.test(text));
}

export function getContactActionLabel(entry = {}) {
  if (entry.channel === 'whatsapp') return 'WhatsApp';
  if (entry.channel === 'email') return 'E-Mail';
  if (entry.channel === 'call' || entry.channel === 'phone') return 'Anruf';

  const text = String(entry.text ?? '');
  if (/whatsapp/i.test(text)) return 'WhatsApp';
  if (/e-mail/i.test(text)) return 'E-Mail';
  if (/anruf|telefon|rückruf/i.test(text)) return 'Anruf';
  if (/geöffnet/i.test(text)) return 'Angebot geöffnet';
  if (/gesendet|versendet/i.test(text)) return 'Angebot gesendet';
  if (/angebot erstellt/i.test(text)) return 'Angebot erstellt';
  if (/probefahrt/i.test(text)) return 'Probefahrt';
  if (/status:\s*angebot versendet/i.test(text)) return 'Angebot gesendet';

  const trimmed = text.trim();
  if (!trimmed) return 'Kontakt';
  return trimmed.length > 42 ? `${trimmed.slice(0, 39)}…` : trimmed;
}

export function formatRelativeContactWhen(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  const now = new Date();
  const time = date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === now.toDateString()) return `Heute · ${time}`;
  if (date.toDateString() === yesterday.toDateString()) return `Gestern · ${time}`;
  return formatHistoryWhen(iso);
}

/**
 * Kompakte Kommunikationszeile für die Hauptansicht (nur echte Kundenkontakte).
 * @returns {{ line: string, entry: object } | null}
 */
export function getCommunicationSummary(history = []) {
  const latestContact = sortHistoryNewestFirst(history).find(isCustomerContactEntry);
  if (!latestContact) return null;

  const whenLabel = formatRelativeContactWhen(latestContact.at);
  const actionLabel = getContactActionLabel(latestContact);

  return {
    line: `Letzte Aktion: ${actionLabel} · ${whenLabel}`,
    entry: latestContact,
  };
}

export function getHistoryEntryCount(history = []) {
  return Array.isArray(history) ? history.length : 0;
}
