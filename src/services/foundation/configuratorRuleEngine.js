/**
 * Regel-Engine – alle Konfigurator-Entscheidungen aus der Datenbank.
 * Keine Paketlogik in UI-Komponenten; keine KI-Erfindungen.
 */
import {
  ADMIN_TEST_RULE_STATUSES,
  CONFIGURATOR_AUDIENCE,
  RULE_STATUS,
  RULE_TYPE,
  SELLER_RULE_STATUSES,
} from '../../data/foundation/ruleTypes.js';
import { isRuleActive } from '../../data/foundation/configuratorFoundationSchema.js';

const REVIEW_MESSAGE = 'Bitte prüfen';

function allowedStatusesForAudience(audience) {
  if (audience === CONFIGURATOR_AUDIENCE.ADMIN) return ADMIN_TEST_RULE_STATUSES;
  return SELLER_RULE_STATUSES;
}

/**
 * @param {import('../../data/foundation/configuratorFoundationTypes.js').FoundationRule[]} rules
 * @param {import('../../data/foundation/configuratorFoundationTypes.js').ConfiguratorAudience} audience
 * @param {Date} [asOf]
 */
export function filterRulesForAudience(rules, audience, asOf = new Date()) {
  const allowed = new Set(allowedStatusesForAudience(audience));
  return (rules ?? []).filter(
    (rule) => allowed.has(rule.status) && isRuleActive(rule, asOf),
  );
}

function matchesScope(rule, selection) {
  if (rule.trimId && rule.trimId !== selection.trimId) return false;
  if (rule.powertrainId && rule.powertrainId !== selection.powertrainId) return false;
  return true;
}

function packageLabel(bundle, packageId) {
  return bundle.optionPackages.find((p) => p.id === packageId)?.name ?? packageId;
}

function equipmentHighlights(bundle, packageId) {
  const contentIds = bundle.packageContents
    .filter((pc) => pc.packageId === packageId)
    .map((pc) => pc.equipmentItemId);
  return contentIds
    .map((id) => bundle.equipmentItems.find((e) => e.id === id)?.name)
    .filter(Boolean)
    .slice(0, 5);
}

function packagePriceFromRules(rules, packageId) {
  const hit = rules.find(
    (r) => r.ruleType === RULE_TYPE.PRICE && r.packageId === packageId && r.price != null,
  );
  return hit?.price ?? null;
}

function isPackageAvailableForTrim(bundle, rules, packageId, selection) {
  const allAvailabilityRules = rules.filter(
    (r) => r.packageId === packageId && r.ruleType === RULE_TYPE.PACKAGE_AVAILABILITY,
  );

  if (!allAvailabilityRules.length) {
    const pkg = bundle.optionPackages.find((p) => p.id === packageId);
    return Boolean(pkg);
  }

  const forTrim = allAvailabilityRules.filter((r) => matchesScope(r, selection));
  return forTrim.some((r) => r.value?.available !== false);
}

function isPackageIncluded(bundle, rules, packageId, selection) {
  const scoped = rules.filter(
    (r) => r.packageId === packageId
      && r.ruleType === RULE_TYPE.PACKAGE_INCLUDED
      && matchesScope(r, selection),
  );
  if (scoped.some((r) => r.value?.included)) return true;

  const contents = bundle.packageContents.filter((pc) => pc.packageId === packageId);
  if (!contents.length || !selection.trimId) return false;

  const standardEquipment = new Set(
    rules
      .filter(
        (r) => r.ruleType === RULE_TYPE.TRIM_STANDARD_EQUIPMENT
          && r.trimId === selection.trimId
          && matchesScope(r, selection),
      )
      .map((r) => r.equipmentItemId ?? r.value?.equipmentItemId)
      .filter(Boolean),
  );

  return contents.length > 0 && contents.every((pc) => standardEquipment.has(pc.equipmentItemId));
}

function missingDependencies(rules, packageId, selectedPackageIds) {
  const deps = rules.filter(
    (r) => r.packageId === packageId && r.ruleType === RULE_TYPE.PACKAGE_DEPENDENCY,
  );
  const missing = [];
  for (const dep of deps) {
    for (const reqId of dep.value?.requiredPackageIds ?? []) {
      if (!selectedPackageIds.includes(reqId)) {
        missing.push(reqId);
      }
    }
  }
  return [...new Set(missing)];
}

function allPackageDependencies(rules, packageId) {
  const deps = rules.filter(
    (r) => r.packageId === packageId && r.ruleType === RULE_TYPE.PACKAGE_DEPENDENCY,
  );
  const ids = [];
  for (const dep of deps) {
    for (const reqId of dep.value?.requiredPackageIds ?? []) {
      ids.push(reqId);
    }
  }
  return [...new Set(ids)];
}

function exclusionConflicts(rules, packageId, selectedPackageIds) {
  const conflicts = [];
  for (const rule of rules) {
    if (rule.ruleType !== RULE_TYPE.PACKAGE_EXCLUSION) continue;
    const excludes = rule.value?.excludedPackageIds ?? [];
    if (rule.packageId === packageId && excludes.some((id) => selectedPackageIds.includes(id))) {
      conflicts.push(...excludes.filter((id) => selectedPackageIds.includes(id)));
    }
    if (excludes.includes(packageId) && selectedPackageIds.includes(rule.packageId)) {
      conflicts.push(rule.packageId);
    }
  }
  return [...new Set(conflicts)];
}

/**
 * @param {import('../../data/foundation/configuratorFoundationTypes.js').ModelYearBundle} bundle
 * @param {import('../../data/foundation/configuratorFoundationTypes.js').ConfigurationSelection} selection
 * @param {import('../../data/foundation/configuratorFoundationTypes.js').ConfiguratorAudience} [audience]
 */
export function evaluateConfiguratorState(bundle, selection, audience = CONFIGURATOR_AUDIENCE.SELLER) {
  const allRules = bundle?.rules ?? [];
  const activeRules = filterRulesForAudience(allRules, audience);
  const usesDraftRules = audience === CONFIGURATOR_AUDIENCE.ADMIN
    && allRules.some((r) => r.status === RULE_STATUS.DRAFT);

  const selectedPackageIds = [...new Set(selection.packageIds ?? [])];
  const trim = bundle.trims.find((t) => t.id === selection.trimId) ?? null;

  if (!bundle?.modelYear || !selection.trimId) {
    return {
      ok: false,
      needsReview: true,
      reviewMessage: REVIEW_MESSAGE,
      packages: [],
      colors: [],
      issues: [{ severity: 'error', code: 'missing_selection', message: 'Trim fehlt' }],
    };
  }

  const packages = [];
  for (const pkg of bundle.optionPackages) {
    const available = isPackageAvailableForTrim(bundle, activeRules, pkg.id, selection);
    const included = isPackageIncluded(bundle, activeRules, pkg.id, selection);
    const selected = selectedPackageIds.includes(pkg.id);
    const missingReqIds = missingDependencies(activeRules, pkg.id, selectedPackageIds);
    const allReqIds = allPackageDependencies(activeRules, pkg.id);
    const excludedBy = exclusionConflicts(activeRules, pkg.id, selectedPackageIds);
    const priceGross = packagePriceFromRules(activeRules, pkg.id);

    /** @type {import('../../data/foundation/configuratorFoundationTypes.js').PackageEvaluationStatus} */
    let status = 'available';
    const dependencyHints = [];

    if (!available) {
      status = 'unavailable';
    } else if (included) {
      status = 'included';
    } else if (excludedBy.length) {
      status = 'blocked';
    } else if (missingReqIds.length) {
      status = 'blocked';
      dependencyHints.push(
        `Benötigt: ${missingReqIds.map((id) => packageLabel(bundle, id)).join(', ')}`,
      );
    } else if (selected) {
      status = 'selected';
    }

    packages.push({
      id: pkg.id,
      code: pkg.code,
      name: pkg.name,
      status,
      priceGross,
      highlights: equipmentHighlights(bundle, pkg.id),
      includedInTrimLabel: included ? (trim?.name ?? selection.trimId) : null,
      missingRequiredLabels: missingReqIds.map((id) => packageLabel(bundle, id)),
      requiredPackages: allReqIds.map((id) => ({
        id,
        label: packageLabel(bundle, id),
        satisfied: selectedPackageIds.includes(id),
      })),
      excludedByLabels: excludedBy.map((id) => packageLabel(bundle, id)),
      dependencyHints,
      usesDraftRules: usesDraftRules && allRules.some(
        (r) => r.packageId === pkg.id && r.status === RULE_STATUS.DRAFT,
      ),
    });
  }

  const colorMap = new Map();
  for (const rule of activeRules) {
    if (rule.ruleType !== RULE_TYPE.COLOR || !matchesScope(rule, selection)) continue;
    const colorId = rule.colorId ?? rule.value?.colorId;
    if (!colorId) continue;
    colorMap.set(colorId, {
      id: colorId,
      label: rule.value?.label ?? colorId,
      priceGross: rule.price ?? rule.value?.priceGross ?? 0,
      hexPreview: rule.value?.hexPreview ?? null,
    });
  }

  const colors = [...colorMap.values()];
  const hasIncompletePrices = packages.some(
    (p) => p.status !== 'included' && p.status !== 'unavailable' && p.priceGross == null,
  );
  const needsReview = hasIncompletePrices || !colors.length || !bundle.powertrains.length;

  return {
    ok: !needsReview,
    needsReview,
    reviewMessage: needsReview ? REVIEW_MESSAGE : null,
    packages,
    colors,
    powertrains: bundle.powertrains,
    trims: bundle.trims,
    usesDraftRules,
    issues: needsReview
      ? [{ severity: 'warning', code: 'incomplete_data', message: REVIEW_MESSAGE }]
      : [],
  };
}

/**
 * @param {import('../../data/foundation/configuratorFoundationTypes.js').ModelYearBundle} bundle
 * @param {import('../../data/foundation/configuratorFoundationTypes.js').ConfigurationSelection} selection
 */
export function canCalculatePricing(bundle, selection, audience = CONFIGURATOR_AUDIENCE.SELLER) {
  const state = evaluateConfiguratorState(bundle, selection, audience);
  if (state.needsReview) {
    return { ok: false, message: REVIEW_MESSAGE, state };
  }

  const blockedSelected = state.packages.filter(
    (p) => (p.status === 'blocked' || p.status === 'unavailable') && selection.packageIds?.includes(p.id),
  );
  if (blockedSelected.length) {
    return { ok: false, message: REVIEW_MESSAGE, state };
  }

  return { ok: true, state };
}

export { REVIEW_MESSAGE };
