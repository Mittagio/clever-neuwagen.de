import { Router } from 'express';
import { MAIL_FROM, isMailProductionReady } from '../../src/services/mail/mailConfig.js';
import { renderMailTemplate } from '../../src/services/mail/mailRenderer.js';
import { listMailTemplates, getMailTemplate } from '../../src/services/mail/mailTemplateRegistry.js';
import { sendMailTransport, getActiveTransportLabel } from '../../src/services/mail/mailTransport.js';
import { MAIL_STATUS } from '../../src/services/mail/mailTypes.js';
import {
  appendServerMailEntry,
  findServerMailEntry,
  listServerMailOutbox,
  updateServerMailEntry,
} from './mailStore.js';

const router = Router();

let mailIdSeq = 0;
function nextMailId() {
  mailIdSeq += 1;
  return `srv-mail-${Date.now()}-${mailIdSeq}`;
}

router.get('/mail/outbox', (_req, res) => {
  res.json({ ok: true, items: listServerMailOutbox() });
});

router.get('/mail/templates', (_req, res) => {
  res.json({ ok: true, templates: listMailTemplates(), from: MAIL_FROM });
});

router.get('/mail/status', (_req, res) => {
  res.json({
    ok: true,
    from: MAIL_FROM,
    transport: getActiveTransportLabel(),
    productionReady: isMailProductionReady(),
  });
});

router.post('/mail/send', async (req, res) => {
  const { to, subject, body, templateId, variables = {}, meta = {} } = req.body ?? {};

  if (!to) {
    res.status(400).json({ ok: false, error: 'Empfänger (to) fehlt' });
    return;
  }

  let mailSubject = subject;
  let mailBody = body;
  let templateName = null;
  let resolvedTemplateId = templateId ?? null;

  if (templateId) {
    const template = getMailTemplate(templateId);
    if (!template) {
      res.status(400).json({ ok: false, error: `Template nicht gefunden: ${templateId}` });
      return;
    }
    const rendered = renderMailTemplate(templateId, variables);
    mailSubject = rendered.subject;
    mailBody = rendered.body;
    templateName = rendered.templateName;
  }

  if (!mailSubject || !mailBody) {
    res.status(400).json({ ok: false, error: 'Betreff und Inhalt erforderlich (oder templateId mit variables)' });
    return;
  }

  const entry = {
    id: nextMailId(),
    to,
    from: MAIL_FROM.email,
    subject: mailSubject,
    body: mailBody,
    bodyPreview: mailBody.slice(0, 160),
    templateId: resolvedTemplateId,
    templateName,
    status: MAIL_STATUS.QUEUED,
    error: null,
    createdAt: new Date().toISOString(),
    sentAt: null,
    provider: getActiveTransportLabel(),
    retryCount: 0,
    meta,
  };
  appendServerMailEntry(entry);

  const transportResult = await sendMailTransport({
    to,
    subject: mailSubject,
    body: mailBody,
    meta,
  });

  if (transportResult.ok) {
    const sent = updateServerMailEntry(entry.id, {
      status: MAIL_STATUS.SENT,
      sentAt: new Date().toISOString(),
      messageId: transportResult.messageId,
      provider: transportResult.provider,
    });
    res.json({ ok: true, entry: sent });
    return;
  }

  const failed = updateServerMailEntry(entry.id, {
    status: MAIL_STATUS.FAILED,
    error: transportResult.error ?? 'Versand fehlgeschlagen',
    provider: transportResult.provider,
  });
  res.status(502).json({ ok: false, entry: failed, error: failed.error });
});

router.post('/mail/outbox/:mailId/retry', async (req, res) => {
  const mail = findServerMailEntry(req.params.mailId);
  if (!mail) {
    res.status(404).json({ ok: false, error: 'Mail nicht gefunden' });
    return;
  }

  const retryCount = (mail.retryCount ?? 0) + 1;
  updateServerMailEntry(mail.id, { status: MAIL_STATUS.QUEUED, error: null, retryCount });

  const transportResult = await sendMailTransport({
    to: mail.to,
    subject: mail.subject,
    body: mail.body ?? mail.bodyPreview,
    meta: { retryCount },
  });

  if (transportResult.ok) {
    const sent = updateServerMailEntry(mail.id, {
      status: MAIL_STATUS.SENT,
      sentAt: new Date().toISOString(),
      messageId: transportResult.messageId,
      provider: transportResult.provider,
      retryCount,
    });
    res.json({ ok: true, entry: sent });
    return;
  }

  const failed = updateServerMailEntry(mail.id, {
    status: MAIL_STATUS.FAILED,
    error: transportResult.error ?? 'Erneuter Versand fehlgeschlagen',
    provider: transportResult.provider,
    retryCount,
  });
  res.status(502).json({ ok: false, entry: failed, error: failed.error });
});

export default router;
