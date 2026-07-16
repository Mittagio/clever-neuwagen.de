/**
 * JSON-Persistenz: Verkäuferfeedback, Golden Candidates, Qualitätsmetriken.
 */
import { createJsonStore } from './jsonStore.js';
import { buildSellerFeedbackRecord, updateSellerFeedbackStatus } from '../src/services/clever/learning/sellerConversationFeedbackService.js';

const feedbackStore = createJsonStore({
  fileName: 'clever-seller-feedback.json',
  createEmpty: () => ({ items: [] }),
  logTag: 'clever-seller-feedback',
});

const goldenStore = createJsonStore({
  fileName: 'clever-golden-candidates.json',
  createEmpty: () => ({ items: [] }),
  logTag: 'clever-golden-candidates',
});

const metricsStore = createJsonStore({
  fileName: 'clever-quality-metrics.json',
  createEmpty: () => ({ turns: [] }),
  logTag: 'clever-quality-metrics',
});

export function loadSellerFeedback() {
  return feedbackStore.load();
}

export function saveSellerFeedback(data) {
  return feedbackStore.save(data);
}

export function appendSellerFeedback(record) {
  const data = loadSellerFeedback();
  const item = buildSellerFeedbackRecord(record);
  const items = [item, ...(data.items ?? [])];
  saveSellerFeedback({ items });
  return item;
}

export function listSellerFeedback(filters = {}) {
  let items = loadSellerFeedback().items ?? [];
  if (filters.status) items = items.filter((i) => i.status === filters.status);
  if (filters.category) items = items.filter((i) => i.category === filters.category);
  return items;
}

export function patchSellerFeedback(id, patch = {}) {
  const data = loadSellerFeedback();
  const items = updateSellerFeedbackStatus(data.items ?? [], id, patch);
  saveSellerFeedback({ items });
  return items.find((i) => i.id === id) ?? null;
}

export function loadGoldenCandidates() {
  return goldenStore.load();
}

export function appendGoldenCandidate(candidate) {
  const data = loadGoldenCandidates();
  const items = [candidate, ...(data.items ?? [])];
  goldenStore.save({ items });
  return candidate;
}

export function patchGoldenCandidate(id, patch = {}) {
  const data = loadGoldenCandidates();
  const items = (data.items ?? []).map((item) => (item.id === id ? { ...item, ...patch } : item));
  goldenStore.save({ items });
  return items.find((i) => i.id === id) ?? null;
}

export function appendQualityTurnMetric(metric) {
  const data = metricsStore.load();
  const turns = [metric, ...(data.turns ?? [])].slice(0, 5000);
  metricsStore.save({ turns });
  return metric;
}

export function listQualityTurnMetrics(filters = {}) {
  let turns = metricsStore.load().turns ?? [];
  if (filters.since) {
    const sinceMs = new Date(filters.since).getTime();
    turns = turns.filter((t) => new Date(t.createdAt).getTime() >= sinceMs);
  }
  if (filters.model) {
    turns = turns.filter((t) => t.finalModel === filters.model || t.primaryModel === filters.model);
  }
  return turns;
}

export function buildQualitySummary() {
  const feedback = listSellerFeedback();
  const gaps = [];
  const metrics = listQualityTurnMetrics();
  const golden = loadGoldenCandidates().items ?? [];

  const categoryCounts = {};
  for (const item of feedback) {
    categoryCounts[item.category] = (categoryCounts[item.category] ?? 0) + 1;
  }

  return {
    newSellerFeedback: feedback.filter((i) => i.status === 'new').length,
    openKnowledgeGaps: gaps.length,
    goldenCandidatesAccepted: golden.filter((g) => g.status === 'accepted').length,
    fallbackTurns: metrics.filter((m) => m.fallback === true).length,
    officialWebTurns: metrics.filter((m) => m.usedOfficialWeb === true).length,
    conflictTurns: metrics.filter((m) => m.hadDataConflict === true).length,
    escalationTurns: metrics.filter((m) => m.escalationUsed === true).length,
    categoryCounts,
  };
}
