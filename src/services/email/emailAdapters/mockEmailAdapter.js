const LOG_KEY = 'clever-neuwagen-email-log';

function appendLog(entry) {
  try {
    const raw = localStorage.getItem(LOG_KEY);
    const list = raw ? JSON.parse(raw) : [];
    list.unshift(entry);
    localStorage.setItem(LOG_KEY, JSON.stringify(list.slice(0, 200)));
  } catch {
    /* ignore */
  }
  if (import.meta.env.DEV) {
    console.info('[mock-email]', entry.type, entry.to, entry.subject);
  }
}

function createMessageId() {
  return `mock-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export async function sendMockEmail({ to, subject, body, html, meta = {} }) {
  const sentAt = new Date().toISOString();
  const messageId = createMessageId();
  const entry = {
    messageId,
    to,
    subject,
    bodyPreview: body?.slice(0, 200),
    sentAt,
    provider: 'mock',
    ...meta,
  };
  appendLog(entry);
  return { ok: true, messageId, sentAt, provider: 'mock' };
}

export function getMockEmailLog() {
  try {
    const raw = localStorage.getItem(LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
