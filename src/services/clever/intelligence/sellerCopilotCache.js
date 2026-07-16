/**
 * Cache für Seller-Copilot-Zusammenfassungen (Snapshot-basiert).
 */

/** @type {Map<string, { snapshotId: string, value: object, createdAt: string }>} */
const cache = new Map();

/**
 * @param {object} customerUnderstanding
 * @param {object} [sellerInsights]
 */
export function buildCustomerUnderstandingSnapshotId(customerUnderstanding = {}, sellerInsights = null) {
  const labels = customerUnderstanding?.verstaendnis?.labels
    ?? customerUnderstanding?.labels
    ?? [];
  const summary = customerUnderstanding?.gespraechseinstieg
    ?? customerUnderstanding?.summary
    ?? '';
  const open = customerUnderstanding?.verstaendnis?.openPoints
    ?? customerUnderstanding?.openPoints
    ?? [];
  const insightCount = Array.isArray(sellerInsights)
    ? sellerInsights.length
    : (sellerInsights?.length ?? 0);
  const raw = JSON.stringify({ labels, summary, open, insightCount });
  let hash = 0;
  for (let i = 0; i < raw.length; i += 1) {
    hash = ((hash << 5) - hash) + raw.charCodeAt(i);
    hash |= 0;
  }
  return `cu-${Math.abs(hash)}`;
}

export function getSellerCopilotCache(leadId, snapshotId) {
  if (!leadId) return null;
  const entry = cache.get(String(leadId));
  if (!entry) return null;
  if (entry.snapshotId !== snapshotId) return null;
  return entry.value;
}

export function setSellerCopilotCache(leadId, snapshotId, value) {
  if (!leadId) return;
  cache.set(String(leadId), {
    snapshotId,
    value,
    createdAt: new Date().toISOString(),
  });
}

export function markSellerCopilotStale(leadId) {
  if (!leadId) return;
  cache.delete(String(leadId));
}

/** Nur für Tests. */
export function clearSellerCopilotCache() {
  cache.clear();
}
