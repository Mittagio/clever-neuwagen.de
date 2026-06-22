/**
 * Paket-Katalog aus Foundation-Regel-Engine → Seller-UI-Format.
 */
import { CONFIGURATOR_AUDIENCE } from '../../data/foundation/ruleTypes.js';
import { evaluateConfiguratorState } from './configuratorRuleEngine.js';
import { resolveFoundationBundle } from './configuratorFoundationRegistry.js';
import { PACKAGE_GROUPS } from '../configuration/configurePackageCatalog.js';

const DEFAULT_GROUP = { id: 'weitere', label: 'Weitere Pakete', order: 9, match: /.*/ };

function resolveGroup(pkg) {
  const haystack = `${pkg.id} ${pkg.name ?? ''}`;
  const hit = PACKAGE_GROUPS.find((g) => g.match.test(haystack));
  return hit ?? DEFAULT_GROUP;
}

function mapStatus(foundationStatus) {
  if (foundationStatus === 'unavailable') return 'hidden';
  return foundationStatus;
}

/**
 * @param {string} modelKey
 * @param {string} trimId
 * @param {string[]} selectedPackageIds
 * @param {{ powertrainId?: string|null }} [options]
 */
export function buildFoundationPackageCatalog(modelKey, trimId, selectedPackageIds = [], options = {}) {
  const bundle = resolveFoundationBundle(modelKey);
  if (!bundle || !trimId) {
    return { groups: [], packages: [], needsReview: true, reviewMessage: 'Bitte prüfen' };
  }

  const state = evaluateConfiguratorState(
    bundle,
    {
      trimId,
      powertrainId: options.powertrainId ?? bundle.powertrains[0]?.id ?? null,
      colorId: null,
      packageIds: selectedPackageIds,
    },
    CONFIGURATOR_AUDIENCE.SELLER,
  );

  const packages = (state.packages ?? [])
    .filter((p) => mapStatus(p.status) !== 'hidden')
    .map((p) => ({
      id: p.id,
      name: p.name,
      priceGross: p.priceGross ?? 0,
      rateDelta: p.priceGross ? Math.max(1, Math.round(p.priceGross / 100)) : 0,
      group: resolveGroup(p),
      highlights: p.highlights ?? [],
      status: mapStatus(p.status),
      includedInTrimLabel: p.includedInTrimLabel,
      missingRequiredLabels: p.missingRequiredLabels ?? [],
      requiredPackages: p.requiredPackages ?? [],
      dependencyHints: p.dependencyHints ?? [],
      excludedByLabels: p.excludedByLabels ?? [],
    }));

  const groupMap = new Map();
  for (const pkg of packages) {
    const groupId = pkg.group.id;
    if (!groupMap.has(groupId)) {
      groupMap.set(groupId, { id: groupId, label: pkg.group.label, order: pkg.group.order, packages: [] });
    }
    groupMap.get(groupId).packages.push(pkg);
  }

  const groups = [...groupMap.values()]
    .sort((a, b) => a.order - b.order)
    .map((g) => ({
      ...g,
      packages: g.packages.sort((a, b) => a.name.localeCompare(b.name, 'de')),
    }));

  return {
    groups,
    packages,
    needsReview: state.needsReview,
    reviewMessage: state.reviewMessage,
  };
}
