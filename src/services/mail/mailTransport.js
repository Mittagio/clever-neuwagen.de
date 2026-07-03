import { MAIL_TRANSPORT, MAIL_FROM_DISPLAY, resolveMailTransport } from './mailConfig.js';
import { sendViaMockTransport } from './mockMailTransport.js';
import { sendViaResendTransport } from './resendMailTransport.js';

/**
 * @param {{ to: string, subject: string, body: string, from?: string, meta?: object }} payload
 */
export async function sendMailTransport(payload = {}) {
  const transport = resolveMailTransport();
  const from = payload.from ?? MAIL_FROM_DISPLAY;
  const base = { ...payload, from };

  switch (transport) {
    case MAIL_TRANSPORT.RESEND:
      return sendViaResendTransport(base);
    case MAIL_TRANSPORT.SMTP:
      return {
        ok: false,
        provider: 'smtp',
        error: 'SMTP-Transport noch nicht implementiert – MAIL_TRANSPORT=mock oder resend nutzen',
        messageId: null,
      };
    case MAIL_TRANSPORT.MOCK:
    default:
      return sendViaMockTransport({
        ...base,
        simulateFailure: payload.meta?.simulateFailure === true,
        failureReason: payload.meta?.failureReason,
      });
  }
}

export function getActiveTransportLabel() {
  const t = resolveMailTransport();
  if (t === MAIL_TRANSPORT.RESEND) return 'Resend (API)';
  if (t === MAIL_TRANSPORT.SMTP) return 'SMTP';
  return 'Mock (Entwicklung)';
}
