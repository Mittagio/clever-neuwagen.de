import { formatDeliveryDisplay } from './dealerAiParser.js';

export const KUNDENHELFER_CHIPS = [
  'Hund',
  'Familie',
  'Kinder',
  'Kaffee schwarz',
  'Kaffee mit Milch',
  'mag rote Autos',
  'mag dunkle Autos',
  'entscheidet mit Partner',
  'braucht Auto sofort',
  'Unfall / Ersatzfahrzeug',
  'Leasing läuft aus',
  'bevorzugt WhatsApp',
  'lieber E-Mail',
  'Preis sehr wichtig',
  'will Probefahrt',
  'Gewerbekunde',
  'Inzahlungnahme vorhanden',
];

export function parseKundenhelferNotes(notes = '') {
  return String(notes)
    .split(/[,;]\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function joinKundenhelferNotes(parts = []) {
  const unique = [];
  for (const part of parts) {
    const trimmed = String(part).trim();
    if (!trimmed) continue;
    if (!unique.includes(trimmed)) unique.push(trimmed);
  }
  return unique.join(', ');
}

export function toggleKundenhelferChip(notes, chip) {
  const parts = parseKundenhelferNotes(notes);
  if (parts.includes(chip)) {
    return joinKundenhelferNotes(parts.filter((p) => p !== chip));
  }
  return joinKundenhelferNotes([...parts, chip]);
}

export function buildKundenhelferCardSummary(notes = '', voiceMemoCount = 0) {
  const parts = parseKundenhelferNotes(notes);
  if (!parts.length) {
    return voiceMemoCount > 0 ? `${voiceMemoCount} Memo${voiceMemoCount > 1 ? 's' : ''}` : 'Noch keine Notizen';
  }
  if (parts.length > 3) {
    return `${parts.length} Notizen`;
  }
  return parts.join(' · ');
}

export function buildWishDetailSubline(fields = {}) {
  const pt = fields.paymentType ?? 'unknown';
  const parts = [];

  if (pt === 'cash') {
    if (fields.desiredPrice) {
      parts.push(`Budget bis ${Number(fields.desiredPrice).toLocaleString('de-DE')} €`);
    }
    const delivery = formatDeliveryDisplay(fields);
    parts.push(delivery === 'offen' ? 'Übergabe offen' : `Übergabe ${delivery}`);
    return parts.filter(Boolean).join(' · ') || null;
  }

  if (fields.termMonths) {
    parts.push(`${fields.termMonths} Monate`);
  }
  if (fields.mileagePerYear) {
    parts.push(`${Number(fields.mileagePerYear).toLocaleString('de-DE')} km`);
  }
  if (fields.desiredRate && pt !== 'cash') {
    parts.push(`bis ${fields.desiredRate} €/Monat`);
  }

  if (!parts.length && pt === 'unknown') return null;
  return parts.join(' · ') || null;
}

export function formatMemoDuration(seconds = 0) {
  const s = Math.max(0, Math.round(seconds));
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

export function formatMemoWhen(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startThat = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((startToday - startThat) / 86400000);
  const time = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 0) return `Heute ${time}`;
  if (diffDays === 1) return `Gestern ${time}`;
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }) + ` ${time}`;
}

/** Kompakte Memo-Zeile: „Memo · Heute 14:32 · 18 Sek.“ */
export function formatMemoLine(memo) {
  const when = formatMemoWhen(memo?.createdAt);
  const secs = Math.max(0, Math.round(memo?.durationSec ?? 0));
  return `Memo · ${when} · ${secs} Sek.`;
}

export function createVoiceMemoId() {
  return `memo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export async function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
