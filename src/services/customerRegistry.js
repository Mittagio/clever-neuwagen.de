/**
 * Kunde ↔ Verkaufschance ↔ Angebot – lokale Registry aus Leads (Mock bis Backend).
 */
import { PAYMENT_TYPE_LABELS, formatCustomerDisplayName } from './dealerAiParser.js';
import { createCustomerId, resolveCustomerId } from './dealerAiCustomer.js';

const OPEN_LEAD_STATUSES = new Set([
  'neu', 'interessiert', 'inBearbeitung', 'angebotVersendet', 'probefahrt', 'bestellung',
]);

function normalizePhone(value = '') {
  return String(value).replace(/\D/g, '');
}

function normalizeEmail(value = '') {
  return String(value).trim().toLowerCase();
}

function normalizeName(value = '') {
  return String(value).trim().toLowerCase();
}

function paymentShort(lead) {
  const pt = lead.paymentType ?? lead.wish?.paymentType;
  const label = PAYMENT_TYPE_LABELS[pt];
  return label?.replace(' / Barzahlung', '') ?? null;
}

function formatRelativeDays(iso) {
  if (!iso) return null;
  const diff = Math.round((Date.now() - new Date(iso).getTime()) / 86400000);
  if (diff <= 0) return 'heute';
  if (diff === 1) return 'gestern';
  if (diff < 7) return `vor ${diff} Tagen`;
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
}

function countOffersForLead(lead) {
  const crmOffers = lead.crm?.offers?.length ?? 0;
  return crmOffers + (lead.offerCode ? 1 : 0);
}

function isOpenLead(lead) {
  return OPEN_LEAD_STATUSES.has(lead.status);
}

/**
 * Aggregiert Leads zu Kundenprofilen (ein Kunde → n Verkaufschancen).
 */
export function buildCustomerProfiles(leads = []) {
  const groups = new Map();

  for (const lead of leads) {
    const cid = resolveCustomerId(lead);
    if (!groups.has(cid)) groups.set(cid, []);
    groups.get(cid).push(lead);
  }

  const profiles = [];

  for (const [customerId, groupLeads] of groups) {
    const sorted = [...groupLeads].sort(
      (a, b) => new Date(b.updatedAt ?? b.createdAt) - new Date(a.updatedAt ?? a.createdAt),
    );
    const primary = sorted.find((l) => formatCustomerDisplayName(l.contact?.name)) ?? sorted[0];
    const name = formatCustomerDisplayName(primary?.contact?.name);
    if (!name) continue;

    const opportunities = sorted;
    const openOpportunities = opportunities.filter(isOpenLead);
    const offerCount = opportunities.reduce((sum, l) => sum + countOffersForLead(l), 0);
    const openOffers = opportunities.filter((l) => l.offerCode || (l.crm?.offers?.length ?? 0) > 0)
      .filter(isOpenLead);

    const latest = sorted[0];
    const latestVehicle = latest.vehicle?.label
      ?? [latest.vehicle?.brand, latest.vehicle?.model].filter(Boolean).join(' ');
    const latestPayment = paymentShort(latest);

    profiles.push({
      customerId,
      contact: {
        name: primary.contact.name,
        phone: primary.contact?.phone ?? '',
        email: primary.contact?.email ?? '',
        company: primary.crm?.company ?? '',
      },
      kundenhelfer: primary.crm?.kundenhelfer ?? null,
      ownerId: primary.ownerId ?? null,
      ownerName: primary.ownerName ?? null,
      lastContactAt: latest.updatedAt ?? latest.createdAt,
      opportunities,
      opportunityCount: opportunities.length,
      activeOpportunityCount: openOpportunities.length,
      offerCount,
      openOfferCount: openOffers.length,
      lastOpportunityLabel: [latestVehicle, latestPayment].filter(Boolean).join(' · '),
      primaryLeadId: primary.id,
    });
  }

  return profiles;
}

export function buildCustomerHintLines(profile) {
  if (!profile) return [];
  const lines = [];
  if (profile.openOfferCount > 0) {
    lines.push(`${profile.openOfferCount} offene Angebot${profile.openOfferCount > 1 ? 'e' : ''}`);
  } else if (profile.activeOpportunityCount > 0) {
    lines.push(`${profile.activeOpportunityCount} aktive Verkaufschance${profile.activeOpportunityCount > 1 ? 'n' : ''}`);
  }
  if (profile.lastOpportunityLabel) {
    lines.push(`Letztes Angebot: ${profile.lastOpportunityLabel}`);
  }
  if (profile.ownerName) {
    lines.push(`Betreut von: ${profile.ownerName}`);
  }
  const rel = formatRelativeDays(profile.lastContactAt);
  if (rel) {
    lines.push(`Letzter Kontakt: ${rel}`);
  }
  return lines.slice(0, 3);
}

export function buildSellerHint(profile) {
  if (!profile?.ownerName) return null;
  const label = profile.lastOpportunityLabel;
  if (label) {
    return `Kollege ${profile.ownerName} hat bereits ein ${label}-Angebot gerechnet.`;
  }
  return `Betreut von ${profile.ownerName}`;
}

export function profileToCarryCustomer(profile) {
  if (!profile) return null;
  return {
    customerId: profile.customerId,
    contact: {
      name: profile.contact.name,
      phone: profile.contact.phone ?? '',
      email: profile.contact.email ?? '',
    },
    kundenhelfer: profile.kundenhelfer ?? null,
    ownerName: profile.ownerName ?? null,
  };
}

/**
 * Sucht Kunden in bestehenden Leads (Name, Telefon, E-Mail).
 * @returns {{ matches: Array, strongMatch: object|null, title: string }}
 */
export function searchCustomers(leads = [], query = {}, options = {}) {
  const { excludeLeadId = null, excludeCustomerId = null, limit = 5 } = options;
  const profiles = buildCustomerProfiles(leads).filter((p) => {
    if (excludeCustomerId && p.customerId === excludeCustomerId) return false;
    if (excludeLeadId && p.primaryLeadId === excludeLeadId) return false;
    return true;
  });

  const nameQ = normalizeName(query.name);
  const phoneQ = normalizePhone(query.phone);
  const emailQ = normalizeEmail(query.email);

  const hasPhone = phoneQ.length >= 6;
  const hasEmail = emailQ.includes('@') && emailQ.length >= 5;
  const hasName = nameQ.length >= 2;

  if (!hasPhone && !hasEmail && !hasName) {
    return { matches: [], strongMatch: null, title: '' };
  }

  const scored = [];

  for (const profile of profiles) {
    const pPhone = normalizePhone(profile.contact.phone);
    const pEmail = normalizeEmail(profile.contact.email);
    const pName = normalizeName(profile.contact.name);

    let score = 0;
    let matchType = 'name';

    if (hasPhone && pPhone && pPhone === phoneQ) {
      score = 100;
      matchType = 'phone';
    } else if (hasEmail && pEmail && pEmail === emailQ) {
      score = 100;
      matchType = 'email';
    } else if (hasName && pName.includes(nameQ)) {
      score = nameQ.length >= 4 && pName.startsWith(nameQ) ? 70 : 50;
      matchType = 'name';
    } else if (hasName && nameQ.split(/\s+/).some((part) => part.length >= 3 && pName.includes(part))) {
      score = 40;
      matchType = 'name';
    }

    if (score > 0) {
      scored.push({
        profile,
        score,
        matchType,
        hints: buildCustomerHintLines(profile),
        summaryLine: profile.lastOpportunityLabel,
      });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  const matches = scored.slice(0, limit);
  const strongMatches = matches.filter((m) => m.score >= 100);
  const strongMatch = strongMatches.length === 1 ? strongMatches[0] : null;

  let title = '';
  if (strongMatches.length > 0) {
    title = 'Bestehender Kunde erkannt';
  } else if (matches.length) {
    title = hasName && !hasPhone && !hasEmail
      ? 'Vielleicht ist er schon angelegt'
      : 'Kunde gefunden';
  }

  return { matches, strongMatch, title };
}

export function getCustomerProfile(leads, customerId) {
  if (!customerId) return null;
  return buildCustomerProfiles(leads).find((p) => p.customerId === customerId) ?? null;
}

export { createCustomerId };