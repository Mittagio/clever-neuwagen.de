/** Resend-Adapter – aktivieren via VITE_EMAIL_PROVIDER=resend */

export async function sendResendEmail({ to, subject, body, html, from }) {
  const apiKey = import.meta.env.VITE_RESEND_API_KEY;
  const fromAddress = from ?? import.meta.env.VITE_EMAIL_FROM ?? 'info@clever-neuwagen.de';

  if (!apiKey) {
    return {
      ok: false,
      error: 'VITE_RESEND_API_KEY fehlt',
      provider: 'resend',
    };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [to],
        subject,
        html: html ?? body?.replace(/\n/g, '<br>'),
        text: body,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return { ok: false, error: err, provider: 'resend' };
    }

    const data = await res.json();
    return {
      ok: true,
      messageId: data.id,
      sentAt: new Date().toISOString(),
      provider: 'resend',
    };
  } catch (err) {
    return { ok: false, error: err.message, provider: 'resend' };
  }
}
