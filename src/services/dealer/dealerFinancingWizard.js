/**
 * Finanzierungs-Assistent – 24 Kombinationen (4 Laufzeiten × 6 Anzahlungen)
 */

export const FINANCING_WIZARD_TERMS = [24, 36, 48, 60];

export const FINANCING_WIZARD_DOWN_PAYMENTS = [0, 1000, 2000, 3000, 5000, 10000];

export const FINANCING_DOWN_PRESET_LABELS = {
  0: '0 €',
  1000: '1.000 €',
  2000: '2.000 €',
  3000: '3.000 €',
  5000: '5.000 €',
  10000: '10.000 €',
};

export function buildFinancingWizardCombos() {
  const combos = [];
  for (const term of FINANCING_WIZARD_TERMS) {
    for (const downPayment of FINANCING_WIZARD_DOWN_PAYMENTS) {
      combos.push({ term, downPayment });
    }
  }
  return combos;
}

export function financeComboKey(term, downPayment) {
  return `${term}-${downPayment}`;
}

export function parseFinanceComboKey(key = '') {
  const [term, downPayment] = String(key).split('-').map(Number);
  if (!term || Number.isNaN(downPayment)) return null;
  return { term, downPayment };
}

function getTrimFinanceBucket(conditions = {}, modelId = '', trimId = null) {
  const store = conditions?.financeConditionsByModel?.[modelId] ?? {};
  if (trimId && store[trimId] && typeof store[trimId] === 'object') {
    return store[trimId];
  }
  return null;
}

export function getFinanceConditionValue(conditions = {}, modelId = '', term, downPayment, trimId = null) {
  const trimBucket = getTrimFinanceBucket(conditions, modelId, trimId);
  const raw = trimBucket?.[term]?.[downPayment];
  if (raw && typeof raw === 'object') {
    return normalizeFinanceCondition(raw);
  }

  if (!trimId) {
    const legacy = conditions?.financeByModel?.[modelId] ?? {};
    if (legacy.interestRate != null) {
      return normalizeFinanceCondition({
        effectiveRate: legacy.interestRate,
        nominalRate: legacy.nominalRate ?? null,
        finalPaymentPercent: legacy.finalPaymentPercent?.[term] ?? null,
        finalPaymentEuro: legacy.finalPaymentEuro?.[term] ?? null,
      });
    }
  }

  return null;
}

export function normalizeFinanceCondition(raw = {}) {
  const effectiveRate = raw.effectiveRate != null && raw.effectiveRate !== ''
    ? Number(raw.effectiveRate)
    : null;
  const nominalRate = raw.nominalRate != null && raw.nominalRate !== ''
    ? Number(raw.nominalRate)
    : null;
  const finalPaymentEuro = raw.finalPaymentEuro != null && raw.finalPaymentEuro !== ''
    ? Number(raw.finalPaymentEuro)
    : null;
  const finalPaymentPercent = raw.finalPaymentPercent != null && raw.finalPaymentPercent !== ''
    ? Number(raw.finalPaymentPercent)
    : null;

  return {
    effectiveRate: Number.isFinite(effectiveRate) ? effectiveRate : null,
    nominalRate: Number.isFinite(nominalRate) ? nominalRate : null,
    finalPaymentEuro: Number.isFinite(finalPaymentEuro) ? finalPaymentEuro : null,
    finalPaymentPercent: Number.isFinite(finalPaymentPercent) ? finalPaymentPercent : null,
  };
}

export function isFinanceConditionComplete(condition = {}) {
  if (condition.effectiveRate == null) return false;
  return condition.finalPaymentEuro != null || condition.finalPaymentPercent != null;
}

export function resolveFinanceSkippedMap(settings = {}, trimId = null) {
  if (!trimId) return settings.financeWizardSkipped ?? {};
  return settings.trimConditions?.[trimId]?.financeWizardSkipped
    ?? settings.financeWizardSkipped
    ?? {};
}

export function getFinanceComboStatus(
  conditions = {},
  modelId = '',
  term,
  downPayment,
  skippedMap = {},
  trimId = null,
) {
  const key = financeComboKey(term, downPayment);
  const value = getFinanceConditionValue(conditions, modelId, term, downPayment, trimId);
  if (isFinanceConditionComplete(value)) return 'filled';
  if (skippedMap[key]) return 'skipped';
  return 'pending';
}

export function getFinancingWizardProgress(
  conditions = {},
  modelId = '',
  skippedMap = {},
  trimId = null,
) {
  const combos = buildFinancingWizardCombos();
  let filled = 0;
  let skipped = 0;

  for (const { term, downPayment } of combos) {
    const status = getFinanceComboStatus(
      conditions,
      modelId,
      term,
      downPayment,
      skippedMap,
      trimId,
    );
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

export function getNextPendingFinanceCombo(
  conditions = {},
  modelId = '',
  skippedMap = {},
  after = null,
  trimId = null,
) {
  const combos = buildFinancingWizardCombos();
  let startIdx = 0;

  if (after) {
    const idx = combos.findIndex(
      (c) => c.term === after.term && c.downPayment === after.downPayment,
    );
    startIdx = idx >= 0 ? idx + 1 : 0;
  }

  for (let pass = 0; pass < 2; pass += 1) {
    const from = pass === 0 ? startIdx : 0;
    const to = pass === 0 ? combos.length : startIdx;
    for (let i = from; i < to; i += 1) {
      const combo = combos[i];
      if (getFinanceComboStatus(
        conditions,
        modelId,
        combo.term,
        combo.downPayment,
        skippedMap,
        trimId,
      ) === 'pending') {
        return combo;
      }
    }
  }

  return null;
}

export function formatFinanceTermLabel(term) {
  return `${term} Monate`;
}

export function formatFinanceDownPaymentLabel(downPayment) {
  if (FINANCING_DOWN_PRESET_LABELS[downPayment]) {
    return FINANCING_DOWN_PRESET_LABELS[downPayment];
  }
  return `${Number(downPayment).toLocaleString('de-DE')} €`;
}

export function clampRateInput(value, max = 20) {
  if (value === '' || value == null) return null;
  const n = Number(String(value).replace(',', '.'));
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(max, Math.round(n * 100) / 100));
}

export function clampEuroInput(value) {
  if (value === '' || value == null) return null;
  const n = Number(String(value).replace(',', '.'));
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.round(n));
}

export function clampPercentInput(value) {
  if (value === '' || value == null) return null;
  const n = Number(String(value).replace(',', '.'));
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, Math.round(n * 10) / 10));
}

export function calcFinanceMonthlyRate(
  housePrice = 0,
  downPayment = 0,
  termMonths = 48,
  condition = {},
) {
  const normalized = normalizeFinanceCondition(condition);
  if (normalized.effectiveRate == null || !termMonths || !housePrice) return null;

  const finalPayment = normalized.finalPaymentEuro != null
    ? normalized.finalPaymentEuro
    : (normalized.finalPaymentPercent != null
      ? Math.round(housePrice * (normalized.finalPaymentPercent / 100))
      : null);

  if (finalPayment == null) return null;

  const financedAmount = Math.max(0, housePrice - downPayment - finalPayment);
  const monthlyPrincipal = financedAmount / termMonths;
  const monthlyInterest = (housePrice * normalized.effectiveRate) / 100 / 12;
  return Math.max(0, Math.round(monthlyPrincipal + monthlyInterest));
}

export function formatFinanceSummaryValue(condition = {}, housePrice = 0) {
  const normalized = normalizeFinanceCondition(condition);
  if (!isFinanceConditionComplete(normalized)) return 'noch nicht gepflegt';

  const parts = [`${normalized.effectiveRate} % eff.`];
  if (normalized.nominalRate != null) {
    parts.push(`${normalized.nominalRate} % Soll`);
  }
  if (normalized.finalPaymentEuro != null) {
    parts.push(`Schluss ${normalized.finalPaymentEuro.toLocaleString('de-DE')} €`);
  } else if (normalized.finalPaymentPercent != null) {
    const euro = Math.round(housePrice * (normalized.finalPaymentPercent / 100));
    parts.push(`Schluss ${normalized.finalPaymentPercent} % (${euro.toLocaleString('de-DE')} €)`);
  }
  return parts.join(' · ');
}
