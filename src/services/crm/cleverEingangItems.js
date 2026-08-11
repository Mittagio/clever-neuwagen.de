/**
 * Clever Eingang – intelligente Arbeitsqueue aus neuen Leads/Intakes.
 * Interne Source-Keys bleiben im Modell; die UI zeigt nur Labels.
 * Produktregel: Clever zeigt keine Dubletten-Flut – wenige prüfbare Vorgangsgruppen.
 */
import { PAYMENT_TYPES } from '../../data/leadTypes.js';
import {
  buildKundenaktePath,
  formatInquiryVehicleLine,
  getNewInquiryLeads,
} from '../leadAkteEntry.js';

export const CLEVER_EINGANG_DUPLICATE_BANNER =
  'Clever vermutet eine Dublette und empfiehlt die Zusammenführung der Vorgänge.';

export const CLEVER_EINGANG_STATUS = {
  DUPLICATE: 'duplicate',
  READY: 'ready',
  REVIEW: 'review',
  INCOMPLETE: 'incomplete',
  ASSIGNED: 'assigned',
};

export const CLEVER_EINGANG_STATUS_LABELS = {
  [CLEVER_EINGANG_STATUS.DUPLICATE]: 'Mögliche Dublette',
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

/** Kurze Quellenlabels für Gruppenkarten („Verkaufsassistent + Clever Composer“) */
const SOURCE_SHORT_LABELS = {
  composer_multi_source: 'Clever Composer',
  sales_assistant: 'Verkaufsassistent',
  email: 'E-Mail',
  homepage: 'Händlerhomepage',
  document: 'Dokument',
  seller_note: 'Gesprächsnotiz',
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

function resolveCanonicalSource(sourceKey) {
  const raw = String(sourceKey ?? '').trim();
  if (!raw) return null;
  return SOURCE_CANONICAL[raw] ?? SOURCE_CANONICAL[normalizeText(raw).replace(/\s+/g, '_')] ?? null;
}

/**
 * Menschlich lesbares Quellenlabel – nie interne Keys in der UI.
 * @param {string} sourceKey
 * @returns {string}
 */
export function mapInboxSourceLabel(sourceKey) {
  const raw = String(sourceKey ?? '').trim();
  if (!raw) return 'Unbekannte Quelle';

  const canonical = resolveCanonicalSource(raw);
  if (canonical && SOURCE_LABELS[canonical]) {
    return SOURCE_LABELS[canonical];
  }

  if (SOURCE_LABELS[raw]) return SOURCE_LABELS[raw];

  if (looksLikeInternalKey(raw)) {
    return 'Über Clever erfasst';
  }

  return raw;
}

/**
 * Kurzes Quellenlabel für Gruppenkarten.
 * @param {string} sourceKey
 * @returns {string}
 */
export function mapInboxSourceShortLabel(sourceKey) {
  const raw = String(sourceKey ?? '').trim();
  if (!raw) return 'Unbekannt';

  const canonical = resolveCanonicalSource(raw);
  if (canonical && SOURCE_SHORT_LABELS[canonical]) {
    return SOURCE_SHORT_LABELS[canonical];
  }

  if (SOURCE_SHORT_LABELS[raw]) return SOURCE_SHORT_LABELS[raw];

  if (looksLikeInternalKey(raw)) {
    return 'Clever Composer';
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

  const sourceA = resolveCanonicalSource(a.source) ?? a.source;
  const sourceB = resolveCanonicalSource(b.source) ?? b.source;
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

/**
 * Union-Find-Gruppierung: ähnliche Leads → eine Vorgangsgruppe.
 * Transitiv: A~B und B~C → eine Gruppe.
 */
function groupDuplicateLeads(leads = []) {
  const n = leads.length;
  if (n === 0) return [];

  const parent = Array.from({ length: n }, (_, i) => i);

  function find(i) {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  }

  function union(i, j) {
    const rootI = find(i);
    const rootJ = find(j);
    if (rootI !== rootJ) parent[rootJ] = rootI;
  }

  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      if (leadsAreLikelyDuplicates(leads[i], leads[j])) {
        union(i, j);
      }
    }
  }

  const buckets = new Map();
  for (let i = 0; i < n; i += 1) {
    const root = find(i);
    if (!buckets.has(root)) buckets.set(root, []);
    buckets.get(root).push(leads[i]);
  }

  return [...buckets.values()];
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
      if (groupSize >= 7) {
        return {
          id: 'review_group',
          label: 'Vorgänge prüfen →',
          href: buildKundenaktePath(lead.id),
        };
      }
      if (groupSize >= 3) {
        return {
          id: 'review_group',
          label: 'Zusammenführen prüfen →',
          href: buildKundenaktePath(lead.id),
        };
      }
      return {
        id: 'review_group',
        label: 'Dublette prüfen →',
        href: buildKundenaktePath(lead.id),
      };
    case CLEVER_EINGANG_STATUS.INCOMPLETE:
      return {
        id: 'complete_details',
        label: 'Angaben ergänzen →',
        href: buildKundenaktePath(lead.id),
      };
    case CLEVER_EINGANG_STATUS.ASSIGNED:
      return {
        id: 'open_customer',
        label: 'Zur Kundenakte →',
        href: buildKundenaktePath(lead.id),
      };
    case CLEVER_EINGANG_STATUS.REVIEW:
      return {
        id: 'review_akte',
        label: 'Akte prüfen →',
        href: buildKundenaktePath(lead.id),
      };
    case CLEVER_EINGANG_STATUS.READY:
    default:
      if (lead.contractPending || lead.crm?.contractPending) {
        return {
          id: 'review_contract',
          label: 'Vertrag prüfen →',
          href: buildKundenaktePath(lead.id),
        };
      }
      if (lead.needsOffer === true) {
        return {
          id: 'prepare_offer',
          label: 'Angebot vorbereiten →',
          href: buildKundenaktePath(lead.id),
        };
      }
      return {
        id: 'take_over',
        label: 'Übernehmen →',
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

function buildGroupSourceLabel(members = []) {
  const labels = [];
  const seen = new Set();
  const ordered = [...members].sort((a, b) => leadTimestamp(b) - leadTimestamp(a));

  for (const member of ordered) {
    const short = mapInboxSourceShortLabel(member.source);
    if (!seen.has(short)) {
      seen.add(short);
      labels.push(short);
    }
  }

  return labels.join(' + ') || 'Unbekannte Quelle';
}

/** Kurzes Fahrzeuglabel für Ähnlichkeitsgrund (ohne Markenpräfix). */
function shortVehicleForHint(lead = {}) {
  const model = String(lead.vehicle?.model ?? '').trim();
  const trim = String(lead.vehicle?.trim ?? '').trim();
  if (model && trim) return `${model} ${trim}`;
  if (model) return model;
  const label = String(lead.vehicle?.label ?? '').trim();
  if (!label) return '';
  return label.replace(/^(kia|hyundai)\s+/i, '').trim() || label;
}

/**
 * Einzeiliger Grund, warum Vorgänge gruppiert wurden (Name/Kunde + Fahrzeug).
 */
export function buildDuplicateReason(members = [], primary = {}) {
  const names = members.map((m) => normalizeText(resolveLeadContactName(m))).filter(Boolean);
  const sameName = names.length >= 2 && names.every((n) => n === names[0]);

  const emails = members.map((m) => normalizeEmail(m.contact?.email)).filter(Boolean);
  const phones = members.map((m) => normalizePhone(m.contact?.phone)).filter(Boolean);
  const sameEmail = emails.length >= 2 && emails.every((e) => e === emails[0]);
  const samePhone = phones.length >= 2 && phones.every((p) => {
    const ref = phones[0];
    return p === ref || p.endsWith(ref) || ref.endsWith(p);
  });
  const sameCustomer = sameEmail || samePhone;

  const vehicleKeys = members.map((m) => vehicleKey(m)).filter(Boolean);
  const commonVehicle = vehicleKeys.length > 0 && vehicleKeys.every((v) => v === vehicleKeys[0]);
  const vehicleLead = commonVehicle
    ? (members.find((m) => vehicleKey(m)) || primary)
    : primary;
  const vehiclePart = shortVehicleForHint(vehicleLead);

  const identity = sameCustomer ? 'gleicher Kunde' : (sameName ? 'gleicher Name' : 'ähnliche Angaben');
  if (vehiclePart) return `${identity} und ${vehiclePart}`;
  return identity;
}

function buildContextHint(status, lead = {}, groupSize = 1, members = []) {
  if (status === CLEVER_EINGANG_STATUS.DUPLICATE && groupSize > 1) {
    // Große Gruppen: ruhig bundeln, ohne Alarm-Rhetorik
    if (groupSize >= 7) {
      return `${groupSize} Vorgänge bereits gebündelt`;
    }
    return `${groupSize} ähnliche Vorgänge gefunden`;
  }
  if (status === CLEVER_EINGANG_STATUS.INCOMPLETE) {
    return 'Name oder Kontaktdaten fehlen';
  }
  if (status === CLEVER_EINGANG_STATUS.ASSIGNED) {
    return 'Ergänzung zu bestehendem Kunden';
  }
  if (status === CLEVER_EINGANG_STATUS.REVIEW) {
    return 'Angaben brauchen deine Prüfung';
  }
  return null;
}

/** Problematische Vorgänge brauchen visuelle Aufmerksamkeit – Bereit/Zugeordnet bleiben ruhig. */
export function isCleverEingangAttentionStatus(status) {
  return (
    status === CLEVER_EINGANG_STATUS.DUPLICATE
    || status === CLEVER_EINGANG_STATUS.REVIEW
    || status === CLEVER_EINGANG_STATUS.INCOMPLETE
  );
}

function formatEuroAmount(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '';
  return `${num.toLocaleString('de-DE')} €`;
}

/**
 * Erkannte Angaben für die Detail-Pane (Chip-Grid).
 * Nutzt vorhandene Lead-/Wish-Felder; fehlende Werte werden weggelassen.
 * @param {object} lead
 * @returns {{ id: string, icon: string, label: string }[]}
 */
export function buildRecognizedFactChips(lead = {}) {
  const chips = [];
  const wish = lead.wish ?? {};

  const vehicle = formatInquiryVehicleLine(lead);
  if (vehicle && vehicle !== 'Fahrzeug offen') {
    chips.push({ id: 'vehicle', icon: 'vehicle', label: vehicle });
  }

  const paymentType = lead.paymentType ?? wish.paymentType ?? null;
  if (paymentType && PAYMENT_TYPES[paymentType]?.label) {
    chips.push({ id: 'payment', icon: 'document', label: PAYMENT_TYPES[paymentType].label });
  }

  const termMonths = wish.termMonths ?? lead.termMonths ?? null;
  if (termMonths != null && Number(termMonths) > 0) {
    chips.push({ id: 'term', icon: 'calendar', label: `${Number(termMonths)} Monate` });
  }

  const transmission = lead.vehicle?.transmission
    ?? wish.transmission
    ?? lead.transmission
    ?? null;
  if (transmission) {
    chips.push({ id: 'transmission', icon: 'gear', label: String(transmission).trim() });
  }

  const downPayment = wish.downPayment ?? lead.downPayment;
  if (downPayment != null && downPayment !== '' && Number.isFinite(Number(downPayment))) {
    chips.push({
      id: 'downPayment',
      icon: 'money',
      label: `Anzahlung ${formatEuroAmount(downPayment)}`,
    });
  }

  const mileage = wish.mileagePerYear ?? lead.mileagePerYear ?? null;
  if (mileage != null && Number(mileage) > 0) {
    chips.push({
      id: 'mileage',
      icon: 'calendar',
      label: `${Number(mileage).toLocaleString('de-DE')} km/Jahr`,
    });
  }

  const desiredRate = lead.desiredRate ?? wish.desiredRate ?? null;
  if (desiredRate != null && Number(desiredRate) > 0 && !chips.some((c) => c.id === 'downPayment')) {
    chips.push({
      id: 'rate',
      icon: 'money',
      label: `${formatEuroAmount(desiredRate)} / Monat`,
    });
  }

  return chips;
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
  const sourceLabel = isDuplicateGroup
    ? buildGroupSourceLabel(members)
    : mapInboxSourceShortLabel(primary.source);
  const displayName = buildDisplayTitle(primary, status);
  const title = isDuplicateGroup && members.length > 1
    ? `${displayName} · ${members.length} Vorgänge`
    : displayName;
  const memberCountLabel = members.length > 1 ? `${members.length} Vorgänge` : null;

  return {
    id: isDuplicateGroup ? `group:${members.map((m) => m.id).sort().join('+')}` : primary.id,
    leadId: primary.id,
    memberLeadIds: members.map((m) => m.id),
    memberCount: members.length,
    isGroup: isDuplicateGroup,
    primaryLead: primary,
    members,
    status,
    statusLabel: CLEVER_EINGANG_STATUS_LABELS[status],
    needsAttention: isCleverEingangAttentionStatus(status),
    displayName,
    title,
    memberCountLabel,
    vehicleLabel: formatInquiryVehicleLine(primary),
    sourceKey: primary.source ?? null,
    sourceLabel,
    sourceLabels: isDuplicateGroup
      ? [...new Set(members.map((m) => mapInboxSourceShortLabel(m.source)))]
      : [mapInboxSourceShortLabel(primary.source)],
    createdAt,
    relativeTime: formatInboxRelativeTime(createdAt, nowMs),
    contextHint: buildContextHint(status, primary, members.length, members),
    duplicateReason: isDuplicateGroup ? buildDuplicateReason(members, primary) : null,
    detailBanner: status === CLEVER_EINGANG_STATUS.DUPLICATE
      ? CLEVER_EINGANG_DUPLICATE_BANNER
      : null,
    recognizedFacts: buildRecognizedFactChips(primary),
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

/**
 * Filter-Pills + Meta für den Clever-Eingang-Header.
 * „Mögliche Dubletten“ = Anzahl Gruppenkarten (nicht Roh-Einträge).
 * „Alle“ = Summe der sichtbaren Kategorie-Counts (jede Karte genau eine Kategorie).
 */
export function buildCleverInboxSummary(items = []) {
  const total = items.length;
  const unreadCount = items.filter((item) => item.isUnread).length;
  const duplicateItems = items.filter((item) => item.status === CLEVER_EINGANG_STATUS.DUPLICATE);
  const duplicates = duplicateItems.length;
  const duplicateMemberCount = duplicateItems.reduce((sum, item) => sum + (item.memberCount || 0), 0);
  const ready = items.filter((item) => item.status === CLEVER_EINGANG_STATUS.READY).length;
  const incomplete = items.filter((item) => item.status === CLEVER_EINGANG_STATUS.INCOMPLETE).length;
  const review = items.filter((item) => item.status === CLEVER_EINGANG_STATUS.REVIEW).length;
  const assigned = items.filter((item) => item.status === CLEVER_EINGANG_STATUS.ASSIGNED).length;

  const filters = [
    { id: 'all', label: 'Alle', count: total },
    { id: CLEVER_EINGANG_STATUS.REVIEW, label: 'Prüfen', count: review },
    { id: CLEVER_EINGANG_STATUS.DUPLICATE, label: 'Mögliche Dubletten', count: duplicates },
    { id: CLEVER_EINGANG_STATUS.READY, label: 'Bereit', count: ready },
    { id: CLEVER_EINGANG_STATUS.INCOMPLETE, label: 'Unvollständig', count: incomplete },
    { id: CLEVER_EINGANG_STATUS.ASSIGNED, label: 'Zugeordnet', count: assigned },
  ];

  const groupHint = duplicates > 0
    ? (duplicates === 1
      ? '1 Gruppe mit möglichen Dubletten erkannt'
      : `${duplicates} Gruppen mit möglichen Dubletten erkannt`)
    : null;

  const stats = [
    { id: 'open', label: 'offen', count: total, icon: 'inbox', tone: 'lavender' },
    { id: 'review', label: 'prüfen', count: review, icon: 'search', tone: 'blue' },
    { id: 'duplicate', label: 'mögliche Dubletten', count: duplicates, icon: 'people', tone: 'lavender' },
    { id: 'ready', label: 'bereit', count: ready, icon: 'check', tone: 'green' },
    { id: 'incomplete', label: 'unvollständig', count: incomplete, icon: 'warning', tone: 'orange' },
  ];

  if (total === 0) {
    return {
      line: 'Keine neuen Vorgänge',
      groupHint: null,
      filters,
      stats,
      total,
      unreadCount: 0,
      duplicates,
      duplicateMemberCount: 0,
      ready,
      incomplete,
      review,
      assigned,
    };
  }

  const lineParts = [
    `${total} offen`,
    `${review} prüfen`,
    `${duplicates} mögliche Dubletten`,
    `${ready} bereit`,
    `${incomplete} unvollständig`,
  ];

  return {
    line: lineParts.join(' · '),
    groupHint,
    filters,
    stats,
    total,
    unreadCount,
    duplicates,
    duplicateMemberCount,
    ready,
    incomplete,
    review,
    assigned,
  };
}

/**
 * Dashboard-Kachel: „X ungelesen · Y offene Vorgänge“
 * @param {object[]} [leads]
 */
export function buildCleverEingangDashboardCounts(leads = []) {
  const { items, summary } = buildCleverInboxItems(leads);
  const unreadCount = summary?.unreadCount
    ?? items.filter((item) => item.isUnread).length;
  const openCount = summary?.total ?? items.length;
  return {
    unreadCount,
    openCount,
    label: `${unreadCount} ungelesen · ${openCount} offene Vorgänge`,
    items,
    summary,
  };
}

export function filterCleverInboxItems(items = [], query = '', statusFilter = 'all') {
  let result = items;
  if (statusFilter && statusFilter !== 'all') {
    result = result.filter((item) => item.status === statusFilter);
  }

  const q = normalizeText(query);
  if (!q) return result;

  return result.filter((item) => {
    const haystack = [
      item.title,
      item.vehicleLabel,
      item.sourceLabel,
      item.statusLabel,
      item.contextHint,
      item.leadId,
      ...(item.memberLeadIds || []),
      ...(item.sourceLabels || []),
    ].map(normalizeText).join(' ');
    return haystack.includes(q);
  });
}

/**
 * Baut die Clever-Eingang-Arbeitsqueue aus Leads/Intakes.
 * Ähnliche Einträge → wenige Gruppenkarten (keine Auto-Merge).
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
