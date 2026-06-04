import { sportage } from '../data/kiaSportage.js';
import { LEAD_SOURCES } from '../data/leadTypes.js';
import { getLeadBriefPreview } from './dealerInquiryBrief.js';

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

export function buildVehicleLabel(config) {
  const trim = sportage.trims.find((t) => t.id === config.trimId);
  const engine = sportage.engines.find((e) => e.id === config.engineId);
  return {
    brand: sportage.brand,
    model: sportage.model,
    trim: trim?.name ?? '',
    engine: engine?.name ?? '',
    label: `${sportage.model} ${trim?.name ?? ''}`.trim(),
  };
}

export function createLeadFromSales(customer, offer, conditions) {
  const vehicle = offer
    ? {
        brand: offer.brand ?? 'Kia',
        model: offer.model ?? offer.label?.split(' ')[0] ?? 'Sportage',
        trim: offer.variant ?? offer.label ?? '',
        engine: '',
        label: offer.label ?? `${offer.model} ${offer.variant}`,
      }
    : {
        brand: 'Kia',
        model: 'Sportage',
        trim: '',
        engine: '',
        label: 'Sportage',
      };

  return {
    id: uid(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'neu',
    source: 'sales',
    dealerId: conditions.dealerId,
    contact: {
      name: customer.name?.trim() ?? '',
      phone: customer.phone?.trim() ?? '',
      email: customer.email?.trim() ?? '',
    },
    vehicle,
    paymentType: 'leasing',
    desiredRate: Number(customer.desiredRate) || null,
    currentRate: offer?.monthlyRate ?? null,
    notes: '',
    history: [
      historyEntry(`Anfrage aus ${LEAD_SOURCES.sales}`),
      ...(offer
        ? [historyEntry(`Vorschlag: ${offer.label} · ${offer.monthlyRate} €/Monat`, 'offer')]
        : []),
    ],
  };
}

export function createLeadFromConfigurator(config, price, conditions) {
  const vehicle = buildVehicleLabel(config);

  return {
    id: uid(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'neu',
    source: 'configurator',
    dealerId: conditions.dealerId,
    contact: { name: '', phone: '', email: '' },
    vehicle,
    paymentType: config.paymentType ?? 'leasing',
    desiredRate: null,
    currentRate: price?.primaryRate ?? price?.leasingRate ?? null,
    notes: '',
    history: [historyEntry(`Anfrage über ${LEAD_SOURCES.configurator}`)],
  };
}

export function mergeLeadContact(existing, contact) {
  return {
    name: contact.name?.trim() || existing.contact.name,
    phone: contact.phone?.trim() || existing.contact.phone,
    email: contact.email?.trim() || existing.contact.email,
  };
}

export function formatLeadTime(iso) {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Gerade eben';
  if (mins < 60) return `vor ${mins} Min.`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `vor ${hours} Std.`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Gestern';
  if (days < 7) return `vor ${days} Tagen`;
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
}

export function formatRate(value) {
  if (value == null || Number.isNaN(value)) return '–';
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value);
}

export function getLeadPreview(lead) {
  const briefPreview = lead.inquiryBrief ? getLeadBriefPreview(lead.inquiryBrief) : null;
  if (briefPreview) return briefPreview;
  const last = lead.history?.[lead.history.length - 1];
  return last?.text ?? lead.vehicle?.label ?? 'Neue Anfrage';
}

export function buildWhatsAppLink(message, phone) {
  const digits = (phone ?? '').replace(/\D/g, '');
  const base = digits ? `https://wa.me/${digits}` : 'https://wa.me/';
  return `${base}?text=${encodeURIComponent(message)}`;
}

export function getInitials(name) {
  if (!name?.trim()) return '?';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}
