import { loadPilotLeads, upsertPilotLead } from './pilotLeadsStore.js';
import { normalizeLead } from '../src/logic/leadNormalization.js';
import { generateOfferNumber } from '../src/logic/offerService.js';
import { upsertLeadFromOfferAction } from '../src/logic/offerDialogService.js';
import { createCustomerId } from '../src/services/dealerAiCustomer.js';
import { sendCustomerInquiryMails } from '../src/services/mail/mailFlowService.js';

function collectReferenceCodes(leads = []) {
  const codes = [];
  for (const lead of leads) {
    if (lead.referenceCode) codes.push({ code: lead.referenceCode });
    if (lead.offerCode) codes.push({ code: lead.offerCode });
  }
  return codes;
}

function withReferenceCode(lead, leads) {
  if (lead.referenceCode || lead.offerCode) return lead;
  return {
    ...lead,
    referenceCode: generateOfferNumber(collectReferenceCodes(leads)),
  };
}

function mergeLead(existing, incoming) {
  return normalizeLead({
    ...existing,
    ...incoming,
    id: existing.id,
    contact: { ...existing.contact, ...incoming.contact },
    history: [...(existing.history ?? []), ...(incoming.history ?? [])].filter(
      (entry, index, list) => list.findIndex((e) => e.id === entry.id) === index,
    ),
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Kundenanfrage vom Frontend → Verkaufschance im Backend (Pilot-Leads Store).
 */
export async function processCustomerInquiry(body = {}) {
  const data = loadPilotLeads();
  const leads = data.leads ?? [];

  if (body.type === 'offer_action' && body.offer) {
    const result = upsertLeadFromOfferAction({
      offer: body.offer,
      action: body.action ?? 'inquiry',
      contact: body.contact ?? {},
      message: body.message ?? '',
      sonderwuensche: body.sonderwuensche ?? {},
      leads,
    });

    const lead = normalizeLead(withReferenceCode({
      ...result.lead,
      customerId: result.lead.customerId ?? createCustomerId(),
      dealerId: result.lead.dealerId ?? body.offer.dealer?.dealerId ?? 'autohaus-trinkle',
    }, leads));

    upsertPilotLead(lead);
    const mail = result.isNew
      ? await sendCustomerInquiryMails({ lead })
      : null;
    return { ok: true, lead, leadId: lead.id, isNew: result.isNew, mail };
  }

  const incoming = body.lead;
  if (!incoming?.id) {
    return { ok: false, message: 'lead.id required' };
  }

  const byId = leads.find((l) => l.id === incoming.id);
  const byOfferCode = incoming.offerCode
    ? leads.find((l) => l.offerCode?.toUpperCase() === String(incoming.offerCode).toUpperCase())
    : null;

  let isNew = false;
  let lead;

  if (byId) {
    lead = mergeLead(byId, incoming);
  } else if (byOfferCode) {
    lead = mergeLead(byOfferCode, incoming);
  } else {
    isNew = true;
    const now = new Date().toISOString();
    lead = normalizeLead(withReferenceCode({
      ...incoming,
      customerId: incoming.customerId ?? createCustomerId(),
      dealerId: incoming.dealerId ?? 'autohaus-trinkle',
      status: incoming.status ?? 'neu',
      createdAt: incoming.createdAt ?? now,
      updatedAt: now,
    }, leads));
  }

  upsertPilotLead(lead);
  const mail = isNew
    ? await sendCustomerInquiryMails({ lead })
    : null;
  return { ok: true, lead, leadId: lead.id, isNew, mail };
}
