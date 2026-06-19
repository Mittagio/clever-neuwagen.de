/**
 * Gemeinsame Fahrzeugkonfiguration – eine Datenquelle, zwei Darstellungen:
 *
 * - Verkäufer: SellerVehicleConfigurator (kompakte Felder)
 * - Kunde: EquipmentWishAdvisor / DealerVehicleUnderstandCard (Karten, Erklärungen)
 */
export {
  buildConfigureDraft,
  buildConfigureOptions,
  buildConfigureVehicleSummary,
  buildOfferPreview,
  computeLiveRateForDraft,
  computeVehicleListPrice,
  fieldsFromConfigureDraft,
  hasRecognizedModelKey,
} from './dealerAiVehicleConfigureFlow.js';

export { CONFIGURATOR_AUDIENCE } from './vehicleConfigurationModes.js';

import { resolveConfigureModel } from './configuration/configureModelBridge.js';
import { sanitizePackageIdsForTrim } from './configuration/configurePackageCatalog.js';

export function getPackagesForTrim(modelKey, trimId = null) {
  return (resolveConfigureModel(modelKey)?.data?.packages ?? [])
    .filter((pkg) => !trimId || !pkg.availableTrims?.length || pkg.availableTrims.includes(trimId))
    .map((pkg) => ({ id: pkg.id, label: pkg.name }));
}

export function getAccessoriesForTrim(modelKey, trimId = null) {
  return (resolveConfigureModel(modelKey)?.data?.accessories ?? [])
    .filter((acc) => !trimId || !acc.availableTrims?.length || acc.availableTrims.includes(trimId))
    .map((acc) => ({ id: acc.id, label: acc.name }));
}

export function filterPackageIdsForTrim(modelKey, trimId, packageIds = []) {
  return sanitizePackageIdsForTrim(modelKey, trimId, packageIds);
}

export function filterAccessoryIdsForTrim(modelKey, trimId, accessoryIds = []) {
  const allowed = new Set(getAccessoriesForTrim(modelKey, trimId).map((a) => a.id));
  return accessoryIds.filter((id) => allowed.has(id));
}
