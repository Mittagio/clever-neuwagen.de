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

export const SELLER_INSIGHT_SOURCE = 'seller';
export const MIGRATED_FROM_KUNDENHELFER = 'kundenhelfer';

export const SELLER_INSIGHT_CONTEXT = {
  PHONE: 'phone_call',
  TEST_DRIVE: 'test_drive',
  OFFER: 'offer',
  EMAIL: 'email',
  SHOWROOM: 'showroom',
  OTHER: 'other',
};

function createSellerInsightId() {
  return `si-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * @param {object} insight
 */
export function normalizeSellerInsight(insight = {}) {
  if (!insight || typeof insight !== 'object') return null;
  const text = String(insight.text ?? '').trim();
  if (!text) return null;

  const parsed = mergeTextIntoNeedProfile(text);

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
 * @param {{ context?: string|null, createdAt?: string }} [options]
 */
export function createSellerInsight(text = '', options = {}) {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) return null;

  const now = options.createdAt ?? new Date().toISOString();
  return normalizeSellerInsight({
    id: createSellerInsightId(),
    text: trimmed,
    source: SELLER_INSIGHT_SOURCE,
    context: options.context ?? null,
    createdAt: now,
    updatedAt: now,
  });
}

/**
 * @param {object} lead
 * @param {string} text
 * @param {{ context?: string|null }} [options]
 */
export function appendSellerInsightToLead(lead = {}, text = '', options = {}) {
  const insight = createSellerInsight(text, options);
  if (!insight) return lead;

  const existing = getSellerInsightsFromLead(lead);
  return mergeSellerInsightsIntoLead(lead, [...existing, insight]);
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
