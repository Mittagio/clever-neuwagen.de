/**
 * Phase-1-Kompatibilität – bitte mailService.sendTemplatedMail nutzen.
 */
import { sendViaOutbox } from './mail/mailOutboxService.js';

export async function sendMockEmail({ to, subject, body, leadId, templateId, meta = {} }) {
  const result = await sendViaOutbox({
    to,
    subject,
    body,
    templateId,
    meta: { ...meta, leadId },
  });
  return {
    ok: result.ok,
    entry: result.entry,
    error: result.error,
  };
}
