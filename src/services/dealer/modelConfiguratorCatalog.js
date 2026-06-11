/**
 * Konfigurator-Katalog – Phase 2 der Customer Journey.
 */
import { sorentoConfigurator } from '../../data/models/kia/sorentoConfigurator.js';
import { KIA_MODEL_ATTRIBUTES } from '../../data/kia/kiaModelAttributes.js';

/** @type {Record<string, typeof sorentoConfigurator>} */
const CATALOG_BY_ID = {
  sorento: sorentoConfigurator,
};

const MODEL_TO_CATALOG_ID = {
  sorento: 'sorento',
  'sorento-hybrid': 'sorento',
  'sorento-phev': 'sorento',
};

/**
 * @param {string} modelKey
 */
export function resolveConfiguratorCatalogId(modelKey) {
  const key = String(modelKey ?? '').toLowerCase();
  return MODEL_TO_CATALOG_ID[key] ?? null;
}

/**
 * @param {string} modelKey
 */
export function resolveConfiguratorCatalog(modelKey) {
  const id = resolveConfiguratorCatalogId(modelKey);
  return id ? CATALOG_BY_ID[id] ?? null : null;
}

export function hasConfigurator(modelKey) {
  return Boolean(resolveConfiguratorCatalog(modelKey));
}

/**
 * @param {string} modelKey
 */
export function createDefaultConfiguration(modelKey) {
  const catalog = resolveConfiguratorCatalog(modelKey);
  if (!catalog) return null;

  return {
    catalogId: catalog.id,
    modelKey: catalog.modelKey,
    colorId: catalog.defaults.colorId,
    powertrainId: catalog.defaults.powertrainId,
    trimId: catalog.defaults.trimId,
    packageIds: [...(catalog.defaults.packageIds ?? [])],
  };
}

/**
 * @param {object} config
 */
export function summarizeConfiguration(config) {
  const catalog = CATALOG_BY_ID[config?.catalogId];
  if (!catalog || !config) return null;

  const color = catalog.colors.find((c) => c.id === config.colorId);
  const powertrain = catalog.powertrains.find((p) => p.id === config.powertrainId);
  const trim = catalog.trims.find((t) => t.id === config.trimId);
  const packages = catalog.packages.filter((p) => config.packageIds?.includes(p.id));

  const powertrainModelKey = powertrain?.modelKey ?? catalog.modelKey;
  const modelLabel = KIA_MODEL_ATTRIBUTES[powertrainModelKey]?.label
    ?? KIA_MODEL_ATTRIBUTES[catalog.modelKey]?.label
    ?? catalog.label;

  return {
    catalogId: catalog.id,
    modelKey: powertrainModelKey,
    modelLabel,
    colorLabel: color?.label ?? null,
    powertrainLabel: powertrain?.label ?? null,
    trimLabel: trim?.label ?? null,
    packageLabels: packages.map((p) => p.label),
    imageSlug: color?.imageSlug ?? null,
  };
}

/**
 * Interesse-Optionen aus Smart-Answer (Vergleich oder Einzelmodell).
 * @param {object} answer
 */
export function buildInterestOptions(answer) {
  if (!answer) return [];

  /** @type {string[]} */
  const keys = [];
  if (answer.compareModelKeys?.length) {
    keys.push(...answer.compareModelKeys);
  } else if (answer.modelCards?.length) {
    keys.push(...answer.modelCards.map((c) => c.modelKey));
  } else if (answer.highlights?.length > 1) {
    keys.push(...answer.highlights.map((h) => h.modelKey));
  } else if (answer.primaryModelKey) {
    keys.push(answer.primaryModelKey);
  }

  const unique = [...new Set(keys.filter(Boolean))];

  return unique.map((modelKey) => {
    const attrs = KIA_MODEL_ATTRIBUTES[modelKey];
    const label = attrs?.label ?? String(modelKey).toUpperCase();
    const catalog = resolveConfiguratorCatalog(modelKey);

    return {
      modelKey,
      label,
      catalogId: catalog?.id ?? null,
      hasConfigurator: Boolean(catalog),
      cta: catalog ? `${label} konfigurieren` : `Mehr zum ${label}`,
    };
  });
}
