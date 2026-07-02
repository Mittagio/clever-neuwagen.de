/**
 * Kundenportal – Ansprechpartner auflösen und beim Link-Senden speichern.
 */
import { DEALER_PROFILES } from '../../data/dealers/dealerProfiles.js';
import { DEALER_SELLERS } from '../../data/salesChanceTypes.js';
import { getCustomerPortalAccess } from './customerPortalAccessService.js';

export function buildAdvisorInitials(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}

export function resolveDealerProfile(lead = {}) {
  const dealerId = lead.dealerId ?? lead.crm?.dealerId ?? null;
  if (!dealerId) return null;
  return DEALER_PROFILES[dealerId] ?? null;
}

export function resolveDealerSeller(sellerId = '') {
  if (!sellerId) return null;
  return DEALER_SELLERS.find((entry) => entry.id === sellerId) ?? null;
}

export function resolveSellerIdFromLead(lead = {}) {
  const access = getCustomerPortalAccess(lead);
  return lead.ownerId
    || lead.crm?.advisor?.userId
    || access?.advisor?.userId
    || null;
}

function pickFirstNonEmpty(...values) {
  for (const value of values) {
    const trimmed = String(value ?? '').trim();
    if (trimmed) return trimmed;
  }
  return null;
}

function resolveDealerLabel(lead = {}, dealer = null, storedAdvisor = null) {
  return pickFirstNonEmpty(
    storedAdvisor?.dealerLabel,
    dealer ? [dealer.dealerName, dealer.city].filter(Boolean).join(' · ') : null,
    lead.dealerLabel,
    'Ihr Autohaus',
  );
}

/**
 * Füllt nur leere Felder – bei abweichender userId nicht überschreiben.
 * @param {object} existing
 * @param {object} incoming
 */
export function mergeAdvisorSnapshot(existing = {}, incoming = {}) {
  if (!incoming || typeof incoming !== 'object') return { ...existing };

  const result = { ...existing };
  const hasIncomingIdentity = Boolean(incoming.userId || incoming.name);
  if (!hasIncomingIdentity) return result;

  if (
    result.userId
    && incoming.userId
    && result.userId !== incoming.userId
  ) {
    return result;
  }

  for (const key of ['userId', 'name', 'phone', 'email', 'dealerLabel', 'roleLabel']) {
    if (!result[key] && incoming[key]) {
      result[key] = incoming[key];
    }
  }

  return result;
}

/**
 * @param {object} lead
 * @param {object} [options]
 */
export function buildPortalAdvisorHintFromLead(lead = {}, options = {}) {
  const sellerId = options.userId ?? resolveSellerIdFromLead(lead);
  const seller = resolveDealerSeller(sellerId);
  const dealer = resolveDealerProfile(lead);
  const stored = getCustomerPortalAccess(lead)?.advisor ?? lead.crm?.advisor ?? {};

  const dealerLabel = resolveDealerLabel(lead, dealer, stored);

  return {
    userId: sellerId ?? null,
    name: pickFirstNonEmpty(
      options.name,
      lead.ownerName,
      seller?.name,
      stored.name,
      dealer?.contactName,
    ),
    phone: pickFirstNonEmpty(options.phone, seller?.phone, stored.phone),
    email: pickFirstNonEmpty(options.email, seller?.email, stored.email),
    dealerLabel,
    roleLabel: pickFirstNonEmpty(
      options.roleLabel,
      seller?.roleLabel,
      stored.roleLabel,
      dealer?.contactRole,
      'Ihr Verkaufsberater',
    ),
  };
}

/**
 * @param {object} lead
 */
export function buildCustomerPortalAdvisorModel(lead = {}) {
  const sellerId = resolveSellerIdFromLead(lead);
  const seller = resolveDealerSeller(sellerId);
  const dealer = resolveDealerProfile(lead);
  const portalAdvisor = getCustomerPortalAccess(lead)?.advisor ?? {};
  const crmAdvisor = lead.crm?.advisor ?? {};

  const name = pickFirstNonEmpty(
    lead.ownerName,
    seller?.name,
    portalAdvisor.name,
    crmAdvisor.name,
    dealer?.contactName,
    dealer?.dealerName,
  );

  const phone = pickFirstNonEmpty(
    seller?.phone,
    lead.crm?.advisorPhone,
    portalAdvisor.phone,
    crmAdvisor.phone,
    dealer?.contactPhone,
  );

  const email = pickFirstNonEmpty(
    seller?.email,
    lead.crm?.advisorEmail,
    portalAdvisor.email,
    crmAdvisor.email,
    dealer?.contactEmail,
  );

  const dealerLabel = resolveDealerLabel(lead, dealer, {
    ...crmAdvisor,
    ...portalAdvisor,
  });

  const roleLabel = pickFirstNonEmpty(
    seller?.roleLabel,
    portalAdvisor.roleLabel,
    crmAdvisor.roleLabel,
    dealer?.contactRole,
    name && name !== dealer?.dealerName ? 'Ihr Verkaufsberater' : null,
  );

  const hasDirectContact = Boolean(phone || email);

  return {
    title: 'Ihr Ansprechpartner',
    name,
    roleLabel,
    dealerLabel,
    phone,
    email,
    responseHint: 'Wir antworten in der Regel innerhalb eines Werktags.',
    initials: buildAdvisorInitials(name),
    hasDirectContact,
    visible: Boolean(name || dealerLabel),
    showCallAction: Boolean(phone),
    showEmailAction: Boolean(email),
    showMessageAction: true,
  };
}

/**
 * @param {object} lead
 * @param {object} [advisorHint]
 */
export function applyPortalAdvisorToLead(lead = {}, advisorHint = {}) {
  const access = getCustomerPortalAccess(lead);
  if (!access) return lead;

  const mergedAdvisor = mergeAdvisorSnapshot(access.advisor ?? {}, advisorHint);
  const nextAccess = {
    ...access,
    advisor: Object.keys(mergedAdvisor).length ? mergedAdvisor : access.advisor,
  };

  const mergedCrmAdvisor = mergeAdvisorSnapshot(lead.crm?.advisor ?? {}, advisorHint);

  return {
    ...lead,
    crm: {
      ...(lead.crm ?? {}),
      customerPortalAccess: nextAccess,
      advisor: Object.keys(mergedCrmAdvisor).length ? mergedCrmAdvisor : lead.crm?.advisor,
      advisorPhone: lead.crm?.advisorPhone || mergedAdvisor.phone || undefined,
      advisorEmail: lead.crm?.advisorEmail || mergedAdvisor.email || undefined,
    },
  };
}
