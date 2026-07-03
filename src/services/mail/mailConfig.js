/**
 * Zentrale Mail-Konfiguration – Clever Neuwagen
 */

export const MAIL_FROM = {
  email: 'info@clever-neuwagen.de',
  name: 'Clever Neuwagen',
};

export const MAIL_FROM_DISPLAY = `${MAIL_FROM.name} <${MAIL_FROM.email}>`;

export const MAIL_TRANSPORT = {
  MOCK: 'mock',
  RESEND: 'resend',
  SMTP: 'smtp',
};

/** @returns {string} */
export function resolveMailTransport() {
  if (typeof process !== 'undefined' && process.env?.MAIL_TRANSPORT) {
    return process.env.MAIL_TRANSPORT;
  }
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_MAIL_TRANSPORT) {
    return import.meta.env.VITE_MAIL_TRANSPORT;
  }
  return MAIL_TRANSPORT.MOCK;
}

export function isMailProductionReady() {
  const transport = resolveMailTransport();
  if (transport === MAIL_TRANSPORT.MOCK) return false;
  if (transport === MAIL_TRANSPORT.RESEND) {
    return Boolean(process.env?.RESEND_API_KEY);
  }
  if (transport === MAIL_TRANSPORT.SMTP) {
    return Boolean(process.env?.SMTP_HOST && process.env?.SMTP_USER);
  }
  return false;
}
