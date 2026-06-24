/**
 * Schlussraten pro Modell / Ausstattung / Laufzeit
 * financeResidualsByModel[modelId][trimId] = { 24: 60, 36: 55, 48: 50, 60: 45 }
 */

export const FINANCE_RESIDUAL_TERMS = [24, 36, 48, 60];

export const DEFAULT_RESIDUAL_PERCENT_BY_TERM = {
  24: 60,
  36: 55,
  48: 50,
  60: 45,
};

export const FINANCE_RESIDUAL_DEFAULT_TRIM_KEY = '_default';

export function formatFinanceResidualTermLabel(term) {
  return `${term} Monate`;
}

export function clampResidualPercentInput(raw) {
  if (raw === '' || raw == null) return null;
  const num = Number(String(raw).replace(',', '.'));
  if (!Number.isFinite(num)) return null;
  return Math.max(0, Math.min(100, Math.round(num * 10) / 10));
}

function resolveTrimKey(trimId) {
  return trimId ?? FINANCE_RESIDUAL_DEFAULT_TRIM_KEY;
}

function getTrimResidualBucket(conditions = {}, modelId = '', trimId = null) {
  const modelBucket = conditions?.financeResidualsByModel?.[modelId];
  if (!modelBucket || typeof modelBucket !== 'object') return null;

  const trimKey = resolveTrimKey(trimId);
  const trimBucket = modelBucket[trimKey];
  if (trimBucket && typeof trimBucket === 'object') {
    return trimBucket;
  }

  if (!trimId && !modelBucket[FINANCE_RESIDUAL_DEFAULT_TRIM_KEY]) {
    const hasTermKeys = FINANCE_RESIDUAL_TERMS.some((t) => modelBucket[t] != null);
    if (hasTermKeys) return modelBucket;
  }

  return null;
}

export function getFinanceResidualValue(conditions = {}, modelId = '', term, trimId = null) {
  const bucket = getTrimResidualBucket(conditions, modelId, trimId);
  const termKey = Number(term);
  if (bucket && bucket[termKey] != null) {
    const value = Number(bucket[termKey]);
    return Number.isFinite(value) ? value : null;
  }

  const legacy = conditions?.financeByModel?.[modelId]?.finalPaymentPercent ?? {};
  if (legacy[termKey] != null) {
    const value = Number(legacy[termKey]);
    return Number.isFinite(value) ? value : null;
  }

  return null;
}

export function getFinanceResidualsForTrim(conditions = {}, modelId = '', trimId = null) {
  const result = {};
  for (const term of FINANCE_RESIDUAL_TERMS) {
    const value = getFinanceResidualValue(conditions, modelId, term, trimId);
    if (value != null) result[term] = value;
  }
  return result;
}

export function resolveFinanceResidualSkippedMap(settings = {}, trimId = null) {
  if (!trimId) return settings.financeResidualsSkipped ?? {};
  return settings.trimConditions?.[trimId]?.financeResidualsSkipped
    ?? settings.financeResidualsSkipped
    ?? {};
}

export function getFinanceResidualStatus(
  conditions = {},
  modelId = '',
  term,
  skippedMap = {},
  trimId = null,
) {
  const termKey = Number(term);
  if (getFinanceResidualValue(conditions, modelId, termKey, trimId) != null) {
    return 'filled';
  }
  if (skippedMap[String(termKey)]) return 'skipped';
  return 'pending';
}

export function getFinanceResidualProgress(
  conditions = {},
  modelId = '',
  skippedMap = {},
  trimId = null,
) {
  let filled = 0;
  let skipped = 0;

  for (const term of FINANCE_RESIDUAL_TERMS) {
    const status = getFinanceResidualStatus(conditions, modelId, term, skippedMap, trimId);
    if (status === 'filled') filled += 1;
    else if (status === 'skipped') skipped += 1;
  }

  return {
    filled,
    skipped,
    total: FINANCE_RESIDUAL_TERMS.length,
    pending: FINANCE_RESIDUAL_TERMS.length - filled - skipped,
    isComplete: filled + skipped >= FINANCE_RESIDUAL_TERMS.length,
  };
}

export function getNextPendingResidualTerm(
  conditions = {},
  modelId = '',
  skippedMap = {},
  afterTerm = null,
  trimId = null,
) {
  const terms = [...FINANCE_RESIDUAL_TERMS];
  let startIdx = 0;

  if (afterTerm != null) {
    const idx = terms.indexOf(Number(afterTerm));
    startIdx = idx >= 0 ? idx + 1 : 0;
  }

  for (let pass = 0; pass < 2; pass += 1) {
    const from = pass === 0 ? startIdx : 0;
    const to = pass === 0 ? terms.length : startIdx;
    for (let i = from; i < to; i += 1) {
      const term = terms[i];
      if (getFinanceResidualStatus(conditions, modelId, term, skippedMap, trimId) === 'pending') {
        return term;
      }
    }
  }

  return null;
}

export function trimHasResidualData(conditions = {}, modelId, settings = {}, trimId) {
  const bucket = getTrimResidualBucket(conditions, modelId, trimId);
  if (bucket && FINANCE_RESIDUAL_TERMS.some((t) => bucket[t] != null)) return true;
  const skipped = settings.trimConditions?.[trimId]?.financeResidualsSkipped ?? {};
  return Object.keys(skipped).length > 0;
}

export function getTrimsWithResidualData(conditions = {}, modelId, settings = {}, trims = []) {
  return trims.filter((trim) => trimHasResidualData(conditions, modelId, settings, trim.id));
}

export function suggestResidualPercent(term) {
  return DEFAULT_RESIDUAL_PERCENT_BY_TERM[Number(term)] ?? null;
}

export function formatResidualSummaryLine(term, percent) {
  return `${formatFinanceResidualTermLabel(term)} → ${percent} %`;
}
