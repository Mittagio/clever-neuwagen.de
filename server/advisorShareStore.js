import { createJsonStore } from './jsonStore.js';

const store = createJsonStore({
  fileName: 'advisor-share-sessions.json',
  createEmpty: () => ({ sessions: {}, lastUpdated: null }),
  logTag: 'advisor-share',
});

const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000;

export function loadAdvisorShareStore() {
  return store.load();
}

function saveStore(sessions) {
  const data = {
    sessions: sessions ?? {},
    lastUpdated: new Date().toISOString(),
  };
  store.save(data);
  return data;
}

export function createAdvisorShareSession(session) {
  const data = loadAdvisorShareStore();
  const token = String(session.token ?? '').toUpperCase();
  if (!token) throw new Error('token required');

  const now = Date.now();
  data.sessions[token] = {
    ...session,
    token,
    createdAt: session.createdAt ?? now,
    expiresAt: session.expiresAt ?? now + SESSION_TTL_MS,
    viewCount: 0,
    inquiryConfirmed: false,
  };

  saveStore(data.sessions);
  return data.sessions[token];
}

export function getAdvisorShareSession(token) {
  if (!token) return null;
  const data = loadAdvisorShareStore();
  const key = Object.keys(data.sessions).find(
    (k) => k.toUpperCase() === String(token).toUpperCase(),
  );
  if (!key) return null;

  const session = data.sessions[key];
  if (session.expiresAt && Date.now() > session.expiresAt) return null;

  data.sessions[key] = {
    ...session,
    viewCount: (session.viewCount ?? 0) + 1,
    lastViewedAt: Date.now(),
  };
  saveStore(data.sessions);

  return data.sessions[key];
}

export function confirmAdvisorShareInquiry(token, patch = {}) {
  const data = loadAdvisorShareStore();
  const key = Object.keys(data.sessions).find(
    (k) => k.toUpperCase() === String(token).toUpperCase(),
  );
  if (!key) return null;

  const existing = data.sessions[key];
  data.sessions[key] = {
    ...existing,
    customer: { ...(existing.customer ?? {}), ...(patch.customer ?? {}) },
    inquiryConfirmed: true,
    inquiryConfirmedAt: Date.now(),
  };
  saveStore(data.sessions);
  return data.sessions[key];
}

/** Sessions eines Kunden per E-Mail (read-only, ohne View-Counter). */
export function listAdvisorShareSessionsByEmail(email) {
  const normalized = String(email ?? '').trim().toLowerCase();
  if (!normalized) return [];

  const data = loadAdvisorShareStore();
  const now = Date.now();

  return Object.values(data.sessions)
    .filter((session) => {
      if (session.expiresAt && now > session.expiresAt) return false;
      const sessionEmail = session.customer?.email?.trim().toLowerCase();
      return sessionEmail === normalized;
    })
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
}

export function findAdvisorShareSession(token) {
  if (!token) return null;
  const data = loadAdvisorShareStore();
  const key = Object.keys(data.sessions).find(
    (k) => k.toUpperCase() === String(token).toUpperCase(),
  );
  if (!key) return null;
  const session = data.sessions[key];
  if (session.expiresAt && Date.now() > session.expiresAt) return null;
  return session;
}

export function getAdvisorShareStoreStat() {
  return store.stat();
}
