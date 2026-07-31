/**
 * Deterministische Relative-Datetime-Auflösung für Clever Seller Turns.
 * Nutzt parseAppointmentDateTime; Clock injizierbar für stabile Tests.
 */
import {
  parseAppointmentDateTime,
  formatAppointmentWhen,
} from '../dealer/sellerAppointmentAssistFlow.js';

const DEFAULT_TIMEZONE = 'Europe/Berlin';

/**
 * @param {string} sellerInput
 * @param {{ now?: Date|string|number, timeZone?: string, previousStartsAt?: string|null }} [options]
 */
export function resolveRelativeDateTime(sellerInput = '', options = {}) {
  const now = options.now != null ? new Date(options.now) : new Date();
  const timeZone = options.timeZone || DEFAULT_TIMEZONE;
  const previousStartsAt = options.previousStartsAt || null;
  const raw = String(sellerInput || '').trim();

  let parsed = parseAppointmentDateTime(raw, now);

  // Follow-up: nur Uhrzeit → Datum vom Pending behalten
  if (parsed.missing === 'date' && parsed.partialTime && previousStartsAt) {
    const base = new Date(previousStartsAt);
    base.setHours(parsed.partialTime.hour, parsed.partialTime.minute, 0, 0);
    parsed = { startAt: base.toISOString(), missing: null };
  }

  // Follow-up: nur Wochentag/Datum → Uhrzeit vom Pending behalten
  if (parsed.missing === 'time' && parsed.partialDate && previousStartsAt) {
    const prev = new Date(previousStartsAt);
    const base = new Date(parsed.partialDate);
    base.setHours(prev.getHours(), prev.getMinutes(), 0, 0);
    parsed = { startAt: base.toISOString(), missing: null };
  }

  // „lieber 16 Uhr“ / „um 16“ ohne „Uhr“-Wort
  if (!parsed.startAt && previousStartsAt) {
    const onlyTime = raw.match(/\b(?:lieber|besser|eher|dann)?\s*(?:um\s*)?(\d{1,2})(?:[:.](\d{2}))?\s*(?:uhr)?\s*$/i);
    if (onlyTime && !/\b(montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag|morgen|heute)\b/i.test(raw)) {
      const base = new Date(previousStartsAt);
      base.setHours(Number(onlyTime[1]), onlyTime[2] != null ? Number(onlyTime[2]) : 0, 0, 0);
      parsed = { startAt: base.toISOString(), missing: null };
    }
  }

  if (!parsed.startAt) {
    return {
      ok: false,
      startsAt: null,
      missing: parsed.missing || 'datetime',
      partialTime: parsed.partialTime || null,
      partialDate: parsed.partialDate || null,
      dateLabel: null,
      timeLabel: null,
      whenLabel: null,
      timeZone,
      source: 'deterministic_datetime_resolver',
      phrase: raw,
      now: now.toISOString(),
    };
  }

  const startsAtDate = new Date(parsed.startAt);
  const dateLabel = formatDateLongDe(startsAtDate);
  const timeLabel = formatTimeDe(startsAtDate);
  const shortDateLabel = formatDateShortDe(startsAtDate);

  return {
    ok: true,
    startsAt: parsed.startAt,
    missing: null,
    dateLabel,
    shortDateLabel,
    timeLabel,
    whenLabel: formatAppointmentWhen(parsed.startAt),
    hour: startsAtDate.getHours(),
    minute: startsAtDate.getMinutes(),
    timeZone,
    source: 'deterministic_datetime_resolver',
    phrase: raw,
    now: now.toISOString(),
  };
}

/**
 * Zwei relative Termine (z. B. „Montag und Dienstag um 15 Uhr“).
 * @param {string} sellerInput
 * @param {{ now?: Date|string|number, timeZone?: string }} [options]
 */
export function resolveMultipleRelativeDateTimes(sellerInput = '', options = {}) {
  const raw = String(sellerInput || '');
  const dual = raw.match(
    /\b(montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag)\b.{0,40}\b(?:und|oder)\b.{0,20}\b(montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag)\b/i,
  );
  if (!dual) {
    const single = resolveRelativeDateTime(raw, options);
    return single.ok ? [single] : [];
  }

  const timeMatch = raw.match(/\b(?:um\s*)?(\d{1,2})(?:[:.](\d{2}))?\s*uhr\b/i)
    || raw.match(/\bum\s+(\d{1,2})\b/);
  const timePhrase = timeMatch
    ? `um ${timeMatch[1]}${timeMatch[2] ? `:${timeMatch[2]}` : ''} Uhr`
    : 'um 15 Uhr';

  const first = resolveRelativeDateTime(`${dual[1]} ${timePhrase}`, options);
  const second = resolveRelativeDateTime(`${dual[2]} ${timePhrase}`, options);
  return [first, second].filter((r) => r.ok);
}

function formatDateLongDe(d) {
  try {
    return d.toLocaleDateString('de-DE', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

function formatDateShortDe(d) {
  try {
    return d.toLocaleDateString('de-DE', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

function formatTimeDe(d) {
  try {
    return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}
