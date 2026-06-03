import { getFeatureById, getFeatureLabel } from '../../data/features/featureCatalog.js';

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Feature-Text aus Suchanfrage entfernen */
export function removeFeatureFromQuery(query = '', featureId) {
  const feature = getFeatureById(featureId);
  if (!feature) return query;
  let q = query;
  const patterns = [feature.label, ...(feature.aliases ?? [])];
  for (const p of patterns) {
    if (!p) continue;
    q = q.replace(new RegExp(escapeRegExp(p), 'gi'), ' ');
  }
  return q.replace(/\s+/g, ' ').trim();
}

/**
 * Features-Array + Query synchron halten (URL-Parameter features)
 */
export function buildFeaturesFilterPatch(filters, nextFeatures = []) {
  const prev = filters.features ?? [];
  const next = [...new Set(nextFeatures.filter(Boolean))];
  let query = filters.query ?? '';

  for (const id of prev) {
    if (!next.includes(id)) query = removeFeatureFromQuery(query, id);
  }
  for (const id of next) {
    if (!prev.includes(id)) {
      const label = getFeatureLabel(id);
      if (label && !query.toLowerCase().includes(label.toLowerCase())) {
        query = `${query} ${label}`.trim();
      }
    }
  }

  return { features: next, query };
}
