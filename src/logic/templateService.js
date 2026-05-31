import { buildWhatsAppLink } from './leadService.js';

export function personalizeTemplate(body, lead, dealerName = 'Autohaus Trinkle') {
  const name = lead.contact?.name?.trim() || 'Kunde';
  const vehicle = lead.vehicle?.label || 'Ihr Fahrzeug';

  let text = body
    .replace(/\{\{name\}\}/gi, name)
    .replace(/\{\{vehicle\}\}/gi, vehicle)
    .replace(/\{\{dealer\}\}/gi, dealerName);

  if (!text.toLowerCase().startsWith('hallo')) {
    text = `Hallo ${name},\n\n${text}`;
  }
  return text;
}

export function buildMailtoLink(email, subject, body) {
  if (!email) return null;
  const params = new URLSearchParams();
  if (subject) params.set('subject', subject);
  if (body) params.set('body', body);
  const qs = params.toString();
  return `mailto:${email}${qs ? `?${qs}` : ''}`;
}

export function buildShareLink(message, offerUrl) {
  const link = offerUrl ?? `${window.location.origin}/haendler/autohaus-trinkle`;
  return `${message}\n\n👉 ${link}`;
}

export async function copyToClipboard(text) {
  await navigator.clipboard.writeText(text);
}

export function openWhatsApp(phone, message) {
  window.open(buildWhatsAppLink(message, phone), '_blank', 'noopener');
}

export function openMail(email, lead, message, dealerName) {
  const subject = `Ihre Anfrage – ${lead.vehicle?.label ?? 'Fahrzeug'} | ${dealerName}`;
  const url = buildMailtoLink(email, subject, message);
  if (url) window.location.href = url;
}
