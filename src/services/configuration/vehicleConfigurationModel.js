/**
 * Fahrzeugkonfiguration – reine Fahrzeugdaten, getrennt von Angebotslogik.
 */
import { resolveConfigureModel } from './configureModelBridge.js';
import { buildPackageCatalog } from './configurePackageCatalog.js';
import { computeUvpPricing } from './uvpPricing.js';

/**
 * @param {object} draft
 * @returns {import('./vehicleConfigurationTypes.js').VehicleConfiguration|null}
 */
export function buildVehicleConfiguration(draft) {
  if (!draft?.modelKey) return null;

  const uvp = computeUvpPricing(draft);
  const catalog = buildPackageCatalog(
    draft.modelKey,
    draft.trimId,
    draft.packageIds ?? [],
  );
  const mfg = resolveConfigureModel(draft.modelKey);

  const selectedPackages = (draft.packageIds ?? []).map((id) => {
    const catalogPkg = catalog.packages.find((p) => p.id === id);
    const mfgPkg = mfg?.data?.packages?.find((p) => p.id === id);
    return {
      id,
      name: mfgPkg?.name ?? catalogPkg?.name ?? id,
      priceGross: mfgPkg?.priceGross ?? catalogPkg?.priceGross ?? 0,
      status: catalogPkg?.status ?? 'selected',
    };
  });

  const includedPackages = catalog.packages
    .filter((p) => p.status === 'included')
    .map((p) => ({ id: p.id, name: p.name }));

  const accessories = (draft.accessoryIds ?? []).map((id) => {
    const acc = mfg?.data?.accessories?.find((a) => a.id === id);
    return {
      id,
      name: acc?.name ?? id,
      priceGross: acc?.priceGross ?? 0,
    };
  });

  const dealerExtras = Object.entries(draft.extras ?? {})
    .filter(([, active]) => Boolean(active))
    .map(([key]) => ({
      id: key,
      name: key === 'winterraeder' ? 'Winterräder'
        : key === 'wartung' ? 'Wartung'
        : key === 'versicherung' ? 'Versicherung'
        : key === 'ahk' ? 'AHK' : key,
    }));

  return {
    brand: draft.brand ?? 'Kia',
    model: draft.model ?? '',
    modelKey: draft.modelKey,
    trimId: draft.trimId ?? null,
    trimLabel: draft.trimLabel ?? null,
    engineId: draft.engineId ?? null,
    motorLabel: draft.motorLabel ?? draft.batteryLabel ?? null,
    batteryLabel: draft.batteryLabel ?? null,
    colorId: draft.colorId ?? null,
    colorLabel: draft.colorLabel ?? null,
    packageIds: [...(draft.packageIds ?? [])],
    accessoryIds: [...(draft.accessoryIds ?? [])],
    extras: { ...(draft.extras ?? {}) },
    selectedPackages,
    includedPackages,
    accessories,
    dealerExtras,
    uvpBasePrice: uvp?.uvpBasePrice ?? null,
    uvpConfigurationPrice: uvp?.uvpConfigurationPrice ?? null,
    uvpLineItems: uvp?.lineItems ?? [],
  };
}

export function vehicleConfigurationTitle(config) {
  return [config?.model, config?.trimLabel, config?.motorLabel ?? config?.batteryLabel]
    .filter(Boolean)
    .join(' ');
}

export function vehicleConfigurationSubtitle(config) {
  return [config?.trimLabel, config?.motorLabel ?? config?.batteryLabel, config?.colorLabel]
    .filter(Boolean)
    .join(' · ');
}
