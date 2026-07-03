import { MAIL_FROM } from './mailConfig.js';
import { renderMailTemplate } from './mailRenderer.js';
import { getMailTemplate } from './mailTemplateRegistry.js';
import { sendMailTransport, getActiveTransportLabel } from './mailTransport.js';
import { MAIL_STATUS } from './mailTypes.js';
import {
  appendMailOutboxEntry,
  findMailOutboxEntry,
  getMailOutboxEntries,
  subscribeMailOutbox,
  updateMailOutboxEntry,
} from './mailOutboxStore.js';
import {
  fetchServerMailOutbox,
  sendMailViaServer,
  retryMailViaServer,
} from './mailOutboxApi.js';
import {
  getUnifiedOutboxSnapshot,
  isServerOutboxActive,
  listUnifiedMailOutbox,
  getUnifiedMailOutboxStats,
  setUnifiedOutbox,
  useDemoOutboxFallback,
  patchUnifiedMailEntry,
  subscribeUnifiedOutbox,
  OUTBOX_SOURCE,
} from './mailOutboxResolver.js';
import { syncActivityFromOutboxEntries } from './mailOutboxActivitySync.js';
import {
  logMailFailedActivity,
  logMailRetryActivity,
  logMailSentActivity,
} from './mailActivityBridge.js';

export { MAIL_FROM } from './mailConfig.js';
export { MAIL_STATUS, MAIL_STATUS_UI } from './mailTypes.js';
export { listMailTemplates, MAIL_TEMPLATE_IDS } from './mailTemplateRegistry.js';
export { getActiveTransportLabel } from './mailTransport.js';
export { subscribeMailOutbox, subscribeUnifiedOutbox, OUTBOX_SOURCE };
export { getUnifiedOutboxSnapshot, getUnifiedMailOutboxStats };

import { configureMailOutboxApi } from './mailOutboxApi.js';

let mailIdSeq = 0;
const apiBase = '/api/v1';

export function configureMailOutboxClient(options = {}) {
  configureMailOutboxApi(options);
}

function isBrowserClient() {
  return typeof window !== 'undefined';
}

function shouldPreferServer() {
  return isBrowserClient();
}

function nextMailId() {
  mailIdSeq += 1;
  return `mail-${Date.now()}-${mailIdSeq}`;
}

function logMailActivityFromEntry(entry) {
  if (!entry) return;
  if (entry.status === MAIL_STATUS.SENT) {
    logMailSentActivity({
      to: entry.to,
      templateName: entry.templateName,
      subject: entry.subject,
    });
  } else if (entry.status === MAIL_STATUS.FAILED) {
    logMailFailedActivity({
      to: entry.to,
      templateName: entry.templateName,
      error: entry.error,
    });
  }
}

export function listMailOutbox() {
  return listUnifiedMailOutbox();
}

export function countFailedMails() {
  return listMailOutbox().filter((m) => m.status === MAIL_STATUS.FAILED).length;
}

export function countQueuedMails() {
  return listMailOutbox().filter((m) => m.status === MAIL_STATUS.QUEUED).length;
}

export function getMailOutboxStats() {
  return getUnifiedMailOutboxStats();
}

export function getOutboxSource() {
  return getUnifiedOutboxSnapshot().source;
}

/**
 * Admin: Server-Outbox laden, bei Fehler Demo-Fallback.
 */
export async function loadMailOutboxForAdmin({ base = apiBase } = {}) {
  if (!shouldPreferServer()) {
    return useDemoOutboxFallback();
  }

  const result = await fetchServerMailOutbox(base);
  if (result.ok && result.items) {
    const snapshot = setUnifiedOutbox(result.items, OUTBOX_SOURCE.SERVER, true);
    syncActivityFromOutboxEntries(result.items, {
      logMailSentActivity,
      logMailFailedActivity,
    });
    return snapshot;
  }

  return useDemoOutboxFallback();
}

function createOutboxEntry({
  to,
  subject,
  body,
  templateId,
  templateName,
  status = MAIL_STATUS.QUEUED,
  error = null,
  meta = {},
}) {
  return {
    id: meta.mailId ?? nextMailId(),
    to,
    from: MAIL_FROM.email,
    subject,
    body: body ?? '',
    bodyPreview: body?.slice(0, 160) ?? '',
    templateId: templateId ?? null,
    templateName: templateName ?? getMailTemplate(templateId)?.name ?? null,
    status,
    error,
    createdAt: new Date().toISOString(),
    sentAt: null,
    updatedAt: null,
    provider: getActiveTransportLabel(),
    messageId: null,
    retryCount: meta.retryCount ?? 0,
    leadId: meta.leadId ?? null,
    dealerId: meta.dealerId ?? null,
  };
}

async function sendViaOutboxLocal({
  to,
  subject,
  body,
  templateId = null,
  templateName = null,
  meta = {},
}) {
  const entry = createOutboxEntry({
    to,
    subject,
    body,
    templateId,
    templateName,
    status: MAIL_STATUS.QUEUED,
    meta,
  });
  appendMailOutboxEntry(entry);

  const transportResult = await sendMailTransport({
    to,
    subject,
    body,
    meta,
  });

  if (transportResult.ok) {
    const sent = updateMailOutboxEntry(entry.id, {
      status: MAIL_STATUS.SENT,
      sentAt: new Date().toISOString(),
      error: null,
      provider: transportResult.provider,
      messageId: transportResult.messageId,
    });
    logMailSentActivity({
      to,
      templateName: sent?.templateName,
      subject,
    });
    if (!isServerOutboxActive()) {
      useDemoOutboxFallback();
    }
    return { ok: true, entry: sent, source: OUTBOX_SOURCE.DEMO };
  }

  const failed = updateMailOutboxEntry(entry.id, {
    status: MAIL_STATUS.FAILED,
    error: transportResult.error ?? 'Versand fehlgeschlagen',
    provider: transportResult.provider,
  });
  logMailFailedActivity({
    to,
    templateName: failed?.templateName,
    error: failed?.error,
  });
  if (!isServerOutboxActive()) {
    useDemoOutboxFallback();
  }
  return { ok: false, entry: failed, error: failed?.error, source: OUTBOX_SOURCE.DEMO };
}

/**
 * Roh-Mail – Server bevorzugt (Browser), sonst Demo-localStorage.
 */
export async function sendViaOutbox({
  to,
  subject,
  body,
  templateId = null,
  templateName = null,
  meta = {},
}) {
  if (shouldPreferServer()) {
    const serverResult = await sendMailViaServer({
      to,
      subject,
      body,
      templateId,
      meta,
    }, apiBase);

    if (serverResult !== null) {
      logMailActivityFromEntry(serverResult.entry);
      if (serverResult.entry && isServerOutboxActive()) {
        const existing = listUnifiedMailOutbox();
        setUnifiedOutbox(
          [serverResult.entry, ...existing.filter((m) => m.id !== serverResult.entry.id)],
          OUTBOX_SOURCE.SERVER,
          true,
        );
      } else if (isServerOutboxActive()) {
        await loadMailOutboxForAdmin({ base: apiBase });
      }
      return {
        ok: serverResult.ok,
        entry: serverResult.entry,
        error: serverResult.error,
        source: OUTBOX_SOURCE.SERVER,
      };
    }
  }

  return sendViaOutboxLocal({
    to,
    subject,
    body,
    templateId,
    templateName,
    meta,
  });
}

export async function sendTemplatedMail({
  templateId,
  to,
  variables = {},
  meta = {},
}) {
  if (shouldPreferServer()) {
    const serverResult = await sendMailViaServer({
      templateId,
      to,
      variables,
      meta,
    }, apiBase);

    if (serverResult !== null) {
      logMailActivityFromEntry(serverResult.entry);
      if (isServerOutboxActive()) {
        await loadMailOutboxForAdmin({ base: apiBase });
      }
      return {
        ok: serverResult.ok,
        entry: serverResult.entry,
        error: serverResult.error,
        source: OUTBOX_SOURCE.SERVER,
      };
    }
  }

  const rendered = renderMailTemplate(templateId, variables);
  return sendViaOutboxLocal({
    to,
    subject: rendered.subject,
    body: rendered.body,
    templateId: rendered.templateId,
    templateName: rendered.templateName,
    meta,
  });
}

async function retryMailLocal(mailId) {
  const mail = findMailOutboxEntry(mailId);
  if (!mail) return { ok: false, error: 'Mail nicht gefunden' };

  const retryCount = (mail.retryCount ?? 0) + 1;
  updateMailOutboxEntry(mailId, {
    status: MAIL_STATUS.QUEUED,
    error: null,
    retryCount,
  });

  logMailRetryActivity({
    to: mail.to,
    templateName: mail.templateName,
    retryCount,
  });

  const transportResult = await sendMailTransport({
    to: mail.to,
    subject: mail.subject,
    body: mail.body ?? mail.bodyPreview,
    meta: { retryCount },
  });

  if (transportResult.ok) {
    const sent = updateMailOutboxEntry(mailId, {
      status: MAIL_STATUS.SENT,
      sentAt: new Date().toISOString(),
      error: null,
      provider: transportResult.provider,
      messageId: transportResult.messageId,
      retryCount,
    });
    logMailSentActivity({
      to: mail.to,
      templateName: mail.templateName,
      subject: mail.subject,
    });
    useDemoOutboxFallback();
    return { ok: true, entry: sent, source: OUTBOX_SOURCE.DEMO };
  }

  const failed = updateMailOutboxEntry(mailId, {
    status: MAIL_STATUS.FAILED,
    error: transportResult.error ?? 'Erneuter Versand fehlgeschlagen',
    provider: transportResult.provider,
    retryCount,
  });
  logMailFailedActivity({
    to: mail.to,
    templateName: mail.templateName,
    error: failed?.error,
  });
  useDemoOutboxFallback();
  return { ok: false, entry: failed, error: failed?.error, source: OUTBOX_SOURCE.DEMO };
}

/**
 * Retry – serverseitig wenn Server-Outbox aktiv, sonst Demo-localStorage.
 */
export async function retryMail(mailId) {
  const mail = listUnifiedMailOutbox().find((m) => m.id === mailId)
    ?? findMailOutboxEntry(mailId);

  if (isServerOutboxActive() && shouldPreferServer()) {
    logMailRetryActivity({
      to: mail?.to,
      templateName: mail?.templateName,
      retryCount: (mail?.retryCount ?? 0) + 1,
    });

    const serverResult = await retryMailViaServer(mailId, apiBase);
    if (serverResult !== null) {
      logMailActivityFromEntry(serverResult.entry);
      if (serverResult.entry) {
        patchUnifiedMailEntry(mailId, serverResult.entry);
      } else {
        await loadMailOutboxForAdmin({ base: apiBase });
      }
      return {
        ok: serverResult.ok,
        entry: serverResult.entry ?? patchUnifiedMailEntry(mailId, {}),
        error: serverResult.error,
        source: OUTBOX_SOURCE.SERVER,
      };
    }
  }

  return retryMailLocal(mailId);
}
