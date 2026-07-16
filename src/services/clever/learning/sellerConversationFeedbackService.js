/**
 * Verkäuferfeedback zu Clever-Antworten – keine automatische Prompt-Änderung.
 */
import { redactPersonalData } from '../knowledge/redactVehicleQuery.js';

export const SELLER_FEEDBACK_CATEGORIES = {
  GOOD: 'good',
  WRONG_VEHICLE_FACT: 'wrong_vehicle_fact',
  UNNECESSARY_QUESTION: 'unnecessary_question',
  MISSED_CUSTOMER_NEED: 'missed_customer_need',
  UNNATURAL_SELLER_LANGUAGE: 'unnatural_seller_language',
  OTHER: 'other',
};

export const SELLER_FEEDBACK_STATUSES = {
  NEW: 'new',
  REVIEWED: 'reviewed',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
};

function uid() {
  return `sfb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * @param {object} params
 */
export function buildSellerFeedbackRecord(params = {}) {
  const now = new Date().toISOString();
  return {
    id: params.id ?? uid(),
    conversationId: params.conversationId ?? null,
    turnId: params.turnId ?? null,
    category: params.category ?? SELLER_FEEDBACK_CATEGORIES.OTHER,
    sellerCorrection: params.sellerCorrection ?? null,
    originalCustomerMessage: redactPersonalData(params.originalCustomerMessage ?? ''),
    originalCleverReply: params.originalCleverReply ?? null,
    originalNextAction: params.originalNextAction ?? null,
    customerUnderstandingSnapshot: params.customerUnderstandingSnapshot ?? null,
    model: params.model ?? null,
    promptVersion: params.promptVersion ?? null,
    evidenceIds: params.evidenceIds ?? [],
    createdAt: params.createdAt ?? now,
    status: params.status ?? SELLER_FEEDBACK_STATUSES.NEW,
    reviewerNote: params.reviewerNote ?? null,
  };
}

export function listNewSellerFeedback(items = []) {
  return items.filter((item) => item.status === SELLER_FEEDBACK_STATUSES.NEW);
}

export function updateSellerFeedbackStatus(items = [], id, patch = {}) {
  return items.map((item) => (item.id === id ? { ...item, ...patch } : item));
}
