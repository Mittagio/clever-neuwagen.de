/**
 * Outbox-Persistenz – Browser (localStorage) oder In-Memory (Tests/Server-Import).
 */

const STORAGE_KEY = 'clever-neuwagen-mail-outbox';
const MAX_ENTRIES = 200;

let memoryOutbox = [];
let storageAdapter = null;

export function configureMailOutboxStorage(adapter) {
  storageAdapter = adapter;
}

function readStorage() {
  if (storageAdapter?.load) {
    return storageAdapter.load();
  }
  if (typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {
      /* ignore */
    }
  }
  return memoryOutbox;
}

function writeStorage(items) {
  const trimmed = items.slice(0, MAX_ENTRIES);
  if (storageAdapter?.save) {
    storageAdapter.save(trimmed);
    return trimmed;
  }
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } catch {
      /* ignore */
    }
  }
  memoryOutbox = trimmed;
  return trimmed;
}

const listeners = new Set();

export function subscribeMailOutbox(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify() {
  for (const fn of listeners) {
    try {
      fn(getMailOutboxEntries());
    } catch {
      /* ignore */
    }
  }
}

export function getMailOutboxEntries() {
  return readStorage();
}

export function setMailOutboxEntries(entries) {
  writeStorage(entries);
  notify();
  return getMailOutboxEntries();
}

export function appendMailOutboxEntry(entry) {
  const next = [entry, ...getMailOutboxEntries()];
  setMailOutboxEntries(next);
  return entry;
}

export function updateMailOutboxEntry(mailId, patch) {
  const updated = getMailOutboxEntries().map((m) => (
    m.id === mailId ? { ...m, ...patch, updatedAt: new Date().toISOString() } : m
  ));
  setMailOutboxEntries(updated);
  return updated.find((m) => m.id === mailId) ?? null;
}

export function findMailOutboxEntry(mailId) {
  return getMailOutboxEntries().find((m) => m.id === mailId) ?? null;
}

export function resetMailOutboxForTests(entries = []) {
  memoryOutbox = entries;
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }
  notify();
}

export function seedMailOutboxDemo() {
  if (getMailOutboxEntries().length > 0) return;
  const now = Date.now();
  const mins = (m) => new Date(now - m * 60 * 1000).toISOString();
  setMailOutboxEntries([
    {
      id: 'm-demo-1',
      to: 'kontakt@autohaus-mueller.de',
      from: 'info@clever-neuwagen.de',
      subject: 'Willkommen bei Clever Neuwagen – Ihr Konto ist aktiv',
      templateId: 'dealer-approved',
      templateName: 'Händler freigeschaltet',
      status: 'failed',
      error: 'Mailbox voll',
      createdAt: mins(24),
      sentAt: null,
      provider: 'mock',
      retryCount: 1,
    },
    {
      id: 'm-demo-2',
      to: 'kunde@example.de',
      from: 'info@clever-neuwagen.de',
      subject: 'Ihr Angebot: Kia EV3',
      templateId: 'customer-offer-link',
      templateName: 'Angebotslink an Kunde',
      status: 'sent',
      error: null,
      createdAt: mins(45),
      sentAt: mins(44),
      provider: 'mock',
      retryCount: 0,
    },
    {
      id: 'm-demo-3',
      to: 'kunde@example.de',
      from: 'info@clever-neuwagen.de',
      subject: 'Ihr Zugangscode für Clever Neuwagen',
      templateId: 'customer-login-code',
      templateName: 'Login-Code Kunde',
      status: 'queued',
      error: null,
      createdAt: mins(2),
      sentAt: null,
      provider: 'mock',
      retryCount: 0,
    },
  ]);
}

if (typeof process === 'undefined' || process.env?.NODE_ENV !== 'test') {
  seedMailOutboxDemo();
}
