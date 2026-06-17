/**
 * Einstieg in die Kundenakte aus dem Backend (Leads → parsed → Follow-up)
 */
import { LEAD_SOURCES, PAYMENT_TYPES } from '../data/leadTypes.js';
import { parseDealerAiInput, applyDealerAiFields } from './dealerAiParser.js';
import { buildSalesDoneVehicleLine } from './dealerAiParser.js';
import { matchesNewRequestsView, matchesNeedsOfferView } from '../logic/backendKpiNavigation.js';

const SOURCE_ALIASES = {
  dealerAi: 'Verkaufsassistent',
  landing: 'Landingpage',
  dealerJourney: 'Landingpage',
  dealerSearch: 'Landingpage',
};

export function getNewInquiryLeads(leads = []) {
  return leads
    .filter((lead) => matchesNewRequestsView(lead))
    .sort((a, b) => new Date(b.createdAt ?? 0) - new Date(a.createdAt ?? 0));
}

export function getNeedsOfferLeads(leads = [], linkedOffers = []) {
  return leads
    .filter((lead) => matchesNeedsOfferView(lead, linkedOffers))
    .sort((a, b) => new Date(b.updatedAt ?? 0) - new Date(a.updatedAt ?? 0));
}

export function formatInquiryPaymentLabel(lead = {}) {
  const pt = lead.paymentType ?? 'unknown';
  return PAYMENT_TYPES[pt]?.label ?? 'Angebot offen';
}

export function getLeadSourceLabel(source) {
  if (!source) return 'Unbekannt';
  return SOURCE_ALIASES[source] ?? LEAD_SOURCES[source] ?? source;
}

export function formatInquiryCustomerName(lead = {}) {
  const name = lead.contact?.name?.trim();
  if (!name || name === 'Kunde (offen)' || name === 'Kunde noch offen') {
    return 'Kunde noch offen';
  }
  return name;
}

export function formatInquiryVehicleLine(lead = {}) {
  if (lead.vehicle?.label?.trim()) return lead.vehicle.label;
  return buildSalesDoneVehicleLine({
    brand: lead.vehicle?.brand ?? 'Kia',
    model: lead.vehicle?.model ?? '',
    trimLabel: lead.vehicle?.trim ?? '',
    paymentType: lead.paymentType ?? 'unknown',
  }) || 'Fahrzeug offen';
}

export function getLeadReferenceCode(lead = {}) {
  return lead.referenceCode ?? lead.offerCode ?? null;
}

function buildTextFromLead(lead = {}) {
  if (lead.notes?.trim()) return lead.notes.trim();

  const parts = [];
  const vehicleLine = formatInquiryVehicleLine(lead);
  if (vehicleLine && vehicleLine !== 'Fahrzeug offen') parts.push(vehicleLine);

  const payment = PAYMENT_TYPES[lead.paymentType]?.label;
  if (payment) parts.push(payment);

  if (lead.desiredRate) parts.push(`${lead.desiredRate} Euro pro Monat`);
  if (lead.wish?.desiredPrice) parts.push(`${lead.wish.desiredPrice} Euro Kaufpreis`);

  return parts.join(' · ') || 'Kia';
}

export function buildParsedFromLead(lead, enrich) {
  const text = buildTextFromLead(lead);
  let parsed = parseDealerAiInput(text);

  if (!parsed?.ok) {
    parsed = {
      ok: true,
      confidence: 0.55,
      fields: {
        brand: lead.vehicle?.brand ?? 'Kia',
        model: lead.vehicle?.model ?? '',
        trimLabel: lead.vehicle?.trim ?? '',
        paymentType: lead.paymentType ?? 'unknown',
        desiredRate: lead.desiredRate ?? null,
        desiredPrice: lead.wish?.desiredPrice ?? null,
        termMonths: lead.wish?.termMonths ?? null,
        mileagePerYear: lead.wish?.mileagePerYear ?? null,
        customerName: lead.contact?.name ?? '',
      },
      shortForm: text,
    };
  }

  parsed = applyDealerAiFields(parsed, {
    model: lead.vehicle?.model ?? parsed.fields?.model,
    brand: lead.vehicle?.brand ?? 'Kia',
    trimLabel: lead.vehicle?.trim ?? parsed.fields?.trimLabel,
    paymentType: lead.paymentType ?? parsed.fields?.paymentType,
    desiredRate: lead.desiredRate ?? parsed.fields?.desiredRate,
    desiredPrice: lead.wish?.desiredPrice ?? parsed.fields?.desiredPrice,
    termMonths: lead.wish?.termMonths ?? parsed.fields?.termMonths,
    mileagePerYear: lead.wish?.mileagePerYear ?? parsed.fields?.mileagePerYear,
    customerName: lead.contact?.name ?? parsed.fields?.customerName,
  });

  return enrich ? enrich(parsed) : parsed;
}

export function buildKundenaktePath(leadId) {
  return `/backend/kundenakte/${encodeURIComponent(leadId)}`;
}
