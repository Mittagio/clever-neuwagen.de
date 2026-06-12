/**
 * Sanfte Konflikt-Hinweise pro Wunsch-Chip – kein harter Filter.
 */
import { findDealerWishChip } from '../../data/dealer/dealerWishCatalog.js';
import { getFeatureLabel } from '../../data/features/featureCatalog.js';
import { getModelTrims, normalizeModelKey } from '../../data/features/trimFeatureMapping.js';

function wishStatus(trim, featureId) {
  if (trim.standardFeatures?.includes(featureId)) return 'standard';
  if (trim.availableViaPackage?.includes(featureId)) return 'package';
  if (trim.notAvailable?.includes(featureId)) return 'unavailable';
  return 'unknown';
}

function resolveTrims(modelKey) {
  const key = normalizeModelKey('Kia', modelKey);
  return getModelTrims(key);
}

function availabilityHint(chip, trims) {
  if (!trims.length || !chip.features?.length) return null;

  const statuses = chip.features.map((featureId) => {
    const perTrim = trims.map((trim) => wishStatus(trim, featureId));
    if (perTrim.every((s) => s === 'unavailable')) return 'unavailable';
    if (perTrim.every((s) => s === 'standard' || s === 'package')) {
      return perTrim.some((s) => s === 'standard') ? 'standard' : 'package';
    }
    return 'mixed';
  });

  if (statuses.every((s) => s === 'unavailable')) {
    const label = chip.features.map((f) => getFeatureLabel(f)).filter(Boolean).join(', ') || chip.label;
    return {
      severity: 'warning',
      message: `${label} ist bei diesem Modell nicht verfügbar – Ihr Händler findet eine Alternative.`,
    };
  }

  if (statuses.every((s) => s === 'package')) {
    return {
      severity: 'info',
      message: `${chip.label} ist meist nur als Paket erhältlich – wir berücksichtigen das in der Empfehlung.`,
    };
  }

  return null;
}

const COMBO_RULES = [
  {
    chipId: 'tow_capacity_2000',
    test: (selected) => selected.includes('tow_capacity_2000') && !selected.includes('towbar'),
    message: 'Für hohe Anhängelast brauchen Sie in der Regel auch eine Anhängerkupplung.',
    severity: 'info',
  },
  {
    chipId: 'tow_1500',
    test: (selected) => selected.includes('tow_1500') && !selected.includes('towbar'),
    message: 'Anhängelast setzt eine Anhängerkupplung voraus.',
    severity: 'info',
  },
];

/**
 * @param {string} modelKey
 * @param {string[]} selectedChipIds
 * @returns {Record<string, { message: string, severity: 'info'|'warning' }>}
 */
export function resolveWishChipConflictHints(modelKey, selectedChipIds = []) {
  if (!modelKey || !selectedChipIds.length) return {};

  const trims = resolveTrims(modelKey);
  const selected = [...selectedChipIds];
  /** @type {Record<string, { message: string, severity: 'info'|'warning' }>} */
  const hints = {};

  for (const chipId of selected) {
    const chip = findDealerWishChip(chipId);
    if (!chip) continue;
    const hint = availabilityHint(chip, trims);
    if (hint) hints[chipId] = hint;
  }

  for (const rule of COMBO_RULES) {
    if (rule.test(selected) && selected.includes(rule.chipId) && !hints[rule.chipId]) {
      hints[rule.chipId] = { message: rule.message, severity: rule.severity };
    }
  }

  return hints;
}
