import { getAdminLeitstandState, publishRelease, upsertRelease } from './adminLeitstandStore.js';

export const RELEASE_STATUS = {
  draft: { id: 'draft', label: 'Entwurf', emoji: '📝' },
  review: { id: 'review', label: 'Prüfung', emoji: '🔍' },
  ready: { id: 'ready', label: 'Freigabe bereit', emoji: '✅' },
  published: { id: 'published', label: 'Veröffentlicht', emoji: '🚀' },
};

export function listReleases() {
  return getAdminLeitstandState().releases ?? [];
}

export function getReleaseById(id) {
  return listReleases().find((r) => r.id === id) ?? null;
}

export function createReleaseDraft(payload = {}) {
  return upsertRelease({
    status: 'draft',
    changeCount: 0,
    checklist: [],
    ...payload,
  });
}

export function markReleaseReady(releaseId) {
  const release = getReleaseById(releaseId);
  if (!release) return null;
  return upsertRelease({ ...release, status: 'ready' });
}

export function publishReleaseToDealers(releaseId, actor = 'Admin') {
  return publishRelease(releaseId, actor);
}

export function countPendingReleases() {
  return listReleases().filter((r) => r.status === 'review' || r.status === 'ready').length;
}
