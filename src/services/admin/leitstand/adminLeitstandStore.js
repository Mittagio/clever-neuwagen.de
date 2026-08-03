/**
 * Admin-Leitstand – zentrale Persistenz (Events, Releases, Mail-Outbox).
 */
const STORAGE_KEY = 'clever-neuwagen-admin-leitstand';

const DEFAULT_STATE = {
  activityFeed: [],
  releases: [],
  cleverWarnings: [],
};

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_STATE,
        ...parsed,
        activityFeed: parsed.activityFeed ?? [],
        releases: parsed.releases ?? [],
        cleverWarnings: parsed.cleverWarnings ?? [],
      };
    }
  } catch {
    /* fallback */
  }
  return { ...DEFAULT_STATE };
}

let memoryState = loadState();
const listeners = new Set();

function persist() {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(memoryState));
  }
  listeners.forEach((fn) => fn(memoryState));
}

export function subscribeAdminLeitstand(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getAdminLeitstandState() {
  return memoryState;
}

export function appendActivityFeed(entry) {
  const item = {
    id: entry.id ?? `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    actor: entry.actor ?? 'System',
    action: entry.action,
    detail: entry.detail ?? null,
    entityType: entry.entityType ?? null,
    entityId: entry.entityId ?? null,
    severity: entry.severity ?? 'info',
    createdAt: entry.createdAt ?? new Date().toISOString(),
  };
  memoryState = {
    ...memoryState,
    activityFeed: [item, ...memoryState.activityFeed].slice(0, 200),
  };
  persist();
  return item;
}

/**
 * OCR-/Magic-/Dokument-Warnung für Leitstand-Kern (keine Secrets).
 * @param {object} entry
 */
export function recordAdminCleverWarning(entry = {}) {
  const item = {
    id: entry.id ?? `cw-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    kind: entry.kind ?? 'clever',
    title: entry.title ?? 'Clever-Warnung',
    detail: entry.detail ?? null,
    severity: entry.severity ?? 'warn',
    entityType: entry.entityType ?? entry.kind ?? null,
    createdAt: entry.createdAt ?? new Date().toISOString(),
  };
  memoryState = {
    ...memoryState,
    cleverWarnings: [item, ...(memoryState.cleverWarnings ?? [])].slice(0, 50),
  };
  persist();
  if (entry.mirrorActivity !== false) {
    appendActivityFeed({
      actor: 'System',
      action: item.title,
      detail: item.detail,
      entityType: item.entityType,
      severity: item.severity === 'urgent' || item.severity === 'error' ? 'urgent' : 'warn',
      createdAt: item.createdAt,
    });
  }
  return item;
}

export function upsertRelease(release) {
  const existing = memoryState.releases.find((r) => r.id === release.id);
  const next = existing
    ? { ...existing, ...release, updatedAt: new Date().toISOString() }
    : {
      ...release,
      id: release.id ?? `rel-${Date.now()}`,
      status: release.status ?? 'draft',
      createdAt: release.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  const releases = existing
    ? memoryState.releases.map((r) => (r.id === next.id ? next : r))
    : [next, ...memoryState.releases];
  memoryState = { ...memoryState, releases };
  persist();
  return next;
}

export function publishRelease(releaseId, actor = 'Admin') {
  const release = memoryState.releases.find((r) => r.id === releaseId);
  if (!release) return null;
  const published = {
    ...release,
    status: 'published',
    publishedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  memoryState = {
    ...memoryState,
    releases: memoryState.releases.map((r) => (r.id === releaseId ? published : r)),
  };
  persist();
  appendActivityFeed({
    actor,
    action: `${release.title} veröffentlicht`,
    detail: `${release.changeCount ?? 0} Änderungen an alle Händler`,
    entityType: 'release',
    entityId: releaseId,
    severity: 'success',
  });
  return published;
}

export function seedAdminLeitstandDemo() {
  if (memoryState.activityFeed.length > 0) return;
  const now = Date.now();
  const mins = (m) => new Date(now - m * 60 * 1000).toISOString();

  memoryState = {
    ...memoryState,
    activityFeed: [
      { id: 'act-1', actor: 'Mike', action: 'hat Händler Müller freigegeben', detail: 'Autohaus Müller', severity: 'success', createdAt: mins(35) },
      { id: 'act-2', actor: 'Mike', action: 'hat EV4 WLTP bearbeitet', detail: 'Kia EV4 Earth', severity: 'info', createdAt: mins(40) },
      { id: 'act-3', actor: 'System', action: 'WLTP Fehler erkannt', detail: 'Kia EV4 – Pflichtfelder fehlen', severity: 'urgent', createdAt: mins(40) },
      { id: 'act-4', actor: 'System', action: 'Mail konnte nicht zugestellt werden', detail: 'kontakt@autohaus-mueller.de', severity: 'urgent', createdAt: mins(24) },
      { id: 'act-5', actor: 'System', action: 'Anfrage eingegangen', detail: 'Kia Sportage · Autohaus Trinkle', severity: 'info', createdAt: mins(18) },
      { id: 'act-6', actor: 'Mike', action: 'hat EV4 Daten zur Prüfung freigegeben', detail: '8 Änderungen', severity: 'info', createdAt: mins(16) },
      { id: 'act-7', actor: 'System', action: 'Händler registriert', detail: 'Autohaus Müller', severity: 'info', createdAt: mins(11) },
    ],
    cleverWarnings: [
      {
        id: 'cw-demo-ocr',
        kind: 'ocr',
        title: 'OCR-/Dokument-Fehler',
        detail: 'Scan · ocr_engine_not_configured',
        severity: 'urgent',
        entityType: 'ocr',
        createdAt: mins(28),
      },
      {
        id: 'cw-demo-magic',
        kind: 'magic',
        title: 'Magic / OpenAI Fallback',
        detail: 'openai_key_missing · lokaler Fallback',
        severity: 'warn',
        entityType: 'magic',
        createdAt: mins(22),
      },
    ],
    releases: [
      {
        id: 'rel-ev4-2026',
        title: 'Neue EV4 Daten',
        modelKey: 'ev4',
        status: 'review',
        changeCount: 8,
        checklist: [
          { id: 'colors', label: 'Farben', done: true },
          { id: 'wltp', label: 'WLTP', done: true },
          { id: 'packages', label: 'Pakete', done: true },
          { id: 'images', label: 'Bilder', done: true },
        ],
        createdAt: mins(120),
        updatedAt: mins(16),
      },
    ],
  };
  persist();
}

// Demo-Seed beim ersten Import
seedAdminLeitstandDemo();
