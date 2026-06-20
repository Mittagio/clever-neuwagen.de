/**
 * Paket-Katalog für den Verkäufer-Konfigurator.
 * Verfügbarkeit, Gruppen und Inhalte kommen aus den Modell-/Paketdaten.
 */
import { resolveConfigureModel } from './configureModelBridge.js';
import { hasFoundationModel } from '../foundation/configuratorFoundationRegistry.js';
import { buildFoundationPackageCatalog } from '../foundation/foundationPackageCatalogAdapter.js';

/** @typedef {'available' | 'selected' | 'included' | 'blocked' | 'hidden'} PackageStatus */

export const PACKAGE_GROUPS = [
  { id: 'komfort', label: 'Komfort', order: 1, match: /winter|connect|sitz|glas|comfort|komfort|panorama|glasdach|premium-komfort/i },
  { id: 'technik', label: 'Technik', order: 2, match: /drivewise|technology|technik|22.?kw|tech|sound|park|assist|adas|navigation/i },
  { id: 'design', label: 'Design', order: 3, match: /design|styling|black.?edition/i },
];

const DEFAULT_GROUP = { id: 'weitere', label: 'Weitere Pakete', order: 9, match: /.*/ };

function resolveGroup(pkg) {
  const haystack = `${pkg.id} ${pkg.name ?? ''} ${pkg.description ?? ''}`;
  const hit = PACKAGE_GROUPS.find((g) => g.match.test(haystack));
  return hit ?? DEFAULT_GROUP;
}

function trimRecord(modelData, trimId) {
  return modelData?.trims?.find((t) => t.id === trimId) ?? null;
}

function trimLabel(modelData, trimId) {
  return trimRecord(modelData, trimId)?.name ?? trimId;
}

function isPackageListedForTrim(pkg, trimId, trim) {
  if (pkg.availableTrims?.length) return pkg.availableTrims.includes(trimId);
  if (trim?.availablePackages?.length) return trim.availablePackages.includes(pkg.id);
  return true;
}

function isPackageIncludedInTrim(pkg, trimId, trim, equipment) {
  if (pkg.includedInTrims?.includes(trimId)) return true;
  if (trim?.includedPackages?.includes(pkg.id)) return true;

  const features = pkg.features ?? [];
  if (!features.length) return false;

  return features.every((featureId) => {
    const eq = equipment.find((e) => e.id === featureId);
    if (eq?.standardInTrims?.includes(trimId)) return true;
    return trim?.baseEquipment?.includes(featureId);
  });
}

function missingRequiredPackages(pkg, selectedPackageIds) {
  const required = pkg.requiresPackages ?? [];
  return required.filter((id) => !selectedPackageIds.includes(id));
}

function buildHighlights(pkg, equipment) {
  if (pkg.highlights?.length) return pkg.highlights.slice(0, 5);

  const fromFeatures = (pkg.features ?? [])
    .map((id) => equipment.find((e) => e.id === id)?.name)
    .filter(Boolean);

  if (fromFeatures.length) return fromFeatures.slice(0, 5);

  if (pkg.description) {
    return pkg.description
      .split(/[,;·]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 5);
  }

  return [];
}

/**
 * @param {string} modelKey
 * @param {string} trimId
 * @param {string[]} selectedPackageIds
 */
export function buildPackageCatalog(modelKey, trimId, selectedPackageIds = [], options = {}) {
  if (hasFoundationModel(modelKey)) {
    return buildFoundationPackageCatalog(modelKey, trimId, selectedPackageIds, options);
  }

  const mfg = resolveConfigureModel(modelKey);
  if (!mfg?.data || !trimId) {
    return { groups: [], packages: [] };
  }

  const { data } = mfg;
  const trim = trimRecord(data, trimId);
  const equipment = data.equipment ?? [];
  const packages = [];

  for (const pkg of data.packages ?? []) {
    if (!isPackageListedForTrim(pkg, trimId, trim)) continue;

    const included = isPackageIncludedInTrim(pkg, trimId, trim, equipment);
    const missingRequired = missingRequiredPackages(pkg, selectedPackageIds);
    const selected = selectedPackageIds.includes(pkg.id);

    /** @type {PackageStatus} */
    let status = 'available';
    if (included) status = 'included';
    else if (missingRequired.length) status = 'blocked';
    else if (selected) status = 'selected';

    packages.push({
      id: pkg.id,
      name: pkg.name,
      priceGross: pkg.priceGross ?? 0,
      rateDelta: pkg.rateDelta ?? 0,
      group: resolveGroup(pkg),
      highlights: buildHighlights(pkg, equipment),
      status,
      includedInTrimLabel: included ? trimLabel(data, trimId) : null,
      missingRequiredLabels: missingRequired.map((id) => {
        const req = data.packages?.find((p) => p.id === id);
        return req?.name ?? id;
      }),
    });
  }

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

  return { groups, packages };
}

/**
 * Bereinigt gewählte Pakete nach Trim-Wechsel (nicht verfügbar / enthalten entfernen).
 */
export function sanitizePackageIdsForTrim(modelKey, trimId, packageIds = []) {
  const catalog = buildPackageCatalog(modelKey, trimId, packageIds);
  const allowed = new Set(
    catalog.packages
      .filter((p) => p.status === 'available' || p.status === 'selected' || p.status === 'blocked')
      .map((p) => p.id),
  );
  return packageIds.filter((id) => {
    const pkg = catalog.packages.find((p) => p.id === id);
    if (!pkg) return false;
    if (pkg.status === 'included') return false;
    return allowed.has(id);
  });
}

export function formatPackagePrice(priceGross) {
  if (!priceGross) return 'Serie';
  return `+ ${priceGross.toLocaleString('de-DE')} €`;
}
