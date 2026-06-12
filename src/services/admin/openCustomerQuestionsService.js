/**
 * Offene Kundenfragen – wenn Stammdaten fehlen.
 * Persistenz lokal (Admin); später Server-API.
 */
import { VEHICLE_QUESTION_INTENT_BY_ID } from '../../data/vehicleQuestionCatalog.js';
import { applyFieldAnswer } from './vehicleStammdatenOverrideService.js';

const STORAGE_KEY = 'clever-open-customer-questions';

function uid() {
  return `ocq-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function readAll() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeAll(items) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent('clever-open-questions-changed'));
  } catch {
    // ignore quota
  }
}

/**
 * @param {object} params
 */
export function submitOpenCustomerQuestion({
  query,
  modelKey,
  intentId = null,
  category = null,
  field = null,
}) {
  const normalizedQuery = String(query ?? '').trim();
  if (!normalizedQuery) return null;

  const items = readAll();
  const duplicate = items.find(
    (item) => item.status === 'open'
      && item.query.toLowerCase() === normalizedQuery.toLowerCase()
      && item.modelKey === modelKey,
  );
  if (duplicate) return duplicate;

  const resolvedField = field ?? VEHICLE_QUESTION_INTENT_BY_ID[intentId ?? '']?.factField ?? null;

  const entry = {
    id: uid(),
    query: normalizedQuery,
    modelKey: modelKey ?? null,
    intentId,
    category,
    field: resolvedField,
    status: 'open',
    createdAt: new Date().toISOString(),
    resolvedAt: null,
    adminAnswer: null,
  };

  writeAll([entry, ...items]);
  return entry;
}

export function loadOpenCustomerQuestions({ status = 'open' } = {}) {
  const items = readAll();
  if (!status) return items;
  return items.filter((item) => item.status === status);
}

/**
 * @param {string} id
 */
export function resolveOpenCustomerQuestion(id) {
  const items = readAll();
  const next = items.map((item) => (
    item.id === id
      ? { ...item, status: 'resolved', resolvedAt: new Date().toISOString() }
      : item
  ));
  writeAll(next);
  return next.find((item) => item.id === id) ?? null;
}

/**
 * Antwort in Stammdaten schreiben und Frage erledigen.
 * @param {string} id
 * @param {unknown} answerValue
 */
export function answerAndResolveOpenCustomerQuestion(id, answerValue) {
  const items = readAll();
  const item = items.find((entry) => entry.id === id);
  if (!item) return { ok: false, reason: 'not_found' };

  const field = item.field ?? VEHICLE_QUESTION_INTENT_BY_ID[item.intentId ?? '']?.factField ?? null;
  let applied = false;

  if (item.modelKey && field && answerValue !== '' && answerValue != null) {
    const patch = applyFieldAnswer({
      modelKey: item.modelKey,
      field,
      value: answerValue,
    });
    applied = Boolean(patch);
  }

  const next = items.map((entry) => (
    entry.id === id
      ? {
        ...entry,
        status: 'resolved',
        resolvedAt: new Date().toISOString(),
        adminAnswer: answerValue,
        field,
      }
      : entry
  ));
  writeAll(next);

  return {
    ok: true,
    applied,
    item: next.find((entry) => entry.id === id) ?? null,
  };
}

export function countOpenCustomerQuestions() {
  return loadOpenCustomerQuestions({ status: 'open' }).length;
}
