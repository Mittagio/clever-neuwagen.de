/**
 * sellerInsights – Verkäufer-Erkenntnisse nach Übergabe.
 * Schreibpfad: Verkäufer → lead.crm.sellerInsights (append-only).
 * Gleiche Erkennung wie needProfile (mergeTextIntoNeedProfile), andere Quelle.
 */
import {
  buildUnderstoodLabels,
  mergeTextIntoNeedProfile,
} from '../consultation/needProfileService.js';

export const SELLER_INSIGHT_SOURCE = 'seller';

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

/**
 * @param {object} lead
 */
export function getSellerInsightsFromLead(lead = {}) {
  return normalizeSellerInsights(lead?.crm?.sellerInsights ?? []);
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
