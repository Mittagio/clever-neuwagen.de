/**
 * sellerInsights – Verkäufer-Erkenntnisse nach Übergabe.
 * Schreibpfad: Verkäufer → lead.crm.sellerInsights (append-only).
 * Gleiche Erkennung wie needProfile (mergeTextIntoNeedProfile), andere Quelle.
 */
import { parseKundenhelferNotes } from '../cleverKundenhelfer.js';
import {
  buildUnderstoodLabels,
  mergeTextIntoNeedProfile,
} from '../consultation/needProfileService.js';
import { buildAdvisorInitials } from '../crm/customerPortalAdvisorService.js';

export const SELLER_INSIGHT_SOURCE = 'seller';
export const MIGRATED_FROM_KUNDENHELFER = 'kundenhelfer';
export const SELLER_BADGE_FALLBACK = 'VK';

export const SELLER_INSIGHT_CONTEXT = {
  PHONE: 'phone_call',
  TEST_DRIVE: 'test_drive',
  OFFER: 'offer',
  CALLBACK: 'callback',
  VEHICLE_VIEWING: 'vehicle_viewing',
  EMAIL: 'email',
  SHOWROOM: 'showroom',
  VOICE_NOTE: 'voice_note',
  HANDWRITTEN_NOTE: 'handwritten_note',
  OTHER: 'other',
};

function createSellerInsightId() {
  return `si-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Verkäufer-Kürzel für Chip-Badge (MQ, CG, …) – Fallback „VK“.
 * @param {{ sellerInitials?: string, sellerName?: string, sellerId?: string }} [options]
 * @param {object} [lead]
 */
export function resolveSellerAttribution(options = {}, lead = {}) {
  const sellerName = String(
    options.sellerName
    ?? lead?.ownerName
    ?? '',
  ).trim() || null;
  const sellerId = options.sellerId
    ?? lead?.ownerId
    ?? lead?.assignedSellerId
    ?? null;
  const fromOptions = String(options.sellerInitials ?? '').trim().toUpperCase();
  const fromName = sellerName ? buildAdvisorInitials(sellerName) : '';
  const sellerInitials = fromOptions || fromName || SELLER_BADGE_FALLBACK;
  return {
    sellerId: sellerId || null,
    sellerName,
    sellerInitials,
  };
}

/**
 * @param {object} insight
 */
export function normalizeSellerInsight(insight = {}) {
  if (!insight || typeof insight !== 'object') return null;
  const text = String(insight.text ?? '').trim();
  if (!text) return null;

  const parsed = mergeTextIntoNeedProfile(text);
  const attribution = resolveSellerAttribution(insight);

  return {
    id: insight.id ?? createSellerInsightId(),
    text,
    source: SELLER_INSIGHT_SOURCE,
    context: insight.context ?? null,
    createdAt: insight.createdAt ?? insight.updatedAt ?? new Date().toISOString(),
    updatedAt: insight.updatedAt ?? insight.createdAt ?? new Date().toISOString(),
    understoodLabels: insight.understoodLabels?.length
      ? [...insight.understoodLabels]
      : (parsed.understoodLabels ?? buildUnderstoodLabels(parsed)),
    priorities: insight.priorities?.length
      ? [...insight.priorities]
      : [...(parsed.priorities ?? [])],
    migratedFrom: insight.migratedFrom ?? null,
    sellerId: attribution.sellerId,
    sellerName: attribution.sellerName,
    sellerInitials: attribution.sellerInitials,
    attachment: normalizeInsightAttachment(insight.attachment),
  };
}

/**
 * Chip-Vorschläge aus Freitext / Diktat / Scan-Text (VK bestätigt danach).
 * @param {string} text
 * @returns {string[]}
 */
export function proposeSellerInsightLabels(text = '') {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) return [];
  const parsed = mergeTextIntoNeedProfile(trimmed);
  return [...(parsed.understoodLabels ?? buildUnderstoodLabels(parsed))];
}

function normalizeInsightAttachment(attachment = null) {
  if (!attachment || typeof attachment !== 'object') return null;
  const dataUrl = String(attachment.dataUrl ?? '').trim();
  if (!dataUrl.startsWith('data:image')) return null;
  return {
    type: 'image',
    dataUrl,
    createdAt: attachment.createdAt ?? new Date().toISOString(),
  };
}

/**
 * @param {object[]} insights
 */
export function normalizeSellerInsights(insights = []) {
  if (!Array.isArray(insights)) return [];
  return insights
    .map((insight) => normalizeSellerInsight(insight))
    .filter(Boolean)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

function normalizeDedupKey(text = '') {
  return String(text).toLowerCase().replace(/\s+/g, ' ').trim();
}

function collectNeedProfileLabels(lead = {}) {
  const profile = lead?.crm?.needProfile ?? {};
  if (profile.understoodLabels?.length) {
    return [...profile.understoodLabels];
  }
  if (!profile.rawMessages?.length && !profile.initialWish) {
    return [];
  }
  return buildUnderstoodLabels(profile);
}

function isCoveredByNeedProfile(chip = '', needLabels = []) {
  const chipKey = normalizeDedupKey(chip);
  if (!chipKey) return false;
  return needLabels.some((label) => {
    const labelKey = normalizeDedupKey(label);
    if (!labelKey) return false;
    return labelKey === chipKey || labelKey.includes(chipKey) || chipKey.includes(labelKey);
  });
}

function isInsightTextDuplicate(text = '', insights = [], pending = []) {
  const key = normalizeDedupKey(text);
  if (!key) return true;
  return [...insights, ...pending].some(
    (insight) => normalizeDedupKey(insight.text) === key,
  );
}

function createMigratedSellerInsight(text = '', createdAt = null) {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) return null;
  const at = createdAt ?? new Date().toISOString();
  return normalizeSellerInsight({
    id: createSellerInsightId(),
    text: trimmed,
    source: SELLER_INSIGHT_SOURCE,
    context: null,
    migratedFrom: MIGRATED_FROM_KUNDENHELFER,
    createdAt: at,
    updatedAt: at,
  });
}

function computeMigratedKundenhelferInsights(lead = {}, existing = []) {
  const notes = String(lead?.crm?.kundenhelfer?.notes ?? '').trim();
  const chips = parseKundenhelferNotes(notes);
  if (!chips.length) return [];

  const needLabels = collectNeedProfileLabels(lead);
  const pending = [];
  const migratedAt = lead?.updatedAt ?? lead?.createdAt ?? new Date().toISOString();

  for (const chip of chips) {
    if (isInsightTextDuplicate(chip, existing, pending)) continue;
    if (isCoveredByNeedProfile(chip, needLabels)) continue;
    const insight = createMigratedSellerInsight(chip, migratedAt);
    if (insight) pending.push(insight);
  }

  return pending;
}

/**
 * Copy-first: kundenhelfer.notes → sellerInsights (idempotent, needProfile unangetastet).
 * @param {object} lead
 */
export function migrateKundenhelferToSellerInsights(lead = {}) {
  if (lead?.crm?.migration?.kundenhelferV1At) {
    return lead;
  }

  const notes = String(lead?.crm?.kundenhelfer?.notes ?? '').trim();
  const chips = parseKundenhelferNotes(notes);
  if (!chips.length) {
    return lead;
  }

  const existing = normalizeSellerInsights(lead?.crm?.sellerInsights ?? []);
  const pending = computeMigratedKundenhelferInsights(lead, existing);
  const now = new Date().toISOString();

  return {
    ...lead,
    crm: {
      ...(lead.crm ?? {}),
      kundenhelfer: {
        ...(lead.crm?.kundenhelfer ?? {}),
      },
      sellerInsights: [...existing, ...pending],
      migration: {
        ...(lead.crm?.migration ?? {}),
        kundenhelferV1At: now,
      },
    },
  };
}

/**
 * @param {object} lead
 */
export function getSellerInsightsFromLead(lead = {}) {
  const existing = normalizeSellerInsights(lead?.crm?.sellerInsights ?? []);
  if (lead?.crm?.migration?.kundenhelferV1At) {
    return existing;
  }
  const virtual = computeMigratedKundenhelferInsights(lead, existing);
  return normalizeSellerInsights([...existing, ...virtual]);
}

/**
 * @param {object} lead
 */
export function hasSellerInsights(lead = {}) {
  return getSellerInsightsFromLead(lead).length > 0;
}

/**
 * @param {string} text
 * @param {{
 *   context?: string|null,
 *   createdAt?: string,
 *   sellerId?: string,
 *   sellerName?: string,
 *   sellerInitials?: string,
 *   understoodLabels?: string[],
 *   attachment?: { type?: string, dataUrl?: string, createdAt?: string }|null,
 * }} [options]
 */
export function createSellerInsight(text = '', options = {}) {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) return null;

  const now = options.createdAt ?? new Date().toISOString();
  const attribution = resolveSellerAttribution(options);
  return normalizeSellerInsight({
    id: createSellerInsightId(),
    text: trimmed,
    source: SELLER_INSIGHT_SOURCE,
    context: options.context ?? null,
    createdAt: now,
    updatedAt: now,
    sellerId: attribution.sellerId,
    sellerName: attribution.sellerName,
    sellerInitials: attribution.sellerInitials,
    understoodLabels: options.understoodLabels,
    attachment: options.attachment ?? null,
  });
}

/**
 * @param {object} lead
 * @param {string} text
 * @param {{ context?: string|null, sellerId?: string, sellerName?: string, sellerInitials?: string }} [options]
 */
export function appendSellerInsightToLead(lead = {}, text = '', options = {}) {
  const insight = createSellerInsight(text, {
    ...options,
    ...resolveSellerAttribution(options, lead),
  });
  if (!insight) return lead;

  const existing = getSellerInsightsFromLead(lead);
  return mergeSellerInsightsIntoLead(lead, [...existing, insight]);
}

/**
 * Mehrere Freitexte/Chips als Verkäufer-Erkenntnisse anhängen.
 * Schreibt ausschließlich nach crm.sellerInsights.
 * - ignoriert leere Texte
 * - dedupliziert (gegen bestehende + virtuelle Insights und untereinander)
 * - verändert needProfile nicht
 * - verändert kundenhelfer.notes nicht
 *
 * @param {object} lead
 * @param {string[]|string} texts
 * @param {{ context?: string|null, sellerId?: string, sellerName?: string, sellerInitials?: string }} [options]
 */
export function appendSellerInsightsFromTexts(lead = {}, texts = [], options = {}) {
  const list = Array.isArray(texts) ? texts : [texts];
  const existing = getSellerInsightsFromLead(lead);
  const pending = [];
  const attribution = resolveSellerAttribution(options, lead);

  for (const raw of list) {
    const trimmed = String(raw ?? '').trim();
    if (!trimmed) continue;
    if (isInsightTextDuplicate(trimmed, existing, pending)) continue;
    const insight = createSellerInsight(trimmed, { ...options, ...attribution });
    if (insight) pending.push(insight);
  }

  if (!pending.length) return lead;

  return mergeSellerInsightsIntoLead(lead, [...existing, ...pending]);
}

/**
 * @param {object} lead
 * @param {object[]} insights
 */
export function mergeSellerInsightsIntoLead(lead = {}, insights = []) {
  const normalized = normalizeSellerInsights(insights);
  return {
    ...lead,
    updatedAt: new Date().toISOString(),
    crm: {
      ...(lead.crm ?? {}),
      sellerInsights: normalized,
    },
  };
}
