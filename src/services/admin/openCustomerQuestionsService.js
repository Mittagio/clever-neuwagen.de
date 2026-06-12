/**
 * Offene Kundenfragen – wenn Stammdaten fehlen.
 * Persistenz lokal (Admin); später Server-API.
 */
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

  const entry = {
    id: uid(),
    query: normalizedQuery,
    modelKey: modelKey ?? null,
    intentId,
    category,
    status: 'open',
    createdAt: new Date().toISOString(),
    resolvedAt: null,
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

export function countOpenCustomerQuestions() {
  return loadOpenCustomerQuestions({ status: 'open' }).length;
}
