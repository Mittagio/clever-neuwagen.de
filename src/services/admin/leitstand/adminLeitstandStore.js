/**
 * Admin-Leitstand – zentrale Persistenz (Events, Releases, Mail-Outbox).
 */
const STORAGE_KEY = 'clever-neuwagen-admin-leitstand';

const DEFAULT_STATE = {
  activityFeed: [],
  releases: [],
  mailOutbox: [],
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
        mailOutbox: parsed.mailOutbox ?? [],
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

export function enqueueMail(item) {
  const entry = {
    id: item.id ?? `mail-${Date.now()}`,
    to: item.to,
    subject: item.subject,
    templateId: item.templateId ?? null,
    status: item.status ?? 'queued',
    error: item.error ?? null,
    createdAt: item.createdAt ?? new Date().toISOString(),
    sentAt: item.sentAt ?? null,
  };
  memoryState = {
    ...memoryState,
    mailOutbox: [entry, ...memoryState.mailOutbox].slice(0, 100),
  };
  persist();
  return entry;
}

export function updateMailStatus(mailId, status, error = null) {
  memoryState = {
    ...memoryState,
    mailOutbox: memoryState.mailOutbox.map((m) => (
      m.id === mailId
        ? {
          ...m,
          status,
          error,
          sentAt: status === 'sent' ? new Date().toISOString() : m.sentAt,
        }
        : m
    )),
  };
  persist();
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
    mailOutbox: [
      { id: 'm-1', to: 'kontakt@autohaus-mueller.de', subject: 'Willkommen bei Clever-Neuwagen', templateId: 'dealer-approval', status: 'failed', error: 'Mailbox voll', createdAt: mins(24) },
      { id: 'm-2', to: 'kunde@example.de', subject: 'Ihr Angebot Kia EV3', templateId: 'offer-send', status: 'sent', createdAt: mins(45), sentAt: mins(44) },
      { id: 'm-3', to: 'info@clever-neuwagen.de', subject: 'Login-Code', templateId: 'login-code', status: 'queued', createdAt: mins(2) },
    ],
  };
  persist();
}

// Demo-Seed beim ersten Import
seedAdminLeitstandDemo();
