/**
 * Activity-Feed aus Server-Outbox synchronisieren (serverseitige Sends ohne Client-Hook).
 */

const SEEN_KEY = 'clever-mail-activity-synced';

function loadSeenIds() {
  if (typeof sessionStorage === 'undefined') return new Set();
  try {
    const raw = sessionStorage.getItem(SEEN_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function saveSeenIds(seen) {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(SEEN_KEY, JSON.stringify([...seen].slice(-500)));
  } catch {
    /* ignore */
  }
}

export function syncActivityFromOutboxEntries(items = [], {
  logMailSentActivity,
  logMailFailedActivity,
} = {}) {
  if (!items.length || !logMailSentActivity || !logMailFailedActivity) return 0;
  const seen = loadSeenIds();
  let added = 0;

  for (const mail of items) {
    if (!mail?.id || seen.has(mail.id)) continue;
    seen.add(mail.id);
    if (mail.status === 'sent') {
      logMailSentActivity({
        to: mail.to,
        templateName: mail.templateName,
        subject: mail.subject,
      });
      added += 1;
    } else if (mail.status === 'failed') {
      logMailFailedActivity({
        to: mail.to,
        templateName: mail.templateName,
        error: mail.error,
      });
      added += 1;
    }
  }

  saveSeenIds(seen);
  return added;
}

export function resetOutboxActivitySyncForTests() {
  if (typeof sessionStorage !== 'undefined') {
    try {
      sessionStorage.removeItem(SEEN_KEY);
    } catch {
      /* ignore */
    }
  }
}
