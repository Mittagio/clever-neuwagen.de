/**
 * Phase 1: Mock-E-Mail-Versand (Protokoll in Console + Rückgabe für Historie)
 * Phase 2: Resend / SMTP
 */

export async function sendMockEmail({ to, subject, body, leadId, templateId }) {
  await new Promise((r) => setTimeout(r, 400));

  const entry = {
    id: `mail-${Date.now()}`,
    to,
    subject,
    bodyPreview: body?.slice(0, 120) ?? '',
    leadId,
    templateId,
    sentAt: new Date().toISOString(),
    provider: 'mock',
    status: 'sent',
  };

  if (typeof console !== 'undefined') {
    console.info('[MockMail]', entry);
  }

  return { ok: true, entry };
}
