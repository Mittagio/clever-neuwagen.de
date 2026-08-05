/**
 * Vertragsende menschenlesbar: „Leasing endet im Juli 2026“ statt „2026-07“.
 */

const MONTH_NAMES_DE = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

/**
 * @param {string|null|undefined} endDate – ISO date, YYYY-MM or YYYY-MM-DD
 * @param {{ type?: string|null }} [options]
 * @returns {string|null}
 */
export function formatContractEndLabel(endDate, options = {}) {
  if (!endDate) return null;
  const raw = String(endDate).trim();
  const m = raw.match(/^(20\d{2})-(\d{2})(?:-(\d{2}))?$/);
  if (!m) return options.type === 'leasing' ? `Leasingende ${raw}` : `Vertragsende ${raw}`;
  const year = m[1];
  const monthIdx = Number(m[2]) - 1;
  const monthName = MONTH_NAMES_DE[monthIdx] || m[2];
  const kind = options.type === 'financing' ? 'Finanzierung' : 'Leasing';
  return `${kind} endet im ${monthName} ${year}`;
}
