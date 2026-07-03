/**
 * Resend-Transport – aktiv wenn RESEND_API_KEY gesetzt ist.
 * Noch kein Hardcoding des Anbieters in der App-Logik; nur hier.
 */

import { MAIL_FROM } from './mailConfig.js';

export async function sendViaResendTransport({ to, subject, body, from } = {}) {
  const apiKey = typeof process !== 'undefined' ? process.env?.RESEND_API_KEY : null;

  if (!apiKey) {
    return {
      ok: false,
      provider: 'resend',
      error: 'RESEND_API_KEY nicht konfiguriert',
      messageId: null,
    };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: from ?? `${MAIL_FROM.name} <${MAIL_FROM.email}>`,
        to: [to],
        subject,
        text: body,
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        ok: false,
        provider: 'resend',
        error: data?.message ?? `Resend HTTP ${response.status}`,
        messageId: null,
      };
    }

    return {
      ok: true,
      provider: 'resend',
      messageId: data?.id ?? null,
      error: null,
    };
  } catch (err) {
    return {
      ok: false,
      provider: 'resend',
      error: err.message ?? 'Resend Netzwerkfehler',
      messageId: null,
    };
  }
}
