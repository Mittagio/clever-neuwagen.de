import { DOCUMENT_TYPES } from '../data/communicationTypes.js';
import {
  buildOfferUrl,
  buildOfferEmailContent,
  createOffer,
  markOfferSent,
} from './offerService.js';
import { buildShareLink, openMail, openWhatsApp } from './templateService.js';

export function createCommunicationHistoryEntry(text, type = 'communication', meta = {}) {
  return {
    id: `hist-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    at: new Date().toISOString(),
    type,
    text,
    direction: meta.direction ?? 'outbound',
    channel: meta.channel ?? null,
    templateId: meta.templateId ?? null,
    offerCode: meta.offerCode ?? null,
    documentType: meta.documentType ?? null,
    subject: meta.subject ?? null,
  };
}

export function formatTimelineDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatTimelineTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

export function groupHistoryByDay(history = []) {
  const sorted = [...history].sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
  );
  const groups = new Map();
  for (const entry of sorted) {
    const day = formatTimelineDate(entry.at);
    if (!groups.has(day)) groups.set(day, []);
    groups.get(day).push(entry);
  }
  return [...groups.entries()].map(([date, items]) => ({ date, items }));
}

export function getDocumentLabel(docId) {
  return DOCUMENT_TYPES.find((d) => d.id === docId)?.label ?? docId;
}

export function addDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(9, 0, 0, 0);
  return d.toISOString();
}

export function isReminderDueToday(reminder) {
  if (reminder.done) return false;
  const due = new Date(reminder.dueAt);
  const now = new Date();
  return (
    due.getFullYear() === now.getFullYear()
    && due.getMonth() === now.getMonth()
    && due.getDate() === now.getDate()
  );
}

export function createOfferFromLead(lead, conditions, existingOffers) {
  if (lead.offerCode) {
    const existing = existingOffers.find(
      (o) => o.code?.toUpperCase() === lead.offerCode.toUpperCase(),
    );
    if (existing) return markOfferSent(existing);
  }

  const offer = createOffer({
    customer: lead.contact ?? {},
    conditions,
    existingOffers,
    source: 'communication',
    status: 'versendet',
    leadId: lead.id,
    config: {
      paymentType: lead.paymentType ?? 'leasing',
    },
  });

  if (lead.vehicle?.label) {
    offer.vehicle = { ...offer.vehicle, label: lead.vehicle.label };
  }
  if (lead.currentRate != null) {
    offer.pricing = { ...offer.pricing, rate: lead.currentRate };
  }

  return markOfferSent(offer);
}

export function buildOfferSendMail(offer, url) {
  return buildOfferEmailContent(offer, url);
}

export function sendEmailToLead(lead, message, dealerName, subject) {
  const sub = subject ?? `Ihre Anfrage – ${lead.vehicle?.label ?? 'Fahrzeug'} | ${dealerName}`;
  openMail(lead.contact?.email, lead, message, dealerName);
  return { subject: sub, channel: 'email' };
}

export function sendWhatsAppToLead(lead, message, offerUrl) {
  const text = offerUrl ? buildShareLink(message, offerUrl) : message;
  openWhatsApp(lead.contact?.phone, text);
  return { channel: 'whatsapp' };
}

export function buildDocumentMailBody(lead, docType, dealerName) {
  const label = getDocumentLabel(docType);
  const vehicle = lead.vehicle?.label ?? 'Ihr Fahrzeug';
  return `Hallo ${lead.contact?.name?.trim() || 'Kunde'},\n\nanbei erhalten Sie: ${label} (${vehicle}).\n\nBei Rückfragen melden Sie sich gerne.\n\nFreundliche Grüße\n${dealerName}`;
}

export { buildOfferUrl };
