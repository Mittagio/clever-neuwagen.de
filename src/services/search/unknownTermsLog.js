/**
 * Admin-Learning: unbekannte / fuzzy erkannte Suchbegriffe protokollieren
 */

const STORAGE_KEY = 'cn_unknown_search_terms_v1';

function loadAll() {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveAll(entries) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, 500)));
  } catch {
    /* quota */
  }
}

/**
 * @param {{ raw: string, suggestedId?: string, suggestedLabel?: string, confidence?: string }} entry
 */
export function logUnknownSearchTerm(entry) {
  if (!entry?.raw?.trim()) return;
  const key = entry.raw.toLowerCase().trim();
  const all = loadAll();
  const idx = all.findIndex((e) => e.raw.toLowerCase() === key);
  const now = new Date().toISOString();

  if (idx >= 0) {
    all[idx].count += 1;
    all[idx].lastSeen = now;
    if (entry.suggestedId) all[idx].suggestedId = entry.suggestedId;
    if (entry.suggestedLabel) all[idx].suggestedLabel = entry.suggestedLabel;
    if (entry.confidence) all[idx].confidence = entry.confidence;
  } else {
    all.push({
      id: `ut-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      raw: entry.raw.trim(),
      suggestedId: entry.suggestedId ?? null,
      suggestedLabel: entry.suggestedLabel ?? null,
      confidence: entry.confidence ?? 'medium',
      count: 1,
      status: 'pending',
      firstSeen: now,
      lastSeen: now,
    });
  }
  saveAll(all);
}

export function getUnknownSearchTerms({ status = 'pending' } = {}) {
  const all = loadAll().sort((a, b) => b.count - a.count);
  if (!status) return all;
  return all.filter((e) => e.status === status);
}

export function approveUnknownTerm(id, mapping) {
  const all = loadAll();
  const idx = all.findIndex((e) => e.id === id);
  if (idx < 0) return null;
  all[idx].status = 'approved';
  all[idx].approvedMapping = mapping;
  all[idx].approvedAt = new Date().toISOString();
  saveAll(all);
  return all[idx];
}

export function dismissUnknownTerm(id) {
  const all = loadAll();
  const idx = all.findIndex((e) => e.id === id);
  if (idx < 0) return;
  all[idx].status = 'dismissed';
  saveAll(all);
}

export function exportApprovedMappings() {
  return loadAll()
    .filter((e) => e.status === 'approved' && e.approvedMapping)
    .map((e) => ({ raw: e.raw, ...e.approvedMapping }));
}
