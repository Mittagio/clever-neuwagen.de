/**
 * Modell nur bei klarer Nennung – sonst offene Markensuche
 */

/** @param {string} rawQuery */
export function isModelExplicitlyRequested(rawQuery, { brand, model } = {}) {
  if (!model) return false;
  const q = String(rawQuery ?? '').toLowerCase();
  const modelNorm = String(model).toLowerCase().replace(/\s+/g, ' ').trim();
  const patterns = [
    modelNorm,
    modelNorm.replace(/\s+/g, ''),
    modelNorm.replace(/\s+/g, '-'),
  ];
  if (brand) {
    const b = String(brand).toLowerCase();
    if (q.includes(`${b} ${modelNorm}`) || q.includes(`${b}-${modelNorm.replace(/\s+/g, '-')}`)) {
      return true;
    }
  }
  return patterns.some((p) => p.length >= 2 && q.includes(p));
}

export function shouldApplyModelFilter(filters) {
  return Boolean(filters.modelExplicit && filters.model);
}

export function shouldApplyBrandFilter(filters) {
  return Boolean(filters.modelExplicit && filters.brand);
}
