import { generateOfferAccessToken } from '../../logic/offerAccessToken.js';
import { buildSalesCompareRows } from './salesAdvisorService.js';
import { buildSalesAdvisorWhatsAppMessage } from '../../logic/whatsappBriefMessages.js';

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

export function buildSalesSharePath(token) {
  return `/vergleich/${encodeURIComponent(token)}`;
}

export function buildSalesShareUrl(token) {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${buildSalesSharePath(token)}`;
  }
  return `https://clever-neuwagen.de${buildSalesSharePath(token)}`;
}

export function createSalesShareSession({
  matches = [],
  chipIds = [],
  customer = {},
  sellerName = '',
  dealerName = '',
}) {
  const token = generateOfferAccessToken();
  const sessions = readSessions();
  const rows = buildSalesCompareRows(matches);

  sessions[token] = {
    token,
    chipIds,
    customer,
    sellerName,
    dealerName,
    matches: rows,
    createdAt: Date.now(),
    expiresAt: Date.now() + SESSION_TTL_MS,
  };

  writeSessions(sessions);
  return { token, url: buildSalesShareUrl(token) };
}

export function loadSalesShareSession(token) {
  if (!token) return null;
  const sessions = readSessions();
  const key = Object.keys(sessions).find((k) => k.toUpperCase() === token.toUpperCase());
  const session = key ? sessions[key] : null;
  if (!session) return null;
  if (session.expiresAt && Date.now() > session.expiresAt) return null;
  if (key) {
    sessions[key] = { ...session, viewCount: (session.viewCount ?? 0) + 1, lastViewedAt: Date.now() };
    writeSessions(sessions);
  }
  return sessions[key] ?? session;
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
