/**
 * Verknüpft Website-Suchen mit bestehenden CRM-Leads („bereits Anfrage gestellt“).
 */
import { LEAD_SOURCES } from '../../data/leadTypes.js';

const INQUIRY_SESSION_PREFIX = 'clever-dealer-inquiry';
const OPEN_STATUSES = new Set([
  'neu',
  'inBearbeitung',
  'angebotVersendet',
  'rueckfrageOffen',
  'probefahrt',
]);
const MATCH_SOURCES = new Set([
  'dealerJourney',
  'configurator',
  'dealerSearch',
  'berater',
  'advisor',
  'pilot',
]);

function uid(prefix = 'lead') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function extractEmailFromInquiryText(text = '') {
  const match = String(text).match(
    /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i,
  );
  return match?.[0]?.toLowerCase() ?? null;
}

function historyEntry(text, type = 'note') {
  return {
    id: uid('hist'),
    at: new Date().toISOString(),
    type,
    text,
  };
}

function sessionKey(dealerId) {
  return `${INQUIRY_SESSION_PREFIX}-${dealerId}`;
}

export function readInquirySessionLeadId(dealerId) {
  try {
    return localStorage.getItem(sessionKey(dealerId));
  } catch {
    return null;
  }
}

export function writeInquirySessionLeadId(dealerId, leadId) {
  try {
    if (leadId) localStorage.setItem(sessionKey(dealerId), leadId);
    else localStorage.removeItem(sessionKey(dealerId));
  } catch {
    /* ignore */
  }
}

/**
 * @param {object[]} leads
 * @param {string} [dealerId]
 * @param {number} [limit]
 */
export function listWebsiteInquiryLeads(leads = [], dealerId = null, limit = 5) {
  return leads
    .filter((lead) => {
      if (dealerId && lead.dealerId && lead.dealerId !== dealerId) return false;
      return lead.source === 'dealerSearch' || lead.inquiryContext?.existingLeadMentioned;
    })
    .sort((a, b) => new Date(b.updatedAt ?? b.createdAt) - new Date(a.updatedAt ?? a.createdAt))
    .slice(0, limit);
}

export function findRelatedInquiryLead(leads = [], dealerId, email = null) {
  if (email) {
    const byEmail = leads.find((lead) => {
      if (lead.dealerId && lead.dealerId !== dealerId) return false;
      return lead.contact?.email?.toLowerCase() === email;
    });
    if (byEmail) return byEmail;
  }

  const candidates = leads
    .filter((lead) => {
      if (lead.dealerId && lead.dealerId !== dealerId) return false;
      if (!OPEN_STATUSES.has(lead.status)) return false;
      if (MATCH_SOURCES.has(lead.source)) return true;
      const notes = `${lead.notes ?? ''} ${lead.inquiryBrief?.searchQuery ?? ''}`.toLowerCase();
      return /konfigurator|anfrage|e-mail|email|website-suche/i.test(notes);
    })
    .sort((a, b) => new Date(b.updatedAt ?? b.createdAt) - new Date(a.updatedAt ?? a.createdAt));

  return candidates[0] ?? null;
}

function mergeWishLabels(current = [], next = []) {
  return [...new Set([...current, ...next].filter(Boolean))];
}

function buildSearchNote(searchQuery, recognizedWishes = []) {
  const wishLine = recognizedWishes.length
    ? `Wünsche: ${recognizedWishes.map((w) => w.label).join(' · ')}`
    : null;
  return [`Website-Suche: ${searchQuery}`, wishLine].filter(Boolean).join('\n');
}

/**
 * @param {object} params
 */
export function buildDealerSearchInquiryLead({
  dealerId,
  searchQuery,
  recognizedWishes = [],
  searchProfile = null,
}) {
  const wishLabels = recognizedWishes.map((wish) => wish.label);
  const note = buildSearchNote(searchQuery, recognizedWishes);
  const now = new Date().toISOString();

  return {
    id: uid(),
    createdAt: now,
    updatedAt: now,
    status: 'rueckfrageOffen',
    source: 'dealerSearch',
    dealerId,
    contact: {
      name: 'Website-Anfrage',
      phone: '',
      email: '',
      preferredContact: 'email',
    },
    vehicle: {
      brand: 'Kia',
      model: searchProfile?.model ?? '',
      trim: '',
      engine: '',
      label: 'Noch offen – Kunde sucht weiter',
    },
    paymentType: searchProfile?.payment ?? 'leasing',
    desiredRate: searchProfile?.maxMonthlyRate ?? null,
    wishLabels,
    chipIds: [],
    inquiryContext: {
      existingLeadMentioned: true,
      searchQuery,
      recognizedWishes,
      syncedAt: now,
    },
    notes: note,
    history: [
      historyEntry(`Anfrage über ${LEAD_SOURCES.dealerSearch}`, 'system'),
      historyEntry('Kunde meldet bestehende Anfrage / Konfigurator-Kontakt', 'system'),
      historyEntry(note, 'note'),
    ],
  };
}

/**
 * @param {object} params
 * @returns {{ leadId: string, created: boolean, matched: boolean, message: string }|null}
 */
export function syncDealerSearchInquiryLead({
  leads = [],
  addLead,
  updateLead,
  addHistory,
  dealerId,
  searchQuery,
  recognizedWishes = [],
  searchProfile = null,
  existingLeadMentioned = false,
}) {
  if (!existingLeadMentioned || !searchQuery?.trim()) return null;

  const emailFromQuery = extractEmailFromInquiryText(searchQuery);
  const sessionId = readInquirySessionLeadId(dealerId);
  let lead = sessionId ? leads.find((entry) => entry.id === sessionId) : null;
  let matched = Boolean(lead);

  if (!lead) {
    lead = findRelatedInquiryLead(leads, dealerId, emailFromQuery);
    matched = Boolean(lead);
  }

  const wishLabels = recognizedWishes.map((wish) => wish.label);
  const note = buildSearchNote(searchQuery, recognizedWishes);

  if (lead) {
    const nextStatus = lead.status === 'angebotVersendet' ? 'rueckfrageOffen' : lead.status;
    const contactPatch = emailFromQuery && !lead.contact?.email
      ? { contact: { ...lead.contact, email: emailFromQuery } }
      : {};
    updateLead?.(lead.id, {
      status: nextStatus,
      wishLabels: mergeWishLabels(lead.wishLabels, wishLabels),
      inquiryContext: {
        ...(lead.inquiryContext ?? {}),
        existingLeadMentioned: true,
        searchQuery,
        recognizedWishes,
        syncedAt: new Date().toISOString(),
      },
      notes: lead.notes ? `${lead.notes}\n\n${note}` : note,
      ...contactPatch,
    });
    addHistory?.(lead.id, 'Kunde erneut auf der Website – Wünsche aktualisiert', 'system');
    addHistory?.(lead.id, note, 'note');
    writeInquirySessionLeadId(dealerId, lead.id);

    return {
      leadId: lead.id,
      created: false,
      matched: true,
      message: 'Wir haben Ihre bestehende Anfrage im System gefunden und aktualisiert.',
    };
  }

  const createdLead = buildDealerSearchInquiryLead({
    dealerId,
    searchQuery,
    recognizedWishes,
    searchProfile,
  });
  if (emailFromQuery) {
    createdLead.contact = { ...createdLead.contact, email: emailFromQuery };
  }
  addLead?.(createdLead);
  writeInquirySessionLeadId(dealerId, createdLead.id);

  return {
    leadId: createdLead.id,
    created: true,
    matched: false,
    message: 'Ihre Anfrage wurde an den Verkäufer übermittelt – wir melden uns.',
  };
}
