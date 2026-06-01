import { LEAD_SOURCES } from '../data/leadTypes.js';
import { getSourceLabel } from './offerService.js';

function uid(prefix = 'lead') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function historyEntry(text, type = 'system') {
  return {
    id: uid('hist'),
    at: new Date().toISOString(),
    type,
    text,
  };
}

const ACTION_LABELS = {
  inquiry: 'Anfrage gesendet',
  testdrive: 'Probefahrt angefragt',
  reserve: 'Reservierung angefragt',
  accept: 'Angebot angenommen',
  callback: 'Rückruf angefordert',
  question: 'Frage gestellt',
};

export function createLeadFromNewOffer(offer) {
  return {
    id: uid(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'angebotVersendet',
    source: offer.source ?? 'offers',
    dealerId: offer.dealer?.dealerId ?? 'autohaus-trinkle',
    offerCode: offer.code,
    contact: {
      name: offer.customer?.name ?? '',
      phone: offer.customer?.phone ?? '',
      email: offer.customer?.email ?? '',
    },
    vehicle: {
      brand: offer.vehicle.brand,
      model: offer.vehicle.model,
      trim: offer.vehicle.trim,
      engine: offer.vehicle.engine,
      label: offer.vehicle.label,
    },
    paymentType: offer.pricing.paymentType,
    desiredRate: null,
    currentRate: offer.pricing.rate,
    notes: `Angebot ${offer.code} erstellt (${getSourceLabel(offer.source)})`,
    history: [
      historyEntry(`Angebot ${offer.code} erstellt`),
      historyEntry(
        `${offer.vehicle.label} · ${offer.pricing.rate != null ? `${offer.pricing.rate} €/Monat` : 'Preis auf Anfrage'}`,
        'offer',
      ),
    ],
  };
}

export function findMatchingLead(leads, customer) {
  const email = customer.email?.trim().toLowerCase();
  const phone = customer.phone?.replace(/\D/g, '');

  if (!email && !phone) return null;

  return leads.find((lead) => {
    const lEmail = lead.contact?.email?.trim().toLowerCase();
    const lPhone = lead.contact?.phone?.replace(/\D/g, '');
    if (email && lEmail && lEmail === email) return true;
    if (phone && lPhone && phone.length >= 6 && lPhone === phone) return true;
    return false;
  }) ?? null;
}

export function linkOfferToLead(offer, lead) {
  return {
    ...lead,
    updatedAt: new Date().toISOString(),
    status: lead.status === 'neu' ? 'angebotVersendet' : lead.status,
    offerCode: offer.code,
    currentRate: offer.pricing.rate ?? lead.currentRate,
    vehicle: {
      brand: offer.vehicle.brand,
      model: offer.vehicle.model,
      trim: offer.vehicle.trim,
      engine: offer.vehicle.engine,
      label: offer.vehicle.label,
    },
    history: [
      ...(lead.history ?? []),
      historyEntry(`Verknüpft mit Angebot ${offer.code}`, 'offer'),
    ],
  };
}

export function createOrLinkLeadForOffer(offer, leads) {
  const existing = findMatchingLead(leads, offer.customer ?? {});

  if (existing) {
    return {
      lead: linkOfferToLead(offer, existing),
      leadId: existing.id,
      isNew: false,
    };
  }

  const lead = createLeadFromNewOffer(offer);
  return { lead, leadId: lead.id, isNew: true };
}

export function createLeadFromOffer(offer, action = 'inquiry', contact = {}) {
  const actionLabel = ACTION_LABELS[action] ?? 'Anfrage';
  const statusMap = {
    accept: 'bestellung',
    testdrive: 'probefahrt',
    reserve: 'bestellung',
    callback: 'interessiert',
    question: 'inBearbeitung',
    inquiry: 'neu',
  };

  return {
    id: uid(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: statusMap[action] ?? 'neu',
    source: 'offer',
    offerCode: offer.code,
    contact: {
      name: contact.name?.trim() || offer.customer?.name || '',
      phone: contact.phone?.trim() || offer.customer?.phone || '',
      email: contact.email?.trim() || offer.customer?.email || '',
    },
    vehicle: {
      brand: offer.vehicle.brand,
      model: offer.vehicle.model,
      trim: offer.vehicle.trim,
      engine: offer.vehicle.engine,
      label: offer.vehicle.label,
    },
    paymentType: offer.pricing.paymentType,
    desiredRate: null,
    currentRate: offer.pricing.rate,
    notes: `${actionLabel} via Angebotslink ${offer.code}`,
    history: [
      historyEntry(`Anfrage über Angebotslink /angebot/${offer.code}`),
      historyEntry(actionLabel, 'note'),
    ],
  };
}

export { LEAD_SOURCES };
