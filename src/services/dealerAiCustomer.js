import { PAYMENT_TYPE_LABELS, formatCustomerDisplayName } from './dealerAiParser.js';

export function createCustomerId() {
  return `cust-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export function resolveCustomerId(lead) {
  if (!lead) return null;
  return lead.customerId ?? lead.id;
}

export function extractCarryCustomerFromLead(lead) {
  if (!lead) return null;
  const name = formatCustomerDisplayName(lead.contact?.name);
  if (!name) return null;
  return {
    customerId: resolveCustomerId(lead),
    contact: {
      name: lead.contact.name,
      phone: lead.contact?.phone ?? '',
      email: lead.contact?.email ?? '',
    },
    kundenhelfer: lead.crm?.kundenhelfer ?? null,
    ownerName: lead.ownerName ?? null,
  };
}

export function getRelatedLeadsByCustomer(leads = [], lead) {
  if (!lead) return [];
  const cid = resolveCustomerId(lead);
  return leads
    .filter((l) => resolveCustomerId(l) === cid)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export function formatRelatedWishLine(lead) {
  const code = lead.referenceCode ?? lead.offerCode;
  const vehicle = lead.vehicle?.label
    ?? [lead.vehicle?.brand, lead.vehicle?.model].filter(Boolean).join(' ');
  const payment = PAYMENT_TYPE_LABELS[lead.paymentType ?? lead.wish?.paymentType]
    ?.replace(' / Barzahlung', '')
    ?? null;
  const parts = [code, vehicle, payment].filter(Boolean);
  return parts.join(' · ');
}

export function hasKnownCustomerContact(contact = {}) {
  return Boolean(formatCustomerDisplayName(contact?.name));
}
