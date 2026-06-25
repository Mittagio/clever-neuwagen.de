/**
 * Clever Wissen – Verkäuferantworten mit Freigabe-Workflow.
 */
import { normalizeEquipmentQuery } from '../configuration/equipmentQueryUtils.js';
import {
  LEARNING_REQUEST_STATUSES,
  updateLearningRequestStatus,
} from './cleverLearningRequestService.js';

export const CLEVER_KNOWLEDGE_STORAGE_KEY = 'clever-knowledge-answers';

export const KNOWLEDGE_ANSWER_STATUS = {
  DRAFT: 'draft',
  PENDING_REVIEW: 'pending_review',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  ARCHIVED: 'archived',
};

export const KNOWLEDGE_CONFIDENCE = {
  SELLER_ANSWERED: 'seller_answered',
  ADMIN_VERIFIED: 'admin_verified',
  MANUFACTURER_VERIFIED: 'manufacturer_verified',
};

/** @type {object[] | null} */
let memoryStore = null;

function uid() {
  return `cka-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function readLocalStorage() {
  if (typeof window === 'undefined') return memoryStore ? [...memoryStore] : [];
  try {
    const raw = window.localStorage.getItem(CLEVER_KNOWLEDGE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function readAll() {
  if (memoryStore) return [...memoryStore];
  return readLocalStorage();
}

function writeAll(items) {
  const next = [...items];
  if (typeof window === 'undefined') {
    memoryStore = next;
    return;
  }
  try {
    window.localStorage.setItem(CLEVER_KNOWLEDGE_STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent('clever-knowledge-answers-changed'));
  } catch {
    memoryStore = next;
  }
}

/** Nur für Tests. */
export function resetCleverKnowledgeStore() {
  memoryStore = [];
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(CLEVER_KNOWLEDGE_STORAGE_KEY);
    } catch {
      // ignore
    }
  }
}

function queryNorm(text) {
  const value = String(text ?? '');
  const result = normalizeEquipmentQuery(value);
  if (typeof result === 'string') return result;
  return result?.normalized ?? value.toLowerCase().trim();
}

function scoreMatch(queryA, queryB) {
  const a = queryNorm(queryA);
  const b = queryNorm(queryB);
  if (!a || !b) return 0;
  if (a === b) return 100;
  if (a.includes(b) || b.includes(a)) return 85;
  const aTokens = a.split(/\s+/).filter(Boolean);
  const bTokens = b.split(/\s+/).filter(Boolean);
  const overlap = aTokens.filter((token) => bTokens.includes(token)).length;
  if (!overlap) return 0;
  return Math.round((overlap / Math.max(aTokens.length, bTokens.length)) * 80);
}

/**
 * @param {object} input
 */
export function createCleverKnowledgeAnswer(input = {}) {
  const questionText = String(input.questionText ?? '').trim();
  const answerText = String(input.answerText ?? '').trim();
  if (!questionText || !answerText) {
    return { ok: false, answer: null, message: 'Frage und Antwort werden benötigt.' };
  }

  const now = new Date().toISOString();
  const answer = {
    id: uid(),
    createdAt: now,
    updatedAt: now,
    questionText,
    normalizedQuestion: queryNorm(questionText),
    answerText,
    modelKey: input.modelKey ?? null,
    modelLabel: input.modelLabel ?? null,
    brand: input.brand ?? 'Kia',
    category: input.category ?? 'Sonstiges',
    sourceArea: input.sourceArea ?? 'customer_advisor',
    dealerId: input.dealerId ?? null,
    dealerName: input.dealerName ?? null,
    answeredByUserId: input.answeredByUserId ?? null,
    answeredByUserName: input.answeredByUserName ?? null,
    confidence: input.confidence ?? KNOWLEDGE_CONFIDENCE.SELLER_ANSWERED,
    status: input.status ?? KNOWLEDGE_ANSWER_STATUS.PENDING_REVIEW,
    sourceNote: input.sourceNote ?? null,
    relatedFeatureIds: input.relatedFeatureIds ?? [],
    relatedPackageIds: input.relatedPackageIds ?? [],
    originalLearningRequestId: input.originalLearningRequestId ?? null,
    leadId: input.leadId ?? null,
  };

  writeAll([answer, ...readAll()]);

  if (answer.originalLearningRequestId) {
    updateLearningRequestStatus(
      answer.originalLearningRequestId,
      LEARNING_REQUEST_STATUSES.IN_REVIEW,
      { linkedKnowledgeAnswerId: answer.id },
    );
  }

  return { ok: true, answer, message: 'Antwort gespeichert – Clever kann daraus lernen.' };
}

/**
 * @param {{ status?: string, modelKey?: string, dealerId?: string }} [filter]
 */
export function listCleverKnowledgeAnswers(filter = {}) {
  let items = readAll();
  if (filter.status) items = items.filter((item) => item.status === filter.status);
  if (filter.modelKey) items = items.filter((item) => item.modelKey === filter.modelKey);
  if (filter.dealerId) items = items.filter((item) => item.dealerId === filter.dealerId);
  return items.sort(
    (a, b) => new Date(b.updatedAt ?? b.createdAt) - new Date(a.updatedAt ?? a.createdAt),
  );
}

export function getCleverKnowledgeAnswerById(id) {
  return readAll().find((item) => item.id === id) ?? null;
}

function findBestKnowledgeMatch(query, modelKey, { status } = {}) {
  const normalized = queryNorm(query);
  if (!normalized) return null;

  let best = null;
  let bestScore = 0;

  for (const item of readAll()) {
    if (status && item.status !== status) continue;
    if (modelKey && item.modelKey && item.modelKey !== modelKey) continue;
    const score = scoreMatch(normalized, item.normalizedQuestion ?? item.questionText);
    if (score > bestScore && score >= 55) {
      bestScore = score;
      best = { ...item, matchScore: score };
    }
  }

  return best;
}

export function findApprovedKnowledgeAnswer(query, modelKey = null) {
  return findBestKnowledgeMatch(query, modelKey, {
    status: KNOWLEDGE_ANSWER_STATUS.APPROVED,
  });
}

export function findPendingKnowledgeAnswer(query, modelKey = null) {
  return findBestKnowledgeMatch(query, modelKey, {
    status: KNOWLEDGE_ANSWER_STATUS.PENDING_REVIEW,
  });
}

export function approveCleverKnowledgeAnswer(id, extra = {}) {
  const items = readAll();
  const target = items.find((item) => item.id === id);
  if (!target) return null;

  const now = new Date().toISOString();
  const next = items.map((item) => (
    item.id === id
      ? {
        ...item,
        ...extra,
        status: KNOWLEDGE_ANSWER_STATUS.APPROVED,
        confidence: extra.confidence ?? KNOWLEDGE_CONFIDENCE.ADMIN_VERIFIED,
        updatedAt: now,
        approvedAt: now,
      }
      : item
  ));
  writeAll(next);

  if (target.originalLearningRequestId) {
    updateLearningRequestStatus(
      target.originalLearningRequestId,
      LEARNING_REQUEST_STATUSES.RESOLVED,
      { resolvedByKnowledgeAnswerId: id },
    );
  }

  return next.find((item) => item.id === id) ?? null;
}

export function rejectCleverKnowledgeAnswer(id, extra = {}) {
  const items = readAll();
  const next = items.map((item) => (
    item.id === id
      ? {
        ...item,
        ...extra,
        status: KNOWLEDGE_ANSWER_STATUS.REJECTED,
        updatedAt: new Date().toISOString(),
      }
      : item
  ));
  writeAll(next);
  return next.find((item) => item.id === id) ?? null;
}

export function updateCleverKnowledgeAnswer(id, patch = {}) {
  const items = readAll();
  const next = items.map((item) => (
    item.id === id
      ? { ...item, ...patch, updatedAt: new Date().toISOString() }
      : item
  ));
  writeAll(next);
  return next.find((item) => item.id === id) ?? null;
}

/**
 * Verkäufer speichert Antwort aus Kundenakte.
 */
export function saveSellerKnowledgeAnswerFromLead({
  lead,
  answerText,
  sourceNote = '',
  learnForClever = true,
  userId = null,
  userName = null,
} = {}) {
  const special = lead?.specialCustomerQuestion;
  if (!special?.rawText) {
    return { ok: false, message: 'Keine Kundenfrage vorhanden.' };
  }

  const result = createCleverKnowledgeAnswer({
    questionText: special.rawText,
    answerText,
    modelKey: special.modelKey ?? lead?.customerWish?.modelKey ?? null,
    modelLabel: special.modelLabel ?? lead?.vehicle?.label ?? null,
    brand: lead?.vehicle?.brand ?? 'Kia',
    category: special.category ?? 'Sonstiges',
    sourceArea: 'customer_advisor',
    dealerId: lead?.dealerId ?? null,
    answeredByUserId: userId,
    answeredByUserName: userName,
    sourceNote: sourceNote || null,
    originalLearningRequestId: special.learningRequestId ?? null,
    leadId: lead?.id ?? null,
    status: learnForClever
      ? KNOWLEDGE_ANSWER_STATUS.PENDING_REVIEW
      : KNOWLEDGE_ANSWER_STATUS.DRAFT,
    confidence: KNOWLEDGE_CONFIDENCE.SELLER_ANSWERED,
  });

  return result;
}
