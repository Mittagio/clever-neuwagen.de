/**
 * Kundensuche für Verkaufsassistent-Startseite (Leads / LocalStorage).
 */
import { LEAD_STATUS } from '../../data/leadTypes.js';
import { PAYMENT_TYPES } from '../../data/leadTypes.js';
import {
  formatInquiryCustomerName,
  formatInquiryVehicleLine,
  getLeadReferenceCode,
} from '../leadAkteEntry.js';
import { getLeadStatusBadgeLabel } from '../dealerAiLeadCrm.js';
import { buildUnterlagenHintText } from '../cleverUnterlagen.js';

export const RECENT_CUSTOMER_RECORDS_KEY = 'clever_recent_customer_records';
const RECENT_MAX_STORED = 20;
const RECENT_DISPLAY_LIMIT = 5;
const SEARCH_MIN_CHARS = 2;
const SEARCH_RESULT_LIMIT = 8;

function normalizePhone(value = '') {
  return String(value).replace(/\D/g, '');
}

function phoneMatches(queryDigits, phoneDigits) {
  if (!queryDigits || !phoneDigits) return false;
  if (phoneDigits.includes(queryDigits)) return true;
  const stripped = queryDigits.replace(/^0+/, '');
  if (stripped.length >= 3 && phoneDigits.includes(stripped)) return true;
  return false;
}

function normalizeEmail(value = '') {
  return String(value).trim().toLowerCase();
}

function normalizeReference(value = '') {
  return String(value).trim().toLowerCase().replace(/\s+/g, '');
}

function formatPaymentShort(lead = {}) {
  const pt = lead.paymentType ?? lead.wish?.paymentType ?? 'unknown';
  return PAYMENT_TYPES[pt]?.label
    ?? (pt === 'cash' ? 'Kauf' : pt === 'leasing' ? 'Leasing' : null)
    ?? 'Angebot offen';
}

function formatVehicleWishLine(lead = {}) {
  const vehicle = formatInquiryVehicleLine(lead);
  const shortVehicle = vehicle === 'Fahrzeug offen'
    ? null
    : vehicle.replace(/^Kia\s+/i, '').trim();
  const payment = formatPaymentShort(lead);
  if (shortVehicle && payment) return `${shortVehicle} · ${payment}`;
  return shortVehicle || payment || 'Fahrzeug offen';
}

function formatRelativeActivity(iso) {
  if (!iso) return null;
  const diff = Math.round((Date.now() - new Date(iso).getTime()) / 86400000);
  if (diff <= 0) return 'heute';
  if (diff === 1) return 'gestern';
  if (diff < 7) return `vor ${diff} Tagen`;
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
}

export function resolveLeadStatusLabel(lead = {}) {
  const pipelineId = lead.crm?.pipelineStatusId;
  if (pipelineId) {
    return getLeadStatusBadgeLabel(pipelineId);
  }
  return LEAD_STATUS[lead.status]?.label ?? 'Angebot offen';
}

export function resolveLeadWarningLabel(lead = {}) {
  return buildUnterlagenHintText(lead, lead.paymentType) ?? null;
}

/**
 * @param {string} query
 * @returns {{ raw: string, lower: string, digits: string, referenceToken: string }}
 */
export function normalizeCustomerSearchQuery(query = '') {
  const raw = String(query).trim();
  const lower = raw.toLowerCase();
  const digits = normalizePhone(raw);

  let referenceToken = '';
  const cnMatch = raw.match(/cn[-\s]?(\d{4})[-\s]?(\d{1,5})/i);
  if (cnMatch) {
    referenceToken = `cn-${cnMatch[1]}-${String(cnMatch[2]).padStart(5, '0')}`;
  } else if (/^cn[-\s]?\d/i.test(raw.replace(/\s/g, ''))) {
    referenceToken = normalizeReference(raw);
  }

  return { raw, lower, digits, referenceToken };
}

function buildSearchHaystack(lead = {}) {
  const parts = [
    lead.contact?.name,
    lead.contact?.phone,
    lead.contact?.email,
    lead.vehicle?.model,
    lead.vehicle?.label,
    lead.vehicle?.trim,
    lead.vehicle?.engine,
    lead.referenceCode,
    lead.offerCode,
    lead.notes,
    ...(lead.crm?.reservedModels?.map((m) => m.name) ?? []),
    ...(lead.crm?.vehicleConfigurations?.map((vc) => [vc.model, vc.trimLabel].join(' ')) ?? []),
  ];
  return parts.filter(Boolean).join(' ').toLowerCase();
}

function scoreLead(lead, normalized) {
  const { lower, digits, referenceToken } = normalized;
  if (!lower && !digits && !referenceToken) return 0;

  const name = String(lead.contact?.name ?? '').toLowerCase();
  const email = normalizeEmail(lead.contact?.email);
  const phone = normalizePhone(lead.contact?.phone);
  const reference = normalizeReference(getLeadReferenceCode(lead) ?? '');
  const haystack = buildSearchHaystack(lead);

  let score = 0;

  if (referenceToken && reference) {
    if (reference === referenceToken || reference.includes(referenceToken)) {
      score = Math.max(score, 100);
    }
  }

  if (lower.length >= 3 && reference && reference.includes(normalizeReference(lower))) {
    score = Math.max(score, 95);
  }

  if (digits.length >= 4 && phone && phoneMatches(digits, phone)) {
    score = Math.max(score, digits.length >= 8 ? 100 : 88);
  }

  if (lower.includes('@')) {
    if (email && email === lower) score = Math.max(score, 100);
    else if (email && email.includes(lower)) score = Math.max(score, 92);
  }

  const nameParts = lower.split(/\s+/).filter((part) => part.length >= 2);
  if (nameParts.length) {
    if (nameParts.every((part) => name.includes(part))) score = Math.max(score, 86);
    else if (nameParts.some((part) => name.includes(part))) score = Math.max(score, 68);
  } else if (lower.length >= 2 && name.includes(lower)) {
    score = Math.max(score, 72);
  }

  if (lower.length >= 2 && haystack.includes(lower)) {
    score = Math.max(score, 74);
  }

  if (lower.length >= 2) {
    const modelTokens = lower.split(/\s+/).filter((part) => part.length >= 2);
    for (const token of modelTokens) {
      if (haystack.includes(token)) {
        score = Math.max(score, 70);
      }
    }
  }

  return score;
}

/**
 * @param {object} lead
 * @returns {import('./customerSearchService.js').CustomerSearchResult}
 */
export function buildCustomerSearchResult(lead = {}) {
  const lastAt = lead.updatedAt ?? lead.createdAt ?? null;
  const relative = formatRelativeActivity(lastAt);

  return {
    leadId: lead.id,
    customerId: lead.customerId ?? null,
    customerName: formatInquiryCustomerName(lead),
    vehicleLabel: formatVehicleWishLine(lead),
    statusLabel: resolveLeadStatusLabel(lead),
    warningLabel: resolveLeadWarningLabel(lead),
    lastActivityLabel: relative ? `Letzter Kontakt: ${relative}` : null,
    referenceCode: getLeadReferenceCode(lead),
    lastActivityAt: lastAt,
  };
}

/**
 * @param {string} query
 * @param {object[]} leads
 * @param {{ limit?: number }} [options]
 * @returns {import('./customerSearchService.js').CustomerSearchResult[]}
 */
export function searchCustomers(query, leads = [], options = {}) {
  const normalized = normalizeCustomerSearchQuery(query);
  if (normalized.raw.length < SEARCH_MIN_CHARS) return [];

  const limit = options.limit ?? SEARCH_RESULT_LIMIT;
  const scored = [];

  for (const lead of leads) {
    const score = scoreLead(lead, normalized);
    if (score > 0) {
      scored.push({ lead, score });
    }
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return new Date(b.lead.updatedAt ?? b.lead.createdAt ?? 0)
      - new Date(a.lead.updatedAt ?? a.lead.createdAt ?? 0);
  });

  return scored.slice(0, limit).map(({ lead }) => buildCustomerSearchResult(lead));
}

function readRecentStorage(storage = globalThis.localStorage) {
  if (!storage?.getItem) return [];
  try {
    const raw = storage.getItem(RECENT_CUSTOMER_RECORDS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeRecentStorage(records, storage = globalThis.localStorage) {
  if (!storage?.setItem) return;
  storage.setItem(RECENT_CUSTOMER_RECORDS_KEY, JSON.stringify(records));
}

/**
 * @param {object} lead
 * @param {Storage} [storage]
 */
export function recordRecentCustomerOpen(lead, storage = globalThis.localStorage) {
  if (!lead?.id) return;

  const entry = {
    leadId: lead.id,
    customerId: lead.customerId ?? null,
    customerName: formatInquiryCustomerName(lead),
    vehicleLabel: formatVehicleWishLine(lead),
    statusLabel: resolveLeadStatusLabel(lead),
    lastOpenedAt: new Date().toISOString(),
  };

  const existing = readRecentStorage(storage).filter((item) => item.leadId !== lead.id);
  writeRecentStorage([entry, ...existing].slice(0, RECENT_MAX_STORED), storage);
}

/**
 * @param {object[]} leads
 * @param {{ limit?: number, storage?: Storage }} [options]
 */
export function getRecentCustomerRecords(leads = [], options = {}) {
  const storage = options.storage ?? globalThis.localStorage;
  const limit = options.limit ?? RECENT_DISPLAY_LIMIT;
  const leadMap = new Map(leads.map((lead) => [lead.id, lead]));
  const stored = readRecentStorage(storage);

  return stored
    .filter((item) => leadMap.has(item.leadId))
    .sort((a, b) => new Date(b.lastOpenedAt) - new Date(a.lastOpenedAt))
    .slice(0, limit)
    .map((item) => {
      const lead = leadMap.get(item.leadId);
      const fresh = buildCustomerSearchResult(lead);
      return {
        ...fresh,
        lastOpenedAt: item.lastOpenedAt,
      };
    });
}

/**
 * Öffnen einer bestehenden Akte – keine neue Verkaufschance.
 * @returns {{ action: 'open'|'missing', leadId: string|null }}
 */
export function resolveCustomerOpenAction(leadId, leads = []) {
  const target = leads.find((lead) => lead.id === leadId) ?? null;
  if (!target) return { action: 'missing', leadId: null };
  return { action: 'open', leadId: target.id };
}
