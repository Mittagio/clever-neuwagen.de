/**
 * Ausstattungslinien (Trim-Level) für Konditionen – Lesen, Schreiben, Kopieren
 */
import { getModelTrims, normalizeModelKey } from '../../data/features/trimFeatureMapping.js';
import { LEASING_WIZARD_TERMS } from './dealerLeasingWizard.js';

export const TRIM_SCOPE_ALL = '__all__';

export function resolveModelKeyFromDealerModel(model = {}) {
  return normalizeModelKey(model.brand ?? 'Kia', model.id ?? model.model ?? '');
}

export function getModelTrimLines(model = {}) {
  const modelKey = resolveModelKeyFromDealerModel(model);
  return getModelTrims(modelKey).map((trim) => ({
    id: trim.id,
    name: trim.name ?? trim.id,
  }));
}

export function formatTrimScopeLabel(scope, trims = []) {
  if (!scope || scope.mode === 'all') return 'Alle Ausstattungen';
  const match = trims.find((t) => t.id === scope.trimId);
  return match?.name ?? scope.trimId ?? 'Ausstattung';
}

export function isLegacyLeasingModelFactors(modelFactors = {}) {
  return LEASING_WIZARD_TERMS.some((term) => Object.prototype.hasOwnProperty.call(modelFactors, term));
}

export function resolveTrimSettings(settings = {}, trimId = null) {
  if (!trimId) {
    return {
      paymentDiscounts: { ...(settings.paymentDiscounts ?? {}) },
      bonusAmount: settings.bonusAmount ?? null,
      leasingFactorSkipped: { ...(settings.leasingFactorSkipped ?? {}) },
    };
  }

  const trimSpecific = settings.trimConditions?.[trimId] ?? {};
  return {
    paymentDiscounts: {
      ...(settings.paymentDiscounts ?? {}),
      ...(trimSpecific.paymentDiscounts ?? {}),
    },
    bonusAmount: trimSpecific.bonusAmount ?? settings.bonusAmount ?? null,
    leasingFactorSkipped: {
      ...(settings.leasingFactorSkipped ?? {}),
      ...(trimSpecific.leasingFactorSkipped ?? {}),
    },
    financeWizardSkipped: {
      ...(settings.financeWizardSkipped ?? {}),
      ...(trimSpecific.financeWizardSkipped ?? {}),
    },
  };
}

export function buildTrimConditionsPatch(settings = {}, trimId, partial = {}) {
  const current = resolveTrimSettings(settings, trimId);
  const next = {
    paymentDiscounts: {
      ...current.paymentDiscounts,
      ...(partial.paymentDiscounts ?? {}),
    },
    bonusAmount: partial.bonusAmount !== undefined
      ? partial.bonusAmount
      : current.bonusAmount,
    leasingFactorSkipped: partial.leasingFactorSkipped
      ? { ...current.leasingFactorSkipped, ...partial.leasingFactorSkipped }
      : current.leasingFactorSkipped,
    financeWizardSkipped: partial.financeWizardSkipped
      ? { ...current.financeWizardSkipped, ...partial.financeWizardSkipped }
      : current.financeWizardSkipped,
  };

  return {
    trimConditions: {
      ...(settings.trimConditions ?? {}),
      [trimId]: next,
    },
  };
}

export function buildTrimConditionsPatchForAll(settings = {}, trimIds = [], partial = {}) {
  const trimConditions = { ...(settings.trimConditions ?? {}) };
  for (const trimId of trimIds) {
    const current = resolveTrimSettings(settings, trimId);
    trimConditions[trimId] = {
      paymentDiscounts: {
        ...current.paymentDiscounts,
        ...(partial.paymentDiscounts ?? {}),
      },
      bonusAmount: partial.bonusAmount !== undefined
        ? partial.bonusAmount
        : current.bonusAmount,
      leasingFactorSkipped: partial.leasingFactorSkipped
        ? { ...current.leasingFactorSkipped, ...partial.leasingFactorSkipped }
        : current.leasingFactorSkipped,
      financeWizardSkipped: partial.financeWizardSkipped
        ? { ...current.financeWizardSkipped, ...partial.financeWizardSkipped }
        : current.financeWizardSkipped,
    };
  }
  return { trimConditions };
}

export function copyTrimSettingsPatch(settings = {}, sourceTrimId, targetTrimId) {
  const source = resolveTrimSettings(settings, sourceTrimId);
  return buildTrimConditionsPatch(settings, targetTrimId, {
    paymentDiscounts: { ...source.paymentDiscounts },
    bonusAmount: source.bonusAmount,
    leasingFactorSkipped: { ...source.leasingFactorSkipped },
    financeWizardSkipped: { ...source.financeWizardSkipped },
  });
}

export function trimHasPaymentData(settings = {}, trimId, paymentType) {
  const trimSpecific = settings.trimConditions?.[trimId];
  if (!trimSpecific) return false;
  if (trimSpecific.paymentDiscounts?.[paymentType] != null) return true;
  if (trimSpecific.bonusAmount != null) return true;
  return false;
}

export function trimHasFinanceData(conditions = {}, modelId, settings = {}, trimId) {
  const bucket = conditions?.financeConditionsByModel?.[modelId]?.[trimId];
  if (bucket && Object.keys(bucket).length > 0) return true;
  const skipped = settings.trimConditions?.[trimId]?.financeWizardSkipped ?? {};
  if (Object.keys(skipped).length > 0) return true;
  return trimHasPaymentData(settings, trimId, 'financing');
}

export function getTrimsWithFinanceData(conditions = {}, modelId, settings = {}, trims = []) {
  return trims.filter((trim) => trimHasFinanceData(conditions, modelId, settings, trim.id));
}

export function trimHasLeasingData(conditions = {}, modelId, settings = {}, trimId) {
  const modelFactors = conditions?.leasingFactorsByModel?.[modelId] ?? {};
  if (!isLegacyLeasingModelFactors(modelFactors) && modelFactors[trimId]) {
    return Object.keys(modelFactors[trimId]).length > 0;
  }
  const skipped = settings.trimConditions?.[trimId]?.leasingFactorSkipped ?? {};
  if (Object.keys(skipped).length > 0) return true;
  return trimHasPaymentData(settings, trimId, 'leasing');
}

export function getTrimsWithPaymentData(settings = {}, paymentType, trims = []) {
  return trims.filter((trim) => trimHasPaymentData(settings, trim.id, paymentType));
}

export function getTrimsWithLeasingData(conditions = {}, modelId, settings = {}, trims = []) {
  return trims.filter((trim) => trimHasLeasingData(conditions, modelId, settings, trim.id));
}

export function createTrimScope(trimId) {
  if (trimId === TRIM_SCOPE_ALL) {
    return { mode: 'all', trimId: null };
  }
  return { mode: 'single', trimId };
}

export function shouldShowTrimPicker(trims = []) {
  return trims.length > 0;
}
