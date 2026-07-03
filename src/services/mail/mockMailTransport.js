/**
 * Mock-Transport – Entwicklung & Tests ohne echten Versand.
 */

export async function sendViaMockTransport({
  to,
  subject,
  body,
  from,
  simulateFailure = false,
  failureReason = 'Simulierter Versandfehler',
} = {}) {
  await new Promise((r) => setTimeout(r, 50));

  if (simulateFailure) {
    return {
      ok: false,
      provider: 'mock',
      error: failureReason,
      messageId: null,
    };
  }

  if (!to || !subject) {
    return {
      ok: false,
      provider: 'mock',
      error: 'Empfänger oder Betreff fehlt',
      messageId: null,
    };
  }

  const messageId = `mock-${Date.now()}`;

  if (typeof console !== 'undefined') {
    console.info('[MockMailTransport]', { to, subject, from, messageId });
  }

  return {
    ok: true,
    provider: 'mock',
    messageId,
    error: null,
  };
}
