/**
 * Client-seitige Foundation-Registry (Seed + Lookup).
 * Server-Persistenz überschreibt via API später – Seller-Flow nutzt immer Regeln aus DB/Seed.
 */
import {
  getModelYearBundle,
} from '../../data/foundation/configuratorFoundationSchema.js';
import {
  kiaFoundationSeed,
  KIA_FOUNDATION_DEFAULTS,
  KIA_MODEL_YEAR_BY_KEY,
} from '../../data/foundation/seeds/kiaFoundationSeed.js';
import { DATA_VERSION_STATUS } from '../../data/foundation/ruleTypes.js';
import { foundationBundleToLegacyEntry } from './foundationToLegacyAdapter.js';

let activeDatabase = kiaFoundationSeed;

const MODEL_YEAR_INDEX = { ...KIA_MODEL_YEAR_BY_KEY };

export function setFoundationDatabase(db) {
  if (db) activeDatabase = db;
}

export function getFoundationDatabase() {
  return activeDatabase;
}

export function resolveFoundationModelYearId(modelKey) {
  const key = String(modelKey ?? '').trim().toLowerCase();
  return MODEL_YEAR_INDEX[key] ?? null;
}

export function resolveFoundationBundle(modelKey) {
  const modelYearId = resolveFoundationModelYearId(modelKey);
  if (!modelYearId) return null;
  const bundle = getModelYearBundle(activeDatabase, modelYearId);
  if (!bundle?.modelYear) return null;

  const status = bundle.modelYear.status;
  if (status === DATA_VERSION_STATUS.ARCHIVED) return null;

  return bundle;
}

export function hasFoundationModel(modelKey) {
  return Boolean(resolveFoundationBundle(modelKey));
}

/**
 * Legacy-Eintrag für configureModelBridge / Seller-Konfigurator.
 * @param {string} modelKey
 */
export function resolveFoundationLegacyEntry(modelKey) {
  const bundle = resolveFoundationBundle(modelKey);
  if (!bundle) return null;

  const defaults = KIA_FOUNDATION_DEFAULTS[modelKey] ?? {};
  return foundationBundleToLegacyEntry(bundle, {
    ...defaults,
    engineKey: modelKey,
  });
}

export function listFoundationModelKeys() {
  return Object.keys(MODEL_YEAR_INDEX);
}
