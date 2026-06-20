/**
 * Foundation → Legacy-Adapter für bestehenden Konfigurator (SellerVehicleConfigurator).
 * Alle Regeln kommen aus der Foundation-DB – keine Logik in UI-Komponenten.
 */
import { RULE_TYPE } from '../../data/foundation/ruleTypes.js';

function rulesForPackage(rules, packageId, ruleType) {
  return rules.filter((r) => r.packageId === packageId && r.ruleType === ruleType);
}

function rulesForTrim(rules, trimId, ruleType) {
  return rules.filter((r) => r.trimId === trimId && r.ruleType === ruleType);
}

function estimateRateDelta(priceGross) {
  if (!priceGross) return 0;
  return Math.max(1, Math.round(priceGross / 100));
}

/**
 * @param {import('../../data/foundation/configuratorFoundationTypes.js').ModelYearBundle} bundle
 * @param {{ defaultTrimId?: string, defaultEngineId?: string, engineKey?: string }} [defaults]
 */
export function foundationBundleToLegacyEntry(bundle, defaults = {}) {
  if (!bundle?.modelYear) return null;

  const { modelId } = bundle.scope;
  const rules = bundle.rules ?? [];
  const modelKey = modelId;

  const equipment = (bundle.equipmentItems ?? []).map((eq) => {
    const standardInTrims = rules
      .filter(
        (r) => r.ruleType === RULE_TYPE.TRIM_STANDARD_EQUIPMENT
          && (r.equipmentItemId === eq.id || r.value?.equipmentItemId === eq.id),
      )
      .map((r) => r.trimId)
      .filter(Boolean);
    return {
      id: eq.id,
      name: eq.name,
      standardInTrims: [...new Set(standardInTrims)],
      availableViaPackages: [],
    };
  });

  const trims = (bundle.trims ?? []).map((trim) => {
    const baseEquipment = rules
      .filter(
        (r) => r.ruleType === RULE_TYPE.TRIM_STANDARD_EQUIPMENT && r.trimId === trim.id,
      )
      .map((r) => r.equipmentItemId ?? r.value?.equipmentItemId)
      .filter(Boolean);

    const availablePackages = rules
      .filter(
        (r) => r.ruleType === RULE_TYPE.PACKAGE_AVAILABILITY
          && r.trimId === trim.id
          && r.value?.available !== false,
      )
      .map((r) => r.packageId)
      .filter(Boolean);

    const includedPackages = rules
      .filter(
        (r) => r.ruleType === RULE_TYPE.PACKAGE_INCLUDED
          && r.trimId === trim.id
          && r.value?.included,
      )
      .map((r) => r.packageId)
      .filter(Boolean);

    return {
      id: trim.id,
      name: trim.name,
      shortDescription: trim.shortDescription ?? null,
      baseEquipment: [...new Set(baseEquipment)],
      availablePackages: [...new Set(availablePackages)],
      includedPackages: [...new Set(includedPackages)],
    };
  });

  const packages = (bundle.optionPackages ?? []).map((pkg) => {
    const features = bundle.packageContents
      .filter((pc) => pc.packageId === pkg.id)
      .map((pc) => pc.equipmentItemId);

    const availableTrims = rules
      .filter(
        (r) => r.ruleType === RULE_TYPE.PACKAGE_AVAILABILITY
          && r.packageId === pkg.id
          && r.value?.available !== false,
      )
      .map((r) => r.trimId)
      .filter(Boolean);

    const includedInTrims = rules
      .filter(
        (r) => r.ruleType === RULE_TYPE.PACKAGE_INCLUDED
          && r.packageId === pkg.id
          && r.value?.included,
      )
      .map((r) => r.trimId)
      .filter(Boolean);

    const requiresPackages = [
      ...new Set(
        rulesForPackage(rules, pkg.id, RULE_TYPE.PACKAGE_DEPENDENCY)
          .flatMap((r) => r.value?.requiredPackageIds ?? []),
      ),
    ];

    const priceRule = rulesForPackage(rules, pkg.id, RULE_TYPE.PRICE)[0];
    const priceGross = priceRule?.price ?? 0;

    return {
      id: pkg.id,
      name: pkg.name,
      description: pkg.description ?? '',
      priceGross,
      rateDelta: estimateRateDelta(priceGross),
      features,
      availableTrims: [...new Set(availableTrims)],
      includedInTrims: [...new Set(includedInTrims)],
      requiresPackages,
    };
  });

  const colorMap = new Map();
  for (const rule of rules) {
    if (rule.ruleType !== RULE_TYPE.COLOR) continue;
    const colorId = rule.colorId ?? rule.value?.colorId;
    if (!colorId) continue;
    if (!colorMap.has(colorId)) {
      colorMap.set(colorId, {
        id: colorId,
        name: rule.value?.label ?? colorId,
        label: rule.value?.label ?? colorId,
        priceGross: rule.price ?? rule.value?.priceGross ?? 0,
        hexPreview: rule.value?.hexPreview ?? null,
        availableTrims: [],
      });
    }
    if (rule.trimId) {
      colorMap.get(colorId).availableTrims.push(rule.trimId);
    }
  }
  const colors = [...colorMap.values()].map((c) => ({
    ...c,
    availableTrims: [...new Set(c.availableTrims)],
  }));

  const engines = (bundle.powertrains ?? []).map((pt) => ({
    id: pt.id,
    name: pt.name,
    fuelType: pt.fuelType ?? null,
    transmission: pt.transmission ?? null,
    drive: pt.drive ?? null,
    powerKw: pt.powerKw ?? null,
    powerPs: pt.powerPs ?? null,
    rangeKm: pt.rangeKm ?? null,
    batteryKwh: pt.batteryKwh ?? null,
  }));

  const variants = (bundle.variants ?? []).map((v) => ({
    id: v.id,
    trimId: v.trimId,
    engineId: v.powertrainId,
    priceGross: v.priceGross,
    baseLeasingRate: v.baseLeasingRate ?? estimateRateDelta(v.priceGross) ?? 299,
  }));

  const defaultTrimId = defaults.defaultTrimId
    ?? trims.find((t) => t.id === 'earth')?.id
    ?? trims.find((t) => t.id === 'spirit')?.id
    ?? trims[0]?.id
    ?? null;

  const defaultEngineId = defaults.defaultEngineId
    ?? engines[engines.length - 1]?.id
    ?? engines[0]?.id
    ?? null;

  const data = {
    brand: bundle.manufacturer?.name ?? 'Kia',
    model: bundle.model?.name ?? modelId,
    modelKey,
    modelYear: bundle.modelYear.modelYear,
    tagline: bundle.modelYear.tagline ?? null,
    trims,
    packages,
    equipment,
    engines,
    colors,
    variants,
    accessories: [],
  };

  return {
    key: modelKey,
    brand: data.brand,
    model: data.model,
    label: `${data.brand} ${data.model}`,
    data,
    engine: defaults.engineKey ?? modelKey,
    defaultTrimId,
    defaultEngineId,
    _foundation: true,
    _foundationModelYearId: bundle.modelYear.id,
  };
}
