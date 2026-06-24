/**
 * Leasingfaktor-Assistent – 24 Kombinationen (4 Laufzeiten × 6 km-Stufen)
 */

export const LEASING_WIZARD_TERMS = [24, 36, 48, 60];

export const LEASING_WIZARD_MILEAGES = [5000, 7500, 10000, 15000, 20000, 30000];

export function buildLeasingWizardCombos() {
  const combos = [];
  for (const term of LEASING_WIZARD_TERMS) {
    for (const km of LEASING_WIZARD_MILEAGES) {
      combos.push({ term, km });
    }
  }
  return combos;
}

export function comboKey(term, km) {
  return `${term}-${km}`;
}

export function parseComboKey(key = '') {
  const [term, km] = String(key).split('-').map(Number);
  if (!term || !km) return null;
  return { term, km };
}

function isLegacyLeasingModelFactors(modelFactors = {}) {
  return LEASING_WIZARD_TERMS.some((term) => Object.prototype.hasOwnProperty.call(modelFactors, term));
}

export function getLeasingFactorValue(conditions, modelId, term, km, trimId = null) {
  const modelFactors = conditions?.leasingFactorsByModel?.[modelId] ?? {};

  if (trimId && !isLegacyLeasingModelFactors(modelFactors)) {
    const rawTrim = modelFactors[trimId]?.[term]?.[km];
    if (rawTrim != null && rawTrim !== '') {
      const nTrim = Number(rawTrim);
      if (Number.isFinite(nTrim)) return nTrim;
    }
  }

  const raw = modelFactors[term]?.[km];
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function resolveSkippedMap(settings = {}, trimId = null) {
  if (!trimId) return settings.leasingFactorSkipped ?? {};
  return settings.trimConditions?.[trimId]?.leasingFactorSkipped
    ?? settings.leasingFactorSkipped
    ?? {};
}

export function getComboStatus(conditions, modelId, term, km, skippedMap = {}, trimId = null) {
  const key = comboKey(term, km);
  const value = getLeasingFactorValue(conditions, modelId, term, km, trimId);
  if (value != null) return 'filled';
  if (skippedMap[key]) return 'skipped';
  return 'pending';
}

export function getLeasingWizardProgress(conditions, modelId, skippedMap = {}, trimId = null) {
  const combos = buildLeasingWizardCombos();
  let filled = 0;
  let skipped = 0;

  for (const { term, km } of combos) {
    const status = getComboStatus(conditions, modelId, term, km, skippedMap, trimId);
    if (status === 'filled') filled += 1;
    else if (status === 'skipped') skipped += 1;
  }

  return {
    filled,
    skipped,
    total: combos.length,
    pending: combos.length - filled - skipped,
    isComplete: filled + skipped >= combos.length,
  };
}

export function getNextPendingCombo(conditions, modelId, skippedMap = {}, after = null, trimId = null) {
  const combos = buildLeasingWizardCombos();
  let startIdx = 0;

  if (after) {
    const idx = combos.findIndex((c) => c.term === after.term && c.km === after.km);
    startIdx = idx >= 0 ? idx + 1 : 0;
  }

  for (let pass = 0; pass < 2; pass += 1) {
    const from = pass === 0 ? startIdx : 0;
    const to = pass === 0 ? combos.length : startIdx;
    for (let i = from; i < to; i += 1) {
      const combo = combos[i];
      if (getComboStatus(conditions, modelId, combo.term, combo.km, skippedMap, trimId) === 'pending') {
        return combo;
      }
    }
  }

  return null;
}

export function formatWizardKmLabel(km) {
  return `${Number(km).toLocaleString('de-DE')} km/Jahr`;
}

export function formatWizardTermLabel(term) {
  return `${term} Monate`;
}

export function clampLeasingFactorInput(value) {
  if (value === '' || value == null) return null;
  const n = Number(String(value).replace(',', '.'));
  if (!Number.isFinite(n)) return null;
  return Math.max(0.01, Math.min(2, Math.round(n * 100) / 100));
}
