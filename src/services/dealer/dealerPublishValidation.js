/**
 * Pflichtprüfung vor Veröffentlichung eines Modells
 */
import { getLeasingWizardProgress, resolveSkippedMap } from './dealerLeasingWizard.js';
import { getModelTrimLines } from './dealerTrimConditions.js';
import { resolveModelSettings, resolvePreparationFeeAmount } from './dealerVehicleManagement.js';
import { assessMinPriceRisk } from './dealerMinPriceGuard.js';

export function validateModelForPublish(conditions = {}, model = {}) {
  const modelId = model.id;
  const settings = resolveModelSettings(conditions, modelId);
  const trims = getModelTrimLines(model);
  const issues = [];
  const warnings = [];

  const hasPrice = settings.listPrice > 0 || Boolean(settings.priceFrom?.trim());
  if (!hasPrice) {
    issues.push({ id: 'price', label: 'Kaufpreis oder Ab-Preis fehlt', severity: 'error' });
  }

  const prepAmount = resolvePreparationFeeAmount(conditions, modelId);
  if (!prepAmount) {
    issues.push({ id: 'preparation', label: 'Überführung nicht gepflegt', severity: 'error' });
  }

  const deliveryTime = settings.deliveryTime?.trim() || model.defaultDeliveryTime?.trim();
  if (!deliveryTime) {
    issues.push({ id: 'delivery', label: 'Lieferzeit fehlt', severity: 'error' });
  }

  const skipped = resolveSkippedMap(settings);
  const leasingProgress = getLeasingWizardProgress(conditions, modelId, skipped);
  if (leasingProgress.filled === 0) {
    issues.push({ id: 'leasing', label: 'Keine Leasingfaktoren gepflegt', severity: 'error' });
  } else if (leasingProgress.pending > 0) {
    warnings.push({
      id: 'leasing-pending',
      label: `${leasingProgress.pending} Leasingfaktoren noch nicht gepflegt`,
    });
  }

  if (trims.length > 0) {
    const trimConfigured = trims.some((trim) => {
      const trimData = settings.trimConditions?.[trim.id];
      return trimData?.paymentDiscounts
        || trimData?.bonusAmount != null
        || Object.keys(trimData?.leasingFactorSkipped ?? {}).length > 0;
    });
    const hasTrimLeasing = trims.some((trim) => {
      const factors = conditions.leasingFactorsByModel?.[modelId]?.[trim.id];
      return factors && Object.keys(factors).length > 0;
    });
    if (!trimConfigured && !hasTrimLeasing && leasingProgress.filled === 0) {
      issues.push({ id: 'trim', label: 'Ausstattungslinien noch nicht gepflegt', severity: 'error' });
    }
  }

  const minPrice = assessMinPriceRisk(conditions, modelId);
  warnings.push(...minPrice.warnings);

  return {
    issues,
    warnings,
    canPublish: issues.length === 0,
    leasingProgress,
  };
}

export function validateDealerForPublish(conditions = {}) {
  const models = conditions.activeModels ?? [];
  const perModel = models
    .filter((m) => m.active)
    .map((model) => ({
      model,
      result: validateModelForPublish(conditions, model),
    }));

  const blockers = perModel.flatMap(({ model, result }) => (
    result.issues.map((issue) => ({ ...issue, modelId: model.id, modelName: model.name }))
  ));

  return {
    perModel,
    canPublish: blockers.length === 0,
    blockers,
  };
}
