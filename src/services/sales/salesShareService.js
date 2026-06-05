import { generateOfferAccessToken } from '../../logic/offerAccessToken.js';
import { buildShareCompareRows } from '../advisor/advisorSnapshot.js';
import { patchCustomerRecordByShareToken } from './customerRecordService.js';
import { buildSalesAdvisorWhatsAppMessage } from '../../logic/whatsappBriefMessages.js';
import {
  createAdvisorShareOnServer,
  loadAdvisorShareFromServer,
  confirmAdvisorShareInquiryOnServer,
} from '../advisor/advisorApi.js';
import { buildPilotLeadFromShareSession } from '../advisor/sharePilotLead.js';
import { pushPilotLeadToServer } from '../pilot/pilotLeadsApi.js';

const SESSIONS_KEY = 'cn-smart-sales-sessions';
const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000;

function readSessions() {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeSessions(sessions) {
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
}

function cacheLocalSession(token, session) {
  const sessions = readSessions();
  sessions[token] = session;
  writeSessions(sessions);
}

async function pushShareLead(session, event) {
  if (!session?.token) return null;
  const lead = buildPilotLeadFromShareSession(session, null, event);
  await pushPilotLeadToServer(lead);
  return lead;
}

export function buildSalesSharePath(token) {
  return `/vergleich/${encodeURIComponent(token)}`;
}

export function buildSalesShareUrl(token) {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${buildSalesSharePath(token)}`;
  }
  return `https://clever-neuwagen.de${buildSalesSharePath(token)}`;
}

function buildLocalShareSession({
  matches = [],
  modelLineGroups = [],
  chipIds = [],
  customer = {},
  sellerName = '',
  dealerName = '',
  dealerSlug = null,
  wishLabels = [],
}) {
  const token = generateOfferAccessToken();
  const now = Date.now();
  return {
    token,
    chipIds,
    customer,
    sellerName,
    dealerName,
    dealerSlug,
    wishLabels,
    matches: buildShareCompareRows(matches),
    modelLineGroups,
    createdAt: now,
    expiresAt: now + SESSION_TTL_MS,
    viewCount: 0,
    inquiryConfirmed: false,
    source: 'local',
  };
}

export async function createSalesShareSession({
  matches = [],
  modelLineGroups = [],
  chipIds = [],
  customer = {},
  sellerName = '',
  dealerName = '',
  dealerSlug = null,
  wishLabels = [],
}) {
  const payload = {
    matches,
    modelLineGroups,
    chipIds,
    customer,
    sellerName,
    dealerName,
    dealerSlug,
    wishLabels,
  };

  try {
    const remote = await createAdvisorShareOnServer(payload);
    const session = buildLocalShareSession({
      ...payload,
      token: remote.token,
    });
    session.source = 'server';
    cacheLocalSession(remote.token, session);
    return {
      token: remote.token,
      url: buildSalesShareUrl(remote.token),
      source: 'server',
      expiresAt: remote.expiresAt,
      leadId: remote.leadId ?? null,
    };
  } catch {
    const session = buildLocalShareSession(payload);
    cacheLocalSession(session.token, session);
    await pushShareLead(session, 'created').catch(() => {});
    return {
      token: session.token,
      url: buildSalesShareUrl(session.token),
      source: 'local',
      expiresAt: session.expiresAt,
    };
  }
}

export async function loadSalesShareSession(token) {
  if (!token) return null;

  try {
    const remote = await loadAdvisorShareFromServer(token);
    if (remote?.session) {
      cacheLocalSession(remote.session.token, { ...remote.session, source: 'server' });
      return { ...remote.session, source: 'server' };
    }
  } catch {
    // Fallback auf lokalen Cache
  }

  const sessions = readSessions();
  const key = Object.keys(sessions).find((k) => k.toUpperCase() === token.toUpperCase());
  const session = key ? sessions[key] : null;
  if (!session) return null;
  if (session.expiresAt && Date.now() > session.expiresAt) return null;

  if (key) {
    sessions[key] = {
      ...session,
      viewCount: (session.viewCount ?? 0) + 1,
      lastViewedAt: Date.now(),
    };
    writeSessions(sessions);
  }

  return { ...session, source: session.source ?? 'local' };
}

export async function confirmSalesShareInquiry(token) {
  try {
    const remote = await confirmAdvisorShareInquiryOnServer(token);
    if (remote?.session) {
      cacheLocalSession(remote.session.token, remote.session);
      await patchCustomerRecordByShareToken(remote.session.token, {
        nextStep: 'Kunde hat Anfrage bestätigt',
        inquiryConfirmed: true,
        inquiryConfirmedAt: remote.session.inquiryConfirmedAt ?? Date.now(),
        customer: remote.session.customer ?? {},
      }).catch(() => {});
      return remote.session;
    }
  } catch {
    // local fallback
  }

  const sessions = readSessions();
  const key = Object.keys(sessions).find((k) => k.toUpperCase() === token.toUpperCase());
  if (!key) return null;
  sessions[key] = {
    ...sessions[key],
    inquiryConfirmed: true,
    inquiryConfirmedAt: Date.now(),
  };
  writeSessions(sessions);
  const session = sessions[key];
  await pushShareLead(session, 'inquiry_confirmed').catch(() => {});
  await patchCustomerRecordByShareToken(token, {
    nextStep: 'Kunde hat Anfrage bestätigt',
    inquiryConfirmed: true,
    inquiryConfirmedAt: session.inquiryConfirmedAt ?? Date.now(),
    customer: session.customer ?? {},
  }).catch(() => {});
  return session;
}

export function buildSalesWhatsAppMessage({
  customerName = 'Kunde',
  sellerName = 'Ihr Verkaufsberater',
  dealerName = 'Autohaus',
  matches = [],
  shareUrl,
  wishLabels = [],
  budgetMax = null,
}) {
  return buildSalesAdvisorWhatsAppMessage({
    customerName,
    sellerName,
    dealerName,
    matches,
    shareUrl,
    wishLabels,
    budgetMax,
  });
}

export function buildSalesWhatsAppUrl({ phone, message }) {
  const digits = String(phone ?? '').replace(/\D/g, '');
  const base = digits ? `https://wa.me/${digits}` : 'https://wa.me/';
  return `${base}?text=${encodeURIComponent(message)}`;
}

export function buildSalesMailto({
  customerEmail = '',
  customerName = 'Kunde',
  sellerName = 'Verkaufsberater',
  dealerName = 'Autohaus',
  matches = [],
  shareUrl,
}) {
  const subject = `Ihre Fahrzeugempfehlung – ${dealerName}`;
  const body = buildSalesWhatsAppMessage({
    customerName,
    sellerName,
    dealerName,
    matches,
    shareUrl,
  });
  return `mailto:${customerEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export async function copySalesShareUrl(url) {
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    return false;
  }
}

export function printSalesComparison() {
  window.print();
}

/** @deprecated Nutze buildShareCompareRows aus advisorSnapshot */
export { buildShareCompareRows as buildSalesCompareRows } from '../advisor/advisorSnapshot.js';
