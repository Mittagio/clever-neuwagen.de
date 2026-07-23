/**
 * Smart Notizzettel – reine DARSTELLUNGSLOGIK.
 * Wahrheit bleibt in session.notepadLabels / needProfile.
 *
 * Leitsatz: Erkennen. Kurz zeigen. Sauber einsortieren.
 */

import { handoffEquipmentLabels } from './wishHandoffEquipment.js';
import {
  ACQUISITION_OPTIONS,
  DOWN_PAYMENT_OPTIONS,
  FINANCE_BALLOON_OPTIONS,
  FINANCE_TERM_OPTIONS,
  HANDOFF_TRADE_IN_OPTIONS,
  LEASING_MILEAGE_OPTIONS,
  LEASING_TERM_OPTIONS,
  PURCHASE_SPECIAL_OPTIONS,
  VEHICLE_NEED_TIMING_OPTIONS,
} from './wishHandoffEnrichment.js';

/** Maximal direkt sichtbare Kernchips in der Memory-Bar. */
export const MAX_CORE_VISIBLE = 5;

function setFrom(options, pick = (o) => o.label) {
  return new Set(options.map(pick).filter(Boolean));
}

const TIMING = setFrom(VEHICLE_NEED_TIMING_OPTIONS);
const PAYMENT_EXACT = new Set([
  ...ACQUISITION_OPTIONS.filter((o) => o.id !== 'open').map((o) => o.label),
  ...PURCHASE_SPECIAL_OPTIONS.map((o) => o.label),
  ...LEASING_TERM_OPTIONS.map((o) => o.label),
  ...LEASING_MILEAGE_OPTIONS.map((o) => o.label),
  ...DOWN_PAYMENT_OPTIONS.map((o) => o.label),
  ...FINANCE_TERM_OPTIONS.map((o) => o.label),
  ...FINANCE_BALLOON_OPTIONS.map((o) => o.label),
  ...HANDOFF_TRADE_IN_OPTIONS.map((o) => o.notepadLabel),
]);
const EQUIPMENT = new Set(handoffEquipmentLabels());

/**
 * Relevanz für direkt sichtbare Kernchips (höher = wichtiger).
 * 0 = kein Kernwunsch → Detailgruppe.
 */
export function corePriority(label) {
  const l = String(label ?? '').trim();
  if (!l) return 0;

  if (/\binteressant\b/i.test(l)) return 100;
  if (/anhängelast|zuglast|mindestens\s+\d|≥\s*\d|>=\s*\d|\d[\d.\s]*kg\s*[–\-]\s*\d/i.test(l)) {
    return 96;
  }
  if (/^(Elektro|Hybrid|Plug-?in(?:-Hybrid)?|Diesel|Benzin|Verbrenner)$/i.test(l)) return 95;
  if (/^(SUV|Van|Kombi|Kleinwagen|Limousine|Pickup)$/i.test(l)) return 92;
  if (/\b\d+\s*Sitze?\b/i.test(l)) return 90;
  if (/\breichweite\b|\bwltp\b/i.test(l) && !/^\d[\d.]*\s*km$/i.test(l)) return 88;
  if (/^EV\d|^Sportage|^Sorento|^Ceed|^Niro|^Picanto|^Carnival/i.test(l)) return 85;
  if (/^Allrad$|^Automatik$|^Schaltgetriebe$/i.test(l)) return 72;
  if (/Ladelänge|großer Kofferraum|2\s*m/i.test(l)) return 68;
  if (/^Familie$|^Zweitwagen$|^Stadt$|^Kurzstrecke$|^Langstrecke$/i.test(l)) return 55;
  return 0;
}

/**
 * @param {string} label
 * @returns {'core'|'timing'|'payment'|'equipment'|'wish'}
 */
export function classifyNotepadLabel(label) {
  const l = String(label ?? '').trim();
  if (!l) return 'wish';

  if (TIMING.has(l)) return 'timing';

  if (
    PAYMENT_EXACT.has(l)
    || /^Wunschrate\s+\d/i.test(l)
    || /€\s*\/\s*Monat|Kondition/i.test(l)
    || /^Budget\b/i.test(l)
    || /^(Leasing|Finanzierung|Kauf)$/i.test(l)
    || /\b(Anzahlung|Sonderzahlung|Restwert|Kaufoption|Übernahme geplant|Inzahlungnahme)\b/i.test(l)
    || /^\d{1,2}\s*Monate$/i.test(l)
    || /^\d{1,2}(\.\d{3})?\s*km(\s*\/\s*Jahr)?$/i.test(l)
    || /Jahreskilometer|km\/Jahr/i.test(l)
  ) {
    return 'payment';
  }

  if (
    EQUIPMENT.has(l)
    || /sitzheizung|lenkradheizung|wärmepumpe|panorama|head-?up|hud\b|rückfahrkamera|360°|kamera|parkassistent|parksensor|navigationssystem|\bnavi\b|carplay|android auto|led-scheinwerfer|matrix-led|totwinkel|spurhalte|notbrems|abstandstempomat|tempomat|klimaautomatik|keyless|memory-sitze|soundsystem|isofix|anhängerkupplung|dachreling|fahrradträger|sicherheitssysteme|sitzkomfort|ambiente/i.test(l)
  ) {
    return 'equipment';
  }

  if (corePriority(l) >= 55) return 'core';
  return 'wish';
}

/**
 * @param {string[]} labels
 */
function partitionLabels(labels = []) {
  const cores = [];
  const timing = [];
  const payment = [];
  const equipment = [];
  const wishes = [];

  for (const label of labels ?? []) {
    const kind = classifyNotepadLabel(label);
    if (kind === 'timing') timing.push(label);
    else if (kind === 'payment') payment.push(label);
    else if (kind === 'equipment') equipment.push(label);
    else if (kind === 'core') cores.push(label);
    else wishes.push(label);
  }

  cores.sort((a, b) => corePriority(b) - corePriority(a));
  return { cores, timing, payment, equipment, wishes };
}

/**
 * @param {string[]} labels
 * @returns {Array<{ type: 'chip'|'bundle', id: string, label?: string, icon?: string, count?: number, title?: string, labels?: string[] }>}
 */
export function buildBundledNotepadItems(labels = []) {
  const { cores, timing, payment, equipment, wishes } = partitionLabels(labels);

  const visibleCores = cores.slice(0, MAX_CORE_VISIBLE);
  const overflowCores = cores.slice(MAX_CORE_VISIBLE);

  /** Detailwünsche: Ausstattung + weiche Wünsche + Kern-Overflow */
  const wishGroup = [...equipment, ...wishes, ...overflowCores];

  const items = visibleCores.map((label) => ({
    type: 'chip',
    id: `chip:${label}`,
    label,
  }));

  const bundlePayment = payment.length >= 2;
  const bundleWishes = wishGroup.length >= 2;
  const bundleTiming = timing.length >= 2;

  if (bundleTiming) {
    items.push({
      type: 'bundle',
      id: 'bundle:timing',
      icon: '📅',
      count: timing.length,
      title: 'Planung',
      labels: timing,
    });
  } else {
    for (const label of timing) {
      items.push({ type: 'chip', id: `chip:${label}`, label });
    }
  }

  if (bundlePayment) {
    items.push({
      type: 'bundle',
      id: 'bundle:payment',
      icon: '💶',
      count: payment.length,
      title: 'Konditionen',
      labels: payment,
    });
  } else {
    for (const label of payment) {
      items.push({ type: 'chip', id: `chip:${label}`, label });
    }
  }

  if (bundleWishes) {
    items.push({
      type: 'bundle',
      id: 'bundle:wishes',
      icon: '✨',
      count: wishGroup.length,
      title: 'Wünsche',
      labels: wishGroup,
    });
  } else {
    for (const label of wishGroup) {
      items.push({ type: 'chip', id: `chip:${label}`, label });
    }
  }

  return items;
}

/**
 * Strukturierte Zusammenfassung für Wunschübergabe / Complete-Screen.
 * Display-only – Labels unverändert.
 *
 * @param {string[]} labels
 * @returns {{
 *   vehicle: string[],
 *   conditions: string[],
 *   wishes: string[],
 *   timing: string[],
 * }}
 */
export function buildStructuredNotepadSummary(labels = []) {
  const { cores, timing, payment, equipment, wishes } = partitionLabels(labels);
  return {
    vehicle: cores,
    conditions: payment,
    wishes: [...equipment, ...wishes],
    timing,
  };
}

/**
 * @param {string} label
 * @param {ReturnType<typeof buildBundledNotepadItems>} items
 */
export function findBundleForLabel(label, items = []) {
  return items.find(
    (item) => item.type === 'bundle' && (item.labels ?? []).includes(label),
  ) ?? null;
}
