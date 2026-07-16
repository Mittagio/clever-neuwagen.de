/**
 * JSON-Persistenz: Wissenslücken-Inbox.
 */
import { createJsonStore } from './jsonStore.js';
import { upsertKnowledgeGap, updateKnowledgeGapStatus } from '../src/services/clever/knowledge/knowledgeGapService.js';

const store = createJsonStore({
  fileName: 'knowledge-gaps.json',
  createEmpty: () => ({ gaps: [] }),
  logTag: 'knowledge-gaps',
});

export function loadKnowledgeGaps() {
  return store.load();
}

export function saveKnowledgeGaps(data) {
  return store.save(data);
}

export function listKnowledgeGaps(filters = {}) {
  const data = loadKnowledgeGaps();
  let gaps = data.gaps ?? [];
  if (filters.status) {
    gaps = gaps.filter((gap) => gap.status === filters.status);
  }
  if (filters.brandKey) {
    gaps = gaps.filter((gap) => gap.brandKey === filters.brandKey);
  }
  if (filters.modelKey) {
    gaps = gaps.filter((gap) => gap.modelKey === filters.modelKey);
  }
  return gaps;
}

export function appendKnowledgeGaps(newGaps = []) {
  if (!newGaps.length) return loadKnowledgeGaps();
  const data = loadKnowledgeGaps();
  let gaps = data.gaps ?? [];
  for (const candidate of newGaps) {
    const result = upsertKnowledgeGap(gaps, candidate);
    gaps = result.gaps;
  }
  return saveKnowledgeGaps({ gaps });
}

export function patchKnowledgeGap(id, patch = {}) {
  const data = loadKnowledgeGaps();
  const gaps = updateKnowledgeGapStatus(data.gaps ?? [], id, {
    ...patch,
    reviewedAt: patch.reviewedAt ?? new Date().toISOString(),
  });
  return saveKnowledgeGaps({ gaps });
}

export function knowledgeGapStoreStat() {
  return store.stat();
}
