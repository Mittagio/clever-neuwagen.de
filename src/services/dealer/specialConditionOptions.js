/**
 * Phase 4 – Sonderkonditionen (Customer Journey).
 */

/** @typedef {'privat'|'gewerbe'|'schwerbehindert'|'corporateBenefits'|'oeffentlicherDienst'|'beamter'|'freiberufler'|'none'} SpecialConditionId */

/** @type {{ id: SpecialConditionId, label: string, hint?: string }[]} */
export const SPECIAL_CONDITION_OPTIONS = [
  { id: 'privat', label: 'Privatkunde' },
  { id: 'gewerbe', label: 'Gewerbekunde' },
  { id: 'schwerbehindert', label: 'Schwerbehinderung' },
  { id: 'corporateBenefits', label: 'Corporate Benefits' },
  { id: 'oeffentlicherDienst', label: 'Öffentlicher Dienst' },
  { id: 'beamter', label: 'Beamter' },
  { id: 'freiberufler', label: 'Selbstständig' },
];

const LABEL_BY_ID = Object.fromEntries(
  SPECIAL_CONDITION_OPTIONS.map((o) => [o.id, o.label]),
);

/**
 * @param {SpecialConditionId[]} current
 * @param {SpecialConditionId} id
 * @returns {SpecialConditionId[]}
 */
export function toggleSpecialCondition(current, id) {
  const set = new Set(current ?? []);

  if (id === 'none') {
    return set.has('none') ? [] : ['none'];
  }

  set.delete('none');
  if (set.has(id)) set.delete(id);
  else set.add(id);

  return [...set];
}

/** Einzelauswahl – Verkäufer-Journey */
export function selectSpecialCondition(_current, id) {
  if (!id) return [];
  return [id];
}

/**
 * @param {SpecialConditionId[]|null|undefined} ids
 */
export function getSpecialConditionLabels(ids) {
  if (!ids?.length) return [];
  if (ids.includes('none')) return ['Keine Sonderkondition'];
  if (ids.includes('privat')) return [LABEL_BY_ID.privat];
  return ids.map((id) => LABEL_BY_ID[id]).filter(Boolean);
}

/**
 * Primäre Rabattgruppe für spätere Preisberechnung (Phase 5).
 * @param {SpecialConditionId[]|null|undefined} ids
 */
export function resolvePrimaryDiscountGroup(ids) {
  if (!ids?.length || ids.includes('none') || ids.includes('privat')) return 'standard';

  const priority = [
    'schwerbehindert',
    'corporateBenefits',
    'oeffentlicherDienst',
    'beamter',
    'gewerbe',
    'freiberufler',
  ];

  return priority.find((id) => ids.includes(id)) ?? 'standard';
}

/**
 * @param {SpecialConditionId[]|null|undefined} ids
 */
export function hasSpecialConditions(ids) {
  return Boolean(ids?.length) && !ids.includes('none');
}
