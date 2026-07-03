import { enqueueMail, getAdminLeitstandState, updateMailStatus } from './adminLeitstandStore.js';
import { sendMockEmail } from '../../mockMailService.js';

export const MAIL_OUTBOX_STATUS = {
  queued: { id: 'queued', label: 'Wird gesendet', emoji: '⏳' },
  sent: { id: 'sent', label: 'Versendet', emoji: '✅' },
  failed: { id: 'failed', label: 'Fehlgeschlagen', emoji: '❌' },
};

export const MAIL_FROM = 'info@clever-neuwagen.de';

export const MAIL_TEMPLATE_IDS = [
  'login-code',
  'passwordless-access',
  'customer-confirmation',
  'inquiry-received',
  'dealer-notification',
  'offer-link',
  'reminder',
  'document-upload',
  'self-disclosure',
  'onboarding',
  'dealer-approved',
  'system-alert',
  'support',
  'invoice',
  'follow-up',
];

export function listMailOutbox() {
  return getAdminLeitstandState().mailOutbox ?? [];
}

export function countFailedMails() {
  return listMailOutbox().filter((m) => m.status === 'failed').length;
}

export async function sendViaOutbox({ to, subject, body, templateId }) {
  const entry = enqueueMail({
    to,
    subject,
    templateId,
    status: 'queued',
  });

  try {
    const result = await sendMockEmail({
      to,
      subject,
      body,
      templateId,
    });
    if (result.ok) {
      updateMailStatus(entry.id, 'sent');
      return { ok: true, entry: { ...entry, status: 'sent' } };
    }
    updateMailStatus(entry.id, 'failed', 'Versand abgelehnt');
    return { ok: false, entry };
  } catch (err) {
    updateMailStatus(entry.id, 'failed', err.message ?? 'Unbekannter Fehler');
    return { ok: false, entry, error: err.message };
  }
}

export function retryMail(mailId) {
  const mail = listMailOutbox().find((m) => m.id === mailId);
  if (!mail) return null;
  updateMailStatus(mailId, 'queued');
  return sendViaOutbox({
    to: mail.to,
    subject: mail.subject,
    templateId: mail.templateId,
    body: '',
  });
}
