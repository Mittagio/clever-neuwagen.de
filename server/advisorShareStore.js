import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'advisor-share-sessions.json');
const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000;

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function emptyStore() {
  return { sessions: {}, lastUpdated: null };
}

export function loadAdvisorShareStore() {
  ensureDataDir();
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  } catch (err) {
    console.warn('[advisor-share] load failed:', err.message);
  }
  return emptyStore();
}

function saveStore(sessions) {
  ensureDataDir();
  const data = {
    sessions: sessions ?? {},
    lastUpdated: new Date().toISOString(),
  };
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  return data;
}

export function createAdvisorShareSession(session) {
  const store = loadAdvisorShareStore();
  const token = String(session.token ?? '').toUpperCase();
  if (!token) throw new Error('token required');

  const now = Date.now();
  store.sessions[token] = {
    ...session,
    token,
    createdAt: session.createdAt ?? now,
    expiresAt: session.expiresAt ?? now + SESSION_TTL_MS,
    viewCount: 0,
    inquiryConfirmed: false,
  };

  saveStore(store.sessions);
  return store.sessions[token];
}

export function getAdvisorShareSession(token) {
  if (!token) return null;
  const store = loadAdvisorShareStore();
  const key = Object.keys(store.sessions).find(
    (k) => k.toUpperCase() === String(token).toUpperCase(),
  );
  if (!key) return null;

  const session = store.sessions[key];
  if (session.expiresAt && Date.now() > session.expiresAt) return null;

  store.sessions[key] = {
    ...session,
    viewCount: (session.viewCount ?? 0) + 1,
    lastViewedAt: Date.now(),
  };
  saveStore(store.sessions);

  return store.sessions[key];
}

export function confirmAdvisorShareInquiry(token) {
  const store = loadAdvisorShareStore();
  const key = Object.keys(store.sessions).find(
    (k) => k.toUpperCase() === String(token).toUpperCase(),
  );
  if (!key) return null;

  store.sessions[key] = {
    ...store.sessions[key],
    inquiryConfirmed: true,
    inquiryConfirmedAt: Date.now(),
  };
  saveStore(store.sessions);
  return store.sessions[key];
}
