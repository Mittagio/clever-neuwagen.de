/**
 * Kopierfunktionen – Modell, Ausstattung, Vormonat, alle Trims
 */
import { buildLeasingWizardCombos } from './dealerLeasingWizard.js';
import { getModelTrimLines } from './dealerTrimConditions.js';
import { resolveModelSettings } from './dealerVehicleManagement.js';
import { copyTrimSettingsPatch } from './dealerTrimConditions.js';

export function buildCopyFromModelPatch(targetSettings = {}, sourceSettings = {}) {
  return {
    paymentDiscounts: { ...sourceSettings.paymentDiscounts },
    bonusAmount: sourceSettings.bonusAmount ?? null,
    leasingFactorSkipped: { ...sourceSettings.leasingFactorSkipped },
    trimConditions: JSON.parse(JSON.stringify(sourceSettings.trimConditions ?? {})),
    preparationFee: { ...sourceSettings.preparationFee },
    deliveryTime: sourceSettings.deliveryTime ?? '',
    listPrice: sourceSettings.listPrice ?? null,
    priceFrom: sourceSettings.priceFrom ?? '',
  };
}

export function buildCopyLeasingFactorsPlan(conditions = {}, sourceModelId, targetModelId, trimId = null) {
  const combos = buildLeasingWizardCombos();
  const updates = [];

  const sourceFactors = conditions.leasingFactorsByModel?.[sourceModelId] ?? {};
  const isTrimStructure = trimId && sourceFactors[trimId];

  for (const { term, km } of combos) {
    let value = null;
    if (isTrimStructure) {
      value = sourceFactors[trimId]?.[term]?.[km] ?? null;
    } else {
      value = sourceFactors[term]?.[km] ?? null;
    }
    if (value != null) {
      updates.push({ term, km, value, trimId });
    }
  }

  return { sourceModelId, targetModelId, trimId, updates };
}

export function buildCopyTrimToAllPatch(settings = {}, sourceTrimId, trimIds = []) {
  let patch = {};
  for (const targetId of trimIds) {
    if (targetId === sourceTrimId) continue;
    patch = {
      ...patch,
      ...copyTrimSettingsPatch(
        { ...settings, ...patch },
        sourceTrimId,
        targetId,
      ),
    };
  }
  return patch;
}

export function buildCopyFromPreviousMonthPatch(currentSettings = {}, previousSettings = {}) {
  return buildCopyFromModelPatch(currentSettings, previousSettings);
}

export function listCopyableModels(conditions = {}, excludeModelId = '') {
  return (conditions.activeModels ?? [])
    .filter((m) => m.id !== excludeModelId)
    .map((m) => ({
      id: m.id,
      name: m.name,
      brand: m.brand,
      hasSettings: Boolean(conditions.modelSettingsByModel?.[m.id]),
    }));
}

export function getPreviousMonthSettings(conditions = {}, modelId = '') {
  const archive = conditions.modelSettingsArchive ?? {};
  const keys = Object.keys(archive[modelId] ?? {}).sort().reverse();
  if (!keys.length) return null;
  return archive[modelId][keys[0]];
}

export function archiveModelSettingsForMonth(conditions = {}, modelId = '', settings = {}) {
  const monthKey = new Date().toISOString().slice(0, 7);
  const archive = { ...(conditions.modelSettingsArchive ?? {}) };
  archive[modelId] = {
    ...(archive[modelId] ?? {}),
    [monthKey]: JSON.parse(JSON.stringify(settings)),
  };
  return { modelSettingsArchive: archive };
}
