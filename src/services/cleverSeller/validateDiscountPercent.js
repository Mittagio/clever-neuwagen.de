/**
 * Rabatt-%-Validierung: nur 0–100 sind übernahmefähig.
 * Ungültige Werte (z. B. 449) werden nicht als Rabatt interpretiert.
 */

export const INVALID_DISCOUNT_WARNING = 'Der erkannte Rabattwert ist ungültig und wurde nicht übernommen.';

/**
 * @param {unknown} raw
 * @returns {{
 *   ok: boolean,
 *   value: number|null,
 *   conflict: boolean,
 *   warning: string|null,
 * }}
 */
export function validateDiscountPercent(raw) {
  if (raw == null || raw === '') {
    return { ok: false, value: null, conflict: false, warning: null };
  }
  const n = typeof raw === 'number' ? raw : Number(String(raw).replace(',', '.').replace(/%/g, '').trim());
  if (!Number.isFinite(n)) {
    return { ok: false, value: null, conflict: true, warning: INVALID_DISCOUNT_WARNING };
  }
  if (n < 0 || n > 100) {
    return { ok: false, value: null, conflict: true, warning: INVALID_DISCOUNT_WARNING };
  }
  return { ok: true, value: n, conflict: false, warning: null };
}

/**
 * Entfernt ungültige discountPercent-Facts und liefert Warnungen.
 * @param {object[]} facts
 * @returns {{ facts: object[], warnings: string[] }}
 */
export function filterInvalidDiscountFacts(facts = []) {
  const warnings = [];
  const next = [];
  for (const fact of facts) {
    if (fact?.field !== 'discountPercent') {
      next.push(fact);
      continue;
    }
    const checked = validateDiscountPercent(fact.value);
    if (checked.ok) {
      next.push({
        ...fact,
        value: checked.value,
        label: fact.label && /%/i.test(fact.label)
          ? fact.label
          : `${checked.value} % Rabatt`,
      });
      continue;
    }
    if (checked.warning && !warnings.includes(checked.warning)) {
      warnings.push(checked.warning);
    }
  }
  return { facts: next, warnings };
}
