import { DEALER_SELLERS } from '../data/salesChanceTypes.js';
import { EMPTY_SONDERWUESNCHE } from '../data/offerDialogTypes.js';

export function normalizeLead(lead) {
  if (!lead) return lead;

  const seller = DEALER_SELLERS.find((s) => s.id === lead.ownerId);

  return {
    ...lead,
    contact: {
      plz: '',
      preferredContact: 'phone',
      ...lead.contact,
    },
    wish: {
      termMonths: 48,
      mileagePerYear: 15000,
      downPayment: 0,
      customerGroup: 'standard',
      discountType: 'none',
      paymentType: lead.paymentType ?? 'leasing',
      ...lead.wish,
    },
    ownerId: lead.ownerId ?? null,
    ownerName: lead.ownerName ?? seller?.name ?? null,
    assignedAt: lead.assignedAt ?? null,
    listPrice: lead.listPrice ?? null,
    deliveryTime: lead.deliveryTime ?? null,
    complianceStatus: lead.complianceStatus ?? 'ok',
    sonderwuensche: {
      ...EMPTY_SONDERWUESNCHE,
      ...(lead.sonderwuensche ?? {}),
    },
    documents: lead.documents ?? [],
  };
}

export function normalizeLeads(leads) {
  return leads.map(normalizeLead);
}
