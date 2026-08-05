/**
 * Clever Eingang – intelligente Arbeitsqueue aus neuen Leads/Intakes.
 * Interne Source-Keys bleiben im Modell; die UI zeigt nur Labels.
 */
import {
  buildKundenaktePath,
  formatInquiryVehicleLine,
  getNewInquiryLeads,
} from '../leadAkteEntry.js';

export const CLEVER_EINGANG_STATUS = {
  DUPLICATE: 'duplicate',
  READY: 'ready',
  REVIEW: 'review',
  INCOMPLETE: 'incomplete',
  ASSIGNED: 'assigned',
};

export const CLEVER_EINGANG_STATUS_LABELS = {
  [CLEVER_EINGANG_STATUS.DUPLICATE]: 'Dublette',
  [CLEVER_EINGANG_STATUS.READY]: 'Bereit',
  [CLEVER_EINGANG_STATUS.REVIEW]: 'Prüfen',
  [CLEVER_EINGANG_STATUS.INCOMPLETE]: 'Unvollständig',
  [CLEVER_EINGANG_STATUS.ASSIGNED]: 'Zugeordnet',
};

/** Sortierpriorität (niedriger = weiter oben) */
const STATUS_SORT_RANK = {
  [CLEVER_EINGANG_STATUS.DUPLICATE]: 1,
  [CLEVER_EINGANG_STATUS.REVIEW]: 1,
  [CLEVER_EINGANG_STATUS.READY]: 2,
  [CLEVER_EINGANG_STATUS.INCOMPLETE]: 3,
  [CLEVER_EINGANG_STATUS.ASSIGNED]: 4,
};

const SOURCE_CANONICAL = {
  composer_multi_source: 'composer_multi_source',
  multi_source_intake: 'composer_multi_source',
  clever: 'composer_multi_source',
  sales_assistant: 'sales_assistant',
  dealerAi: 'sales_assistant',
  sales: 'sales_assistant',
  verkaufsassistent: 'sales_assistant',
  email: 'email',
  mail: 'email',
  homepage: 'homepage',
  landing: 'homepage',
  dealerJourney: 'homepage',
  dealerSearch: 'homepage',
  document: 'document',
  dokument: 'document',
  seller_note: 'seller_note',
  gespraech: 'seller_note',
  note: 'seller_note',
};

const SOURCE_LABELS = {
  composer_multi_source: 'Über Clever erfasst',
  sales_assistant: 'Über Verkaufsassistent erfasst',
  email: 'Aus E-Mail erkannt',
  homepage: 'Über Händlerhomepage',
  document: 'Aus Dokument erkannt',
  seller_note: 'Aus Gesprächsnotiz',
};

const PLACEHOLDER_NAMES = new Set([
  '',
  'neuer kunde',
  'kunde offen',
  'kunde noch offen',
  'unbekannt',
  'ohne name',
]);

const DUPLICATE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

function normalizeText(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9@.+]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizePhone(value) {
  const digits = String(value ?? '').replace(/\D+/g, '');
  if (!digits) return '';
  return digits.replace(/^49/, '0');
}

function normalizeEmail(value) {
  return normalizeText(value);
}

function looksLikeInternalKey(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return false;
  if (raw.includes('_')) return true;
  if (/^[a-z]+[A-Z]/.test(raw)) return true;
  return /^[a-z][a-z0-9-]{2,}$/.test(raw) && !/\s/.test(raw);
}

/**
 * Menschlich lesbares Quellenlabel – nie interne Keys in der UI.
 * @param {string} sourceKey
 * @returns {string}
 */
export function mapInboxSourceLabel(sourceKey) {
  const raw = String(sourceKey ?? '').trim();
  if (!raw) return 'Unbekannte Quelle';

  const canonical = SOURCE_CANONICAL[raw] ?? SOURCE_CANONICAL[normalizeText(raw).replace(/\s+/g, '_')] ?? null;
  if (canonical && SOURCE_LABELS[canonical]) {
    return SOURCE_LABELS[canonical];
  }

  if (SOURCE_LABELS[raw]) return SOURCE_LABELS[raw];

  if (looksLikeInternalKey(raw)) {
    return 'Über Clever erfasst';
  }

  return raw;
}

export function resolveLeadContactName(lead = {}) {
  const name = String(lead.contact?.name ?? lead.contact?.fullName ?? '').trim();
  if (!name || PLACEHOLDER_NAMES.has(normalizeText(name))) return '';
  return name;
}

export function hasLeadContactDetails(lead = {}) {
  const email = normalizeEmail(lead.contact?.email);
  const phone = normalizePhone(lead.contact?.phone);
  return Boolean(email || phone);
}

export function isLeadIdentityIncomplete(lead = {}) {
  return !resolveLeadContactName(lead) && !hasLeadContactDetails(lead);
}

export function isLeadAssigned(lead = {}) {
  if (lead.customerId || lead.linkedCustomerId || lead.crm?.matchedCustomerId) return true;
  if (lead.intakeKind === 'supplement' || lead.kind === 'supplement') return true;
  if (lead.isAssignedSupplement === true) return true;
  return false;
}

export function needsLeadReview(lead = {}) {
  if (lead.needsReview === true || lead.crm?.needsReview === true) return true;
  if (lead.needsSellerChoice || lead.crm?.needsSellerChoice) return true;
  if (lead.matchConfidence != null && Number(lead.matchConfidence) > 0 && Number(lead.matchConfidence) < 0.85) {
    return true;
  }
  const name = resolveLeadContactName(lead);
  if (name && !hasLeadContactDetails(lead)) return true;
  if (!name && hasLeadContactDetails(lead)) return true;
  return false;
}

export function formatInboxRelativeTime(iso, nowMs = Date.now()) {
  if (!iso) return '';
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return '';

  const diffMs = Math.max(0, nowMs - ts);
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'gerade eben';
  if (minutes < 60) return `vor ${minutes} Min.`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `vor ${hours} Std.`;

  const days = Math.floor(hours / 24);
  if (days === 1) return 'gestern';
  if (days < 7) return `vor ${days} Tagen`;

  return new Date(ts).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
}

function vehicleKey(lead = {}) {
  const model = normalizeText(lead.vehicle?.model || lead.vehicle?.label || '');
  const brand = normalizeText(lead.vehicle?.brand || 'kia');
  return model ? `${brand} ${model}` : '';
}

function contentSnippet(lead = {}) {
  return normalizeText(lead.notes || lead.wish?.text || lead.summary || '').slice(0, 80);
}

function leadTimestamp(lead = {}) {
  const ts = new Date(lead.createdAt ?? lead.updatedAt ?? 0).getTime();
  return Number.isNaN(ts) ? 0 : ts;
}

/**
 * Similarity score for duplicate grouping (higher = more similar).
 * @returns {number}
 */
export function scoreLeadDuplicateMatch(a = {}, b = {}) {
  if (!a?.id || !b?.id || a.id === b.id) return 0;

  let score = 0;
  const nameA = normalizeText(resolveLeadContactName(a));
  const nameB = normalizeText(resolveLeadContactName(b));
  if (nameA && nameB && nameA === nameB) score += 3;

  const emailA = normalizeEmail(a.contact?.email);
  const emailB = normalizeEmail(b.contact?.email);
  if (emailA && emailB && emailA === emailB) score += 4;

  const phoneA = normalizePhone(a.contact?.phone);
  const phoneB = normalizePhone(b.contact?.phone);
  if (phoneA && phoneB && (phoneA === phoneB || phoneA.endsWith(phoneB) || phoneB.endsWith(phoneA))) {
    score += 4;
  }

  const vehicleA = vehicleKey(a);
  const vehicleB = vehicleKey(b);
  if (vehicleA && vehicleB && vehicleA === vehicleB) score += 2;

  const timeDiff = Math.abs(leadTimestamp(a) - leadTimestamp(b));
  if (timeDiff > 0 && timeDiff <= DUPLICATE_WINDOW_MS) score += 1;

  const sourceA = SOURCE_CANONICAL[a.source] ?? a.source;
  const sourceB = SOURCE_CANONICAL[b.source] ?? b.source;
  if (sourceA && sourceB && sourceA === sourceB) score += 1;

  const snippetA = contentSnippet(a);
  const snippetB = contentSnippet(b);
  if (snippetA && snippetB && (snippetA === snippetB || snippetA.includes(snippetB) || snippetB.includes(snippetA))) {
    score += 1;
  }

  return score;
}

export function leadsAreLikelyDuplicates(a, b) {
  const score = scoreLeadDuplicateMatch(a, b);
  const nameMatch = normalizeText(resolveLeadContactName(a))
    && normalizeText(resolveLeadContactName(a)) === normalizeText(resolveLeadContactName(b));
  const contactMatch = (
    (normalizeEmail(a.contact?.email) && normalizeEmail(a.contact?.email) === normalizeEmail(b.contact?.email))
    || (normalizePhone(a.contact?.phone) && normalizePhone(a.contact?.phone) === normalizePhone(b.contact?.phone))
  );
  // Strong identity signal or combined soft signals
  return score >= 5 || (score >= 4 && (nameMatch || contactMatch));
}

function groupDuplicateLeads(leads = []) {
  const groups = [];
  const assigned = new Set();

  for (let i = 0; i < leads.length; i += 1) {
    const lead = leads[i];
    if (assigned.has(lead.id)) continue;

    const members = [lead];
    assigned.add(lead.id);

    for (let j = i + 1; j < leads.length; j += 1) {
      const other = leads[j];
      if (assigned.has(other.id)) continue;
      if (leadsAreLikelyDuplicates(lead, other)) {
        members.push(other);
        assigned.add(other.id);
      }
    }

    groups.push(members);
  }

  return groups;
}

function resolveBaseStatus(lead = {}) {
  if (isLeadIdentityIncomplete(lead)) return CLEVER_EINGANG_STATUS.INCOMPLETE;
  if (isLeadAssigned(lead)) return CLEVER_EINGANG_STATUS.ASSIGNED;
  if (needsLeadReview(lead)) return CLEVER_EINGANG_STATUS.REVIEW;
  return CLEVER_EINGANG_STATUS.READY;
}

function resolveNextAction(status, lead = {}, groupSize = 1) {
  switch (status) {
    case CLEVER_EINGANG_STATUS.DUPLICATE:
      return {
        id: 'merge_review',
        label: groupSize > 1 ? 'Zusammenführen und prüfen' : 'Akte prüfen',
        href: buildKundenaktePath(lead.id),
      };
    case CLEVER_EINGANG_STATUS.INCOMPLETE:
      return {
        id: 'complete_details',
        label: 'Angaben prüfen',
        href: buildKundenaktePath(lead.id),
      };
    case CLEVER_EINGANG_STATUS.ASSIGNED:
      return {
        id: 'review_akte',
        label: 'Akte prüfen',
        href: buildKundenaktePath(lead.id),
      };
    case CLEVER_EINGANG_STATUS.REVIEW:
      return {
        id: 'review_akte',
        label: 'Akte prüfen',
        href: buildKundenaktePath(lead.id),
      };
    case CLEVER_EINGANG_STATUS.READY:
    default:
      if (lead.contractPending || lead.crm?.contractPending) {
        return {
          id: 'review_contract',
          label: 'Vertrag prüfen',
          href: buildKundenaktePath(lead.id),
        };
      }
      if (lead.needsOffer === true) {
        return {
          id: 'prepare_offer',
          label: 'Angebot vorbereiten',
          href: buildKundenaktePath(lead.id),
        };
      }
      return {
        id: 'open_akte',
        label: 'Zur Kundenakte',
        href: buildKundenaktePath(lead.id),
      };
  }
}

function pickPrimaryLead(members = []) {
  return [...members].sort((a, b) => leadTimestamp(b) - leadTimestamp(a))[0];
}

function buildDisplayTitle(lead = {}, status) {
  const name = resolveLeadContactName(lead);
  if (name) return name;
  if (status === CLEVER_EINGANG_STATUS.INCOMPLETE || status === CLEVER_EINGANG_STATUS.DUPLICATE) {
    return 'Neuer Vorgang';
  }
  return 'Neuer Vorgang';
}

function buildContextHint(status, lead = {}, groupSize = 1) {
  if (status === CLEVER_EINGANG_STATUS.DUPLICATE && groupSize > 1) {
    return `${groupSize} ähnliche Eingänge erkannt`;
  }
  if (status === CLEVER_EINGANG_STATUS.INCOMPLETE) {
    return 'Name oder Kontaktdaten fehlen';
  }
  if (status === CLEVER_EINGANG_STATUS.ASSIGNED) {
    return 'Ergänzung zu bestehendem Kunden';
  }
  if (status === CLEVER_EINGANG_STATUS.REVIEW) {
    return 'Angaben prüfen, bevor die Akte weitergeht';
  }
  return null;
}

function isUnreadLead(lead = {}) {
  if (lead.readAt || lead.seenAt || lead.inboxReadAt) return false;
  return lead.status === 'neu' || lead.unread === true;
}

function buildItemFromGroup(members = [], nowMs = Date.now()) {
  const primary = pickPrimaryLead(members);
  const isDuplicateGroup = members.length > 1;
  const baseStatus = resolveBaseStatus(primary);
  const status = isDuplicateGroup ? CLEVER_EINGANG_STATUS.DUPLICATE : baseStatus;
  const nextAction = resolveNextAction(status, primary, members.length);
  const createdAt = primary.createdAt ?? primary.updatedAt ?? null;

  return {
    id: isDuplicateGroup ? `group:${members.map((m) => m.id).sort().join('+')}` : primary.id,
    leadId: primary.id,
    memberLeadIds: members.map((m) => m.id),
    memberCount: members.length,
    primaryLead: primary,
    members,
    status,
    statusLabel: CLEVER_EINGANG_STATUS_LABELS[status],
    title: buildDisplayTitle(primary, status),
    vehicleLabel: formatInquiryVehicleLine(primary),
    sourceKey: primary.source ?? null,
    sourceLabel: mapInboxSourceLabel(primary.source),
    createdAt,
    relativeTime: formatInboxRelativeTime(createdAt, nowMs),
    contextHint: buildContextHint(status, primary, members.length),
    nextAction,
    isUnread: members.some((m) => isUnreadLead(m)),
    hasCustomerFile: Boolean(primary.customerId) && !isLeadIdentityIncomplete(primary),
    sortRank: STATUS_SORT_RANK[status] ?? 9,
  };
}

export function sortCleverInboxItems(items = []) {
  return [...items].sort((a, b) => {
    if (a.sortRank !== b.sortRank) return a.sortRank - b.sortRank;
    return leadTimestamp(b.primaryLead) - leadTimestamp(a.primaryLead);
  });
}

function countLabel(count, singular, plural) {
  if (count === 1) return `1 ${singular}`;
  return `${count} ${plural}`;
}

/**
 * Summary-Zeile für den Header, z. B.
 * „5 neue Vorgänge · 1 Dublette · 2 bereit · 2 unvollständig“
 */
export function buildCleverInboxSummary(items = []) {
  const total = items.length;
  const duplicates = items.filter((item) => item.status === CLEVER_EINGANG_STATUS.DUPLICATE).length;
  const ready = items.filter((item) => item.status === CLEVER_EINGANG_STATUS.READY).length;
  const incomplete = items.filter((item) => item.status === CLEVER_EINGANG_STATUS.INCOMPLETE).length;
  const review = items.filter((item) => item.status === CLEVER_EINGANG_STATUS.REVIEW).length;
  const assigned = items.filter((item) => item.status === CLEVER_EINGANG_STATUS.ASSIGNED).length;

  if (total === 0) {
    return {
      line: 'Keine neuen Vorgänge',
      total,
      duplicates,
      ready,
      incomplete,
      review,
      assigned,
    };
  }

  const parts = [countLabel(total, 'neuer Vorgang', 'neue Vorgänge')];
  if (duplicates > 0) parts.push(countLabel(duplicates, 'Dublette', 'Dubletten'));
  if (review > 0) parts.push(countLabel(review, 'zum Prüfen', 'zum Prüfen'));
  if (ready > 0) parts.push(countLabel(ready, 'bereit', 'bereit'));
  if (incomplete > 0) parts.push(countLabel(incomplete, 'unvollständig', 'unvollständig'));
  if (assigned > 0) parts.push(countLabel(assigned, 'zugeordnet', 'zugeordnet'));

  return {
    line: parts.join(' · '),
    total,
    duplicates,
    ready,
    incomplete,
    review,
    assigned,
  };
}

export function filterCleverInboxItems(items = [], query = '') {
  const q = normalizeText(query);
  if (!q) return items;
  return items.filter((item) => {
    const haystack = [
      item.title,
      item.vehicleLabel,
      item.sourceLabel,
      item.statusLabel,
      item.contextHint,
      item.leadId,
      ...(item.memberLeadIds || []),
    ].map(normalizeText).join(' ');
    return haystack.includes(q);
  });
}

/**
 * Baut die Clever-Eingang-Arbeitsqueue aus Leads/Intakes.
 * Dubletten werden gruppiert (keine Auto-Merge).
 *
 * @param {object[]} leads
 * @param {{ nowMs?: number, includeAllStatuses?: boolean }} [options]
 */
export function buildCleverInboxItems(leads = [], options = {}) {
  const nowMs = options.nowMs ?? Date.now();
  const pool = options.includeAllStatuses
    ? [...leads]
    : getNewInquiryLeads(leads);

  const groups = groupDuplicateLeads(pool);
  const items = groups.map((members) => buildItemFromGroup(members, nowMs));
  const sorted = sortCleverInboxItems(items);
  const summary = buildCleverInboxSummary(sorted);

  return {
    items: sorted,
    summary,
  };
}
