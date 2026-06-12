/**
 * Offene Kundenfragen – Server (primär) + localStorage (Offline-Cache).
 */
import { VEHICLE_QUESTION_INTENT_BY_ID } from '../../data/vehicleQuestionCatalog.js';
import {
  patchOpenCustomerQuestionApi,
  postOpenCustomerQuestionApi,
} from './stammdatenApi.js';
import { applyFieldAnswer } from './vehicleStammdatenOverrideService.js';

const STORAGE_KEY = 'clever-open-customer-questions';

/** @type {object[] | null} */
let serverCache = null;

function uid() {
  return `ocq-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function readLocalStorage() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function readAll() {
  if (serverCache) return [...serverCache];
  return readLocalStorage();
}

function writeLocalCache(items) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent('clever-open-questions-changed'));
  } catch {
    // ignore quota
  }
}

/** @param {object[]} items */
export function setOpenQuestionsCache(items) {
  serverCache = [...items];
  writeLocalCache(items);
}

function syncQuestionToServer(entry) {
  if (typeof window === 'undefined') return;
  postOpenCustomerQuestionApi(entry).catch((err) => {
    console.warn('[open-questions] Server-Sync fehlgeschlagen:', err.message);
  });
}

function syncQuestionUpdateToServer(id, updates) {
  if (typeof window === 'undefined') return;
  patchOpenCustomerQuestionApi(id, updates).catch((err) => {
    console.warn('[open-questions] Server-Update fehlgeschlagen:', err.message);
  });
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

  const next = [entry, ...items];
  serverCache = next;
  writeLocalCache(next);
  syncQuestionToServer(entry);
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
  const updates = { status: 'resolved', resolvedAt: new Date().toISOString() };
  const next = items.map((item) => (
    item.id === id ? { ...item, ...updates } : item
  ));
  serverCache = next;
  writeLocalCache(next);
  syncQuestionUpdateToServer(id, updates);
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

  const resolvedItem = {
    ...item,
    status: 'resolved',
    resolvedAt: new Date().toISOString(),
    adminAnswer: answerValue,
    field,
  };

  const next = items.map((entry) => (entry.id === id ? resolvedItem : entry));
  serverCache = next;
  writeLocalCache(next);
  syncQuestionUpdateToServer(id, {
    status: 'resolved',
    resolvedAt: resolvedItem.resolvedAt,
    adminAnswer: answerValue,
    field,
  });

  return {
    ok: true,
    applied,
    item: resolvedItem,
  };
}

export function countOpenCustomerQuestions() {
  return loadOpenCustomerQuestions({ status: 'open' }).length;
}
