/**
 * UVP-Preislogik – rein herstellerseitig, ohne Händler-Rabatte oder Leasing.
 * Markenunabhängiges Fundament: UVP + Pakete + Farben + Extras.
 */
import { getModelColorCatalog } from '../../data/manufacturer/configureModelColorCatalog.js';
import { resolveConfigureModel } from './configureModelBridge.js';
import { buildPackageCatalog } from './configurePackageCatalog.js';

function resolveVariant(data, trimId, engineId) {
  if (!data?.variants?.length) return null;
  return data.variants.find(
    (v) => v.trimId === trimId && (!engineId || v.engineId === engineId),
  )
    ?? data.variants.find((v) => v.trimId === trimId)
    ?? data.variants[0];
}

function resolveColorPrice(draft, mfg) {
  if (!draft.colorId) return { price: 0, label: null };
  const fromData = mfg?.data?.colors?.find((c) => c.id === draft.colorId);
  if (fromData?.priceGross != null) {
    return {
      price: fromData.priceGross,
      label: fromData.label ?? fromData.name ?? draft.colorLabel,
    };
  }
  const catalog = getModelColorCatalog(draft.modelKey) ?? [];
  const hit = catalog.find((c) => c.id === draft.colorId);
  return {
    price: hit?.priceGross ?? 0,
    label: hit?.label ?? draft.colorLabel,
  };
}

/**
 * @param {object} draft – Konfigurator-Entwurf (nur Fahrzeugfelder)
 */
export function computeUvpPricing(draft) {
  if (!draft?.modelKey) return null;

  const mfg = resolveConfigureModel(draft.modelKey);
  if (!mfg?.data) return null;

  const { data } = mfg;
  const trimId = draft.trimId ?? mfg.defaultTrimId;
  const engineId = draft.engineId ?? mfg.defaultEngineId;
  const variant = resolveVariant(data, trimId, engineId);
  const uvpBasePrice = variant?.priceGross ?? 0;

  const lineItems = [{
    id: 'uvp-base',
    type: 'base',
    label: 'UVP Fahrzeug',
    amount: uvpBasePrice,
  }];

  const color = resolveColorPrice(draft, mfg);
  if (color.price > 0) {
    lineItems.push({
      id: draft.colorId,
      type: 'color',
      label: color.label ?? draft.colorLabel ?? 'Lack',
      amount: color.price,
    });
  }

  const catalog = buildPackageCatalog(draft.modelKey, trimId, draft.packageIds ?? []);
  let packagesTotal = 0;

  for (const pkgId of draft.packageIds ?? []) {
    const catalogPkg = catalog.packages.find((p) => p.id === pkgId);
    if (catalogPkg?.status === 'included') continue;

    const mfgPkg = data.packages?.find((p) => p.id === pkgId);
    const amount = mfgPkg?.priceGross ?? catalogPkg?.priceGross ?? 0;
    if (amount <= 0) continue;

    packagesTotal += amount;
    lineItems.push({
      id: pkgId,
      type: 'package',
      label: mfgPkg?.name ?? catalogPkg?.name ?? pkgId,
      amount,
    });
  }

  let accessoriesTotal = 0;
  for (const accId of draft.accessoryIds ?? []) {
    const acc = data.accessories?.find((a) => a.id === accId);
    if (!acc) continue;
    const amount = acc.priceGross ?? 0;
    accessoriesTotal += amount;
    lineItems.push({
      id: accId,
      type: 'accessory',
      label: acc.name ?? accId,
      amount,
    });
  }

  const additionsTotal = color.price + packagesTotal + accessoriesTotal;
  const uvpConfigurationPrice = uvpBasePrice + additionsTotal;

  return {
    uvpBasePrice,
    uvpConfigurationPrice,
    lineItems,
    variantId: variant?.id ?? null,
  };
}

export function formatUvpLineAmount(amount) {
  if (!amount) return 'Serie';
  return `+${Number(amount).toLocaleString('de-DE')} €`;
}
