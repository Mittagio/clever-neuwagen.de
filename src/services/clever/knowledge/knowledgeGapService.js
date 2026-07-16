/**
 * Wissenslücken-Inbox – Admin-/Datenobjekt, keine Kundenwahrheit.
 */
import { redactPersonalData } from './redactVehicleQuery.js';

export const KNOWLEDGE_GAP_STATUSES = {
  NEW: 'new',
  REVIEWED: 'reviewed',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  RESOLVED: 'resolved',
};

function uid() {
  return `kgap-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * @param {object} params
 */
export function buildKnowledgeGapRecord(params = {}) {
  const now = new Date().toISOString();
  return {
    id: params.id ?? uid(),
    status: params.status ?? KNOWLEDGE_GAP_STATUSES.NEW,
    createdAt: params.createdAt ?? now,
    brandKey: params.brandKey ?? null,
    modelKey: params.modelKey ?? null,
    variantKey: params.variantKey ?? null,
    requestedFact: params.requestedFact ?? null,
    customerQuestionRedacted: redactPersonalData(params.customerQuestionRedacted ?? ''),
    internalDataStatus: params.internalDataStatus ?? 'missing',
    proposedEvidence: params.proposedEvidence ?? [],
    sourceUrls: params.sourceUrls ?? [],
    sourceDomains: params.sourceDomains ?? [],
    conversationTurnId: params.conversationTurnId ?? null,
    customerQuestionCount: params.customerQuestionCount ?? 1,
    reviewedBy: params.reviewedBy ?? null,
    reviewedAt: params.reviewedAt ?? null,
    resolution: params.resolution ?? null,
  };
}

/**
 * @param {object[]} gaps
 * @param {object} candidate
 */
export function upsertKnowledgeGap(gaps = [], candidate = {}) {
  const next = [...gaps];
  const idx = next.findIndex((gap) => gap.status === KNOWLEDGE_GAP_STATUSES.NEW
    && gap.modelKey === candidate.modelKey
    && gap.requestedFact === candidate.requestedFact
    && gap.variantKey === (candidate.variantKey ?? null));

  if (idx >= 0) {
    const existing = next[idx];
    next[idx] = {
      ...existing,
      customerQuestionCount: (existing.customerQuestionCount ?? 1) + 1,
      customerQuestionRedacted: candidate.customerQuestionRedacted ?? existing.customerQuestionRedacted,
      proposedEvidence: candidate.proposedEvidence?.length
        ? candidate.proposedEvidence
        : existing.proposedEvidence,
      sourceUrls: candidate.sourceUrls?.length ? candidate.sourceUrls : existing.sourceUrls,
      sourceDomains: candidate.sourceDomains?.length
        ? candidate.sourceDomains
        : existing.sourceDomains,
      internalDataStatus: candidate.internalDataStatus ?? existing.internalDataStatus,
    };
    return { gaps: next, gap: next[idx], created: false };
  }

  const gap = buildKnowledgeGapRecord(candidate);
  next.unshift(gap);
  return { gaps: next, gap, created: true };
}

/**
 * Leitet Wissenslücken aus Tool-Ergebnissen ab.
 * @param {object} params
 */
export function deriveKnowledgeGapsFromTurn({
  toolResults = [],
  customerMessage = '',
  conversationTurnId = null,
  brandKey = 'kia',
} = {}) {
  const gaps = [];

  for (const tool of toolResults) {
    if (tool.name === 'get_verified_vehicle_facts') {
      const requested = tool.arguments?.requestedFacts ?? [];
      const foundKeys = new Set((tool.output?.facts ?? []).map((f) => f.key));
      const missing = tool.output?.missingFacts
        ?? requested.filter((key) => !foundKeys.has(key));

      for (const factKey of missing) {
        gaps.push(buildKnowledgeGapRecord({
          brandKey,
          modelKey: tool.arguments?.modelKey ?? null,
          variantKey: tool.arguments?.variantKey ?? null,
          requestedFact: factKey,
          customerQuestionRedacted: customerMessage,
          internalDataStatus: 'missing',
          conversationTurnId,
        }));
      }
    }

    if (tool.name === 'search_official_manufacturer_knowledge') {
      const output = tool.output ?? {};
      if (output.status === 'not_found') {
        for (const factKey of output.missingFacts ?? []) {
          gaps.push(buildKnowledgeGapRecord({
            brandKey: output.brandKey ?? brandKey,
            modelKey: tool.arguments?.modelKey ?? null,
            variantKey: tool.arguments?.variantKey ?? null,
            requestedFact: factKey,
            customerQuestionRedacted: customerMessage,
            internalDataStatus: 'missing_no_official_source',
            conversationTurnId,
          }));
        }
      }

      if (output.status === 'conflicting') {
        for (const conflict of output.conflicts ?? []) {
          gaps.push(buildKnowledgeGapRecord({
            brandKey: output.brandKey ?? brandKey,
            modelKey: tool.arguments?.modelKey ?? null,
            variantKey: tool.arguments?.variantKey ?? null,
            requestedFact: conflict.factKey,
            customerQuestionRedacted: customerMessage,
            internalDataStatus: 'conflict_internal_vs_official',
            proposedEvidence: (output.evidence ?? []).filter((e) => e.factKey === conflict.factKey),
            sourceUrls: (output.evidence ?? []).map((e) => e.sourceUrl).filter(Boolean),
            sourceDomains: (output.evidence ?? []).map((e) => e.sourceDomain).filter(Boolean),
            conversationTurnId,
          }));
        }
      }

      if (output.status === 'found' && (output.missingFacts ?? []).length) {
        for (const factKey of output.missingFacts) {
          const hasEvidence = (output.evidence ?? []).some((e) => e.factKey === factKey);
          if (!hasEvidence) {
            gaps.push(buildKnowledgeGapRecord({
              brandKey: output.brandKey ?? brandKey,
              modelKey: tool.arguments?.modelKey ?? null,
              variantKey: tool.arguments?.variantKey ?? null,
              requestedFact: factKey,
              customerQuestionRedacted: customerMessage,
              internalDataStatus: 'missing',
              conversationTurnId,
            }));
          }
        }
      }
    }
  }

  return gaps;
}

export function listOpenKnowledgeGaps(gaps = []) {
  return gaps.filter((gap) => gap.status === KNOWLEDGE_GAP_STATUSES.NEW
    || gap.status === KNOWLEDGE_GAP_STATUSES.REVIEWED);
}

export function updateKnowledgeGapStatus(gaps = [], id, patch = {}) {
  return gaps.map((gap) => (gap.id === id ? { ...gap, ...patch } : gap));
}
