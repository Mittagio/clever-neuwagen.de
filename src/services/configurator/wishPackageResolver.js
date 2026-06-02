import { getManufacturerModel, getManufacturerTrims, getManufacturerPackages, getManufacturerEquipment, getManufacturerAccessories } from '../../data/manufacturer/manufacturerRegistry.js';
import { getManufacturerFeatureIds } from '../../data/manufacturer/featureBridge.js';
import { getPackageAvailability } from '../../data/models/kia/sportageAdapter.js';

function resolveFeatureInTrim(modelKey, trimId, mfgFeatureId, data) {
  const equipment = data.equipment ?? [];
  const eq = equipment.find((e) => e.id === mfgFeatureId);
  if (!eq) return { status: 'missing' };

  if (eq.standardInTrims?.includes(trimId)) {
    return { status: 'standard', equipment: eq };
  }

  const viaPackage = (eq.availableViaPackages ?? []).find((pkgId) => {
    const pkg = (data.packages ?? []).find((p) => p.id === pkgId);
    return pkg?.availableTrims?.includes(trimId);
  });
  if (viaPackage) {
    const pkg = data.packages.find((p) => p.id === viaPackage);
    return { status: 'package', packageId: viaPackage, packageName: pkg?.name, equipment: eq };
  }

  const viaAcc = (eq.availableViaAccessories ?? []).find((accId) => {
    const acc = (data.accessories ?? []).find((a) => a.id === accId);
    return acc?.availableTrims?.includes(trimId);
  });
  if (viaAcc) {
    const acc = data.accessories.find((a) => a.id === viaAcc);
    return { status: 'accessory', accessoryId: viaAcc, accessoryName: acc?.name, equipment: eq };
  }

  if (eq.notAvailableInTrims?.includes(trimId)) {
    return { status: 'missing' };
  }

  return { status: 'missing' };
}

function resolveSportagePackages(trimId, engineId, packageIds, data) {
  const valid = [];
  const warnings = [];
  for (const pkgId of packageIds) {
    const pkg = data.packages.find((p) => p.id === pkgId);
    if (!pkg) continue;
    const avail = getPackageAvailability(pkg, trimId, engineId, valid.map((p) => p.id));
    if (avail.allowed) valid.push(pkg);
    else warnings.push(`${pkg.name}: ${avail.reason}`);
  }
  return { packages: valid, warnings };
}

/**
 * Ermittelt für einen Trim + Wunschliste die benötigten Pakete/Zubehör.
 */
export function resolveWishConfiguration({ brand, model, trimId, wishFeatureIds = [], engineId }) {
  const mfg = getManufacturerModel(brand, model);
  if (!mfg) return null;

  const data = mfg.data;
  const trim = getManufacturerTrims(mfg.key).find((t) => t.id === trimId)
    ?? getManufacturerTrims(mfg.key)[0];
  if (!trim) return null;

  const resolvedEngineId = engineId ?? mfg.defaultEngineId;
  const matchedFeatures = [];
  const missingFeatures = [];
  const requiredPackages = new Map();
  const requiredAccessories = new Map();
  const viaPackageFeatures = [];

  for (const wishId of wishFeatureIds) {
    const mfgIds = getManufacturerFeatureIds(wishId);
    if (!mfgIds.length) {
      missingFeatures.push(wishId);
      continue;
    }

    let fulfilled = false;
    for (const mfgId of mfgIds) {
      const result = resolveFeatureInTrim(mfg.key, trim.id, mfgId, data);
      if (result.status === 'standard') {
        matchedFeatures.push(wishId);
        fulfilled = true;
        break;
      }
      if (result.status === 'package') {
        requiredPackages.set(result.packageId, {
          id: result.packageId,
          name: result.packageName,
          reason: result.equipment?.name,
        });
        viaPackageFeatures.push({ wishId, packageId: result.packageId, label: result.packageName });
        matchedFeatures.push(wishId);
        fulfilled = true;
        break;
      }
      if (result.status === 'accessory') {
        requiredAccessories.set(result.accessoryId, {
          id: result.accessoryId,
          name: result.accessoryName,
          reason: result.equipment?.name,
        });
        matchedFeatures.push(wishId);
        fulfilled = true;
        break;
      }
    }
    if (!fulfilled) missingFeatures.push(wishId);
  }

  const packageIds = [...requiredPackages.keys()];
  const accessoryIds = [...requiredAccessories.keys()];

  let packageValidation = { packages: [], warnings: [] };
  if (mfg.engine === 'sportage') {
    packageValidation = resolveSportagePackages(trim.id, resolvedEngineId, packageIds, data);
  } else {
    packageValidation.packages = packageIds
      .map((id) => data.packages.find((p) => p.id === id))
      .filter(Boolean);
  }

  return {
    modelKey: mfg.key,
    trimId: trim.id,
    trimName: trim.name,
    engineId: resolvedEngineId,
    matchedFeatures: [...new Set(matchedFeatures)],
    missingFeatures: [...new Set(missingFeatures)],
    requiredPackages: [...requiredPackages.values()],
    requiredAccessories: [...requiredAccessories.values()],
    packageIds: packageValidation.packages.map((p) => p.id),
    accessoryIds,
    viaPackageFeatures,
    wishesTotal: wishFeatureIds.length,
    wishesMatched: [...new Set(matchedFeatures)].length,
  };
}

/**
 * Vergleicht alle Trims für gegebene Wünsche.
 */
export function compareTrimsForWish({ brand, model, wishFeatureIds = [] }) {
  const mfg = getManufacturerModel(brand, model);
  if (!mfg) return [];

  return getManufacturerTrims(mfg.key).map((trim) => {
    const config = resolveWishConfiguration({
      brand,
      model,
      trimId: trim.id,
      wishFeatureIds,
      engineId: mfg.defaultEngineId,
    });
    return {
      trimId: trim.id,
      trimName: trim.name,
      ...config,
    };
  }).sort((a, b) => b.wishesMatched - a.wishesMatched);
}

export function findBestTrimForWish({ brand, model, wishFeatureIds = [] }) {
  const compared = compareTrimsForWish({ brand, model, wishFeatureIds });
  return compared[0] ?? null;
}
