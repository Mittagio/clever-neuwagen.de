/**
 * Notizzettel-Darstellung: bei vielen Enrichment-Chips bündeln.
 * Gesprächswünsche bleiben einzeln sichtbar.
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

const MAX_LOOSE_ENRICHMENT = 2;

function setFrom(options, pick = (o) => o.label) {
  return new Set(options.map(pick).filter(Boolean));
}

const TIMING = setFrom(VEHICLE_NEED_TIMING_OPTIONS);
const PAYMENT = new Set([
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
 * @param {string} label
 * @returns {'wish'|'timing'|'payment'|'equipment'}
 */
export function classifyNotepadLabel(label) {
  const l = String(label ?? '');
  if (TIMING.has(l)) return 'timing';
  if (PAYMENT.has(l) || /^Wunschrate\s+\d/.test(l) || /€\/Monat|Kondition/i.test(l)) return 'payment';
  if (EQUIPMENT.has(l)) return 'equipment';
  return 'wish';
}

/**
 * @param {string[]} labels
 * @returns {Array<{ type: 'chip'|'bundle', id: string, label?: string, icon?: string, count?: number, labels?: string[] }>}
 */
export function buildBundledNotepadItems(labels = []) {
  const list = [...(labels ?? [])];
  const wishes = [];
  const timing = [];
  const payment = [];
  const equipment = [];

  for (const label of list) {
    const kind = classifyNotepadLabel(label);
    if (kind === 'timing') timing.push(label);
    else if (kind === 'payment') payment.push(label);
    else if (kind === 'equipment') equipment.push(label);
    else wishes.push(label);
  }

  const items = wishes.map((label) => ({ type: 'chip', id: `chip:${label}`, label }));

  const enrichCount = timing.length + payment.length + equipment.length;
  const shouldBundle = enrichCount > MAX_LOOSE_ENRICHMENT
    || equipment.length >= 3
    || payment.length >= 2;

  if (!shouldBundle) {
    for (const label of [...timing, ...payment, ...equipment]) {
      items.push({ type: 'chip', id: `chip:${label}`, label });
    }
    return items;
  }

  if (timing.length === 1) {
    items.push({ type: 'chip', id: `chip:${timing[0]}`, label: timing[0] });
  } else if (timing.length > 1) {
    items.push({
      type: 'bundle',
      id: 'bundle:timing',
      icon: '📅',
      count: timing.length,
      title: 'Verfügbarkeit',
      labels: timing,
    });
  }

  if (payment.length) {
    items.push({
      type: 'bundle',
      id: 'bundle:payment',
      icon: '💶',
      count: payment.length,
      title: 'Konditionen',
      labels: payment,
    });
  }

  if (equipment.length) {
    items.push({
      type: 'bundle',
      id: 'bundle:equipment',
      icon: '💺',
      count: equipment.length,
      title: 'Ausstattung',
      labels: equipment,
    });
  }

  return items;
}
