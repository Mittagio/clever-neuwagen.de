/**
 * Herstellerübergreifendes Konfigurator-Fundament – Datenmodell & Hilfsfunktionen.
 *
 * Alle Paketlogik, Abhängigkeiten und Preise leben als Regeln in der DB –
 * nicht in UI-Komponenten und nicht in KI-Heuristiken.
 */
import {
  DATA_VERSION_STATUS,
  RULE_STATUS,
  RULE_TYPE,
} from './ruleTypes.js';

let idCounter = 0;

export function foundationId(prefix = 'cf') {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter.toString(36)}`;
}

export function resetFoundationIdCounter() {
  idCounter = 0;
}

/**
 * @returns {import('./configuratorFoundationTypes.js').ConfiguratorFoundationDatabase}
 */
export function createEmptyFoundationDatabase() {
  return {
    schemaVersion: 1,
    manufacturers: [],
    models: [],
    modelYears: [],
    powertrains: [],
    trims: [],
    equipmentItems: [],
    optionPackages: [],
    packageContents: [],
    variants: [],
    rules: [],
    sourceDocuments: [],
    changeLogs: [],
  };
}

/**
 * @param {Partial<import('./configuratorFoundationTypes.js').FoundationRule>} fields
 */
export function createRule(fields) {
  const now = new Date().toISOString();
  return {
    id: fields.id ?? foundationId('rule'),
    manufacturerId: fields.manufacturerId,
    modelId: fields.modelId,
    modelYearId: fields.modelYearId,
    trimId: fields.trimId ?? null,
    powertrainId: fields.powertrainId ?? null,
    packageId: fields.packageId ?? null,
    equipmentItemId: fields.equipmentItemId ?? null,
    colorId: fields.colorId ?? null,
    ruleType: fields.ruleType,
    value: fields.value ?? {},
    price: fields.price ?? null,
    validFrom: fields.validFrom ?? now.slice(0, 10),
    validTo: fields.validTo ?? null,
    source: fields.source ?? null,
    sourceDocumentId: fields.sourceDocumentId ?? null,
    checkedBy: fields.checkedBy ?? null,
    checkedAt: fields.checkedAt ?? null,
    status: fields.status ?? RULE_STATUS.DRAFT,
    createdAt: fields.createdAt ?? now,
    updatedAt: fields.updatedAt ?? now,
  };
}

/**
 * @param {import('./configuratorFoundationTypes.js').ConfiguratorFoundationDatabase} db
 * @param {string} modelYearId
 */
export function getModelYearBundle(db, modelYearId) {
  const modelYear = db.modelYears.find((my) => my.id === modelYearId) ?? null;
  if (!modelYear) return null;

  const model = db.models.find((m) => m.id === modelYear.modelId) ?? null;
  const manufacturer = db.manufacturers.find((m) => m.id === modelYear.manufacturerId) ?? null;

  const scope = {
    manufacturerId: modelYear.manufacturerId,
    modelId: modelYear.modelId,
    modelYearId,
  };

  return {
    manufacturer,
    model,
    modelYear,
    powertrains: db.powertrains.filter((p) => p.modelYearId === modelYearId),
    trims: db.trims.filter((t) => t.modelYearId === modelYearId),
    equipmentItems: db.equipmentItems.filter((e) => e.modelYearId === modelYearId),
    optionPackages: db.optionPackages.filter((p) => p.modelYearId === modelYearId),
    packageContents: db.packageContents.filter((pc) => pc.modelYearId === modelYearId),
    variants: db.variants.filter((v) => v.modelYearId === modelYearId),
    rules: db.rules.filter((r) => r.modelYearId === modelYearId),
    sourceDocuments: db.sourceDocuments.filter((s) => s.modelYearId === modelYearId),
    changeLogs: db.changeLogs.filter((c) => c.modelYearId === modelYearId),
    scope,
  };
}

/**
 * @param {import('./configuratorFoundationTypes.js').ConfiguratorFoundationDatabase} db
 * @param {string} manufacturerId
 */
export function listModelsForManufacturer(db, manufacturerId) {
  return db.models.filter((m) => m.manufacturerId === manufacturerId);
}

/**
 * @param {import('./configuratorFoundationTypes.js').ConfiguratorFoundationDatabase} db
 * @param {string} modelId
 */
export function listModelYearsForModel(db, modelId) {
  return db.modelYears.filter((my) => my.modelId === modelId);
}

export function isRuleActive(rule, asOf = new Date()) {
  if (!rule) return false;
  const from = rule.validFrom ? new Date(rule.validFrom) : null;
  const to = rule.validTo ? new Date(rule.validTo) : null;
  if (from && asOf < from) return false;
  if (to && asOf > to) return false;
  return true;
}

export function summarizeModelYearStatus(bundle) {
  if (!bundle?.modelYear) {
    return { status: DATA_VERSION_STATUS.DRAFT, label: 'Unbekannt', issues: 1 };
  }

  const rules = bundle.rules ?? [];
  const liveRules = rules.filter((r) => r.status === RULE_STATUS.LIVE).length;
  const draftRules = rules.filter((r) => r.status === RULE_STATUS.DRAFT).length;
  const packages = bundle.optionPackages?.length ?? 0;
  const trims = bundle.trims?.length ?? 0;

  let status = bundle.modelYear.status ?? DATA_VERSION_STATUS.DRAFT;
  let label = 'Entwurf';

  if (status === DATA_VERSION_STATUS.LIVE && liveRules > 0 && packages > 0 && trims > 0) {
    label = 'Live';
  } else if (liveRules > 0 || bundle.modelYear.status === DATA_VERSION_STATUS.REVIEW) {
    status = DATA_VERSION_STATUS.REVIEW;
    label = 'In Prüfung';
  } else if (draftRules > 0) {
    label = 'Entwurf';
  }

  return {
    status,
    label,
    liveRules,
    draftRules,
    packages,
    trims,
    powertrains: bundle.powertrains?.length ?? 0,
    equipmentItems: bundle.equipmentItems?.length ?? 0,
  };
}

export { RULE_TYPE, RULE_STATUS, DATA_VERSION_STATUS };
