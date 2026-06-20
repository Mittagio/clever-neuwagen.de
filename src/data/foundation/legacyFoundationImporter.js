/**
 * Importiert Legacy-Hersteller-JS (z. B. kiaSportage) ins Foundation-Format.
 * Keine Heuristik – nur explizite Felder aus der Quelldatei.
 */
import {
  createEmptyFoundationDatabase,
  createRule,
  foundationId,
} from './configuratorFoundationSchema.js';
import { DATA_VERSION_STATUS, RULE_STATUS, RULE_TYPE } from './ruleTypes.js';

function nowIso() {
  return new Date().toISOString();
}

/**
 * @param {object} legacy – z. B. kiaSportage
 * @param {object} meta
 * @param {string} meta.manufacturerId
 * @param {string} meta.manufacturerName
 * @param {string} meta.modelId
 * @param {string} [meta.modelYearId]
 */
export function importLegacyModelToFoundation(legacy, meta) {
  const db = createEmptyFoundationDatabase();
  const ts = nowIso();
  const manufacturerId = meta.manufacturerId;
  const modelId = meta.modelId;
  const modelYearId = meta.modelYearId ?? `${modelId}-${legacy.modelYear ?? 'unknown'}`;
  const sourceFile = legacy.admin?.priceListSource ?? legacy.priceListSource ?? null;

  db.manufacturers.push({
    id: manufacturerId,
    name: meta.manufacturerName,
    slug: manufacturerId,
    status: DATA_VERSION_STATUS.LIVE,
    createdAt: ts,
    updatedAt: ts,
  });

  db.models.push({
    id: modelId,
    manufacturerId,
    name: legacy.model ?? modelId,
    slug: modelId,
    segment: legacy.segment ?? null,
    createdAt: ts,
    updatedAt: ts,
  });

  db.modelYears.push({
    id: modelYearId,
    manufacturerId,
    modelId,
    modelYear: String(legacy.modelYear ?? ''),
    dataVersion: legacy.admin?.priceListDate ?? legacy.priceListDate ?? null,
    status: legacy.admin?.status === 'complete' ? DATA_VERSION_STATUS.LIVE : DATA_VERSION_STATUS.REVIEW,
    priceListDate: legacy.priceListDate ?? legacy.admin?.priceListDate ?? null,
    tagline: legacy.tagline ?? null,
    createdAt: ts,
    updatedAt: ts,
  });

  if (sourceFile) {
    const docId = foundationId('doc');
    db.sourceDocuments.push({
      id: docId,
      manufacturerId,
      modelId,
      modelYearId,
      title: sourceFile,
      fileName: sourceFile,
      importedAt: legacy.admin?.lastUpdated ?? ts.slice(0, 10),
      createdAt: ts,
    });
  }

  const equipmentIdMap = new Map();
  for (const eq of legacy.equipment ?? []) {
    const id = eq.id ?? foundationId('eq');
    equipmentIdMap.set(eq.id ?? id, id);
    db.equipmentItems.push({
      id,
      manufacturerId,
      modelId,
      modelYearId,
      name: eq.name ?? eq.id,
      category: eq.category ?? null,
      createdAt: ts,
      updatedAt: ts,
    });

    for (const trimId of eq.standardInTrims ?? []) {
      db.rules.push(createRule({
        manufacturerId,
        modelId,
        modelYearId,
        trimId,
        equipmentItemId: id,
        ruleType: RULE_TYPE.TRIM_STANDARD_EQUIPMENT,
        value: { equipmentItemId: id },
        source: sourceFile,
        status: RULE_STATUS.LIVE,
        checkedBy: legacy.admin?.updatedBy ?? 'legacy-import',
        checkedAt: ts,
      }));
    }
  }

  for (const engine of legacy.engines ?? []) {
    db.powertrains.push({
      id: engine.id ?? foundationId('pt'),
      manufacturerId,
      modelId,
      modelYearId,
      name: engine.name ?? engine.id,
      fuelType: engine.fuelType ?? null,
      transmission: engine.transmission ?? null,
      drive: engine.drive ?? null,
      batteryKwh: engine.batteryKwh ?? null,
      powerKw: engine.powerKw ?? null,
      powerPs: engine.powerPs ?? null,
      rangeKm: engine.rangeKm ?? null,
      priceFromGross: null,
      createdAt: ts,
      updatedAt: ts,
    });
  }

  for (const trim of legacy.trims ?? []) {
    db.trims.push({
      id: trim.id,
      manufacturerId,
      modelId,
      modelYearId,
      name: trim.name ?? trim.id,
      shortDescription: trim.shortDescription ?? null,
      priceFromGross: null,
      createdAt: ts,
      updatedAt: ts,
    });

    for (const eqId of trim.baseEquipment ?? []) {
      const resolvedEq = equipmentIdMap.get(eqId) ?? eqId;
      db.rules.push(createRule({
        manufacturerId,
        modelId,
        modelYearId,
        trimId: trim.id,
        equipmentItemId: resolvedEq,
        ruleType: RULE_TYPE.TRIM_STANDARD_EQUIPMENT,
        value: { equipmentItemId: resolvedEq },
        source: sourceFile,
        status: RULE_STATUS.LIVE,
        checkedBy: 'legacy-import',
        checkedAt: ts,
      }));
    }
  }

  for (const pkg of legacy.packages ?? []) {
    const packageId = pkg.id ?? foundationId('pkg');
    db.optionPackages.push({
      id: packageId,
      manufacturerId,
      modelId,
      modelYearId,
      code: pkg.id ?? packageId,
      name: pkg.name ?? pkg.id,
      description: pkg.description ?? null,
      group: pkg.group ?? null,
      createdAt: ts,
      updatedAt: ts,
    });

    for (const featureId of pkg.features ?? []) {
      const eqId = equipmentIdMap.get(featureId) ?? featureId;
      db.packageContents.push({
        id: foundationId('pc'),
        manufacturerId,
        modelId,
        modelYearId,
        packageId,
        equipmentItemId: eqId,
        sortOrder: 0,
      });
    }

    for (const trimId of pkg.availableTrims ?? []) {
      db.rules.push(createRule({
        manufacturerId,
        modelId,
        modelYearId,
        trimId,
        packageId,
        ruleType: RULE_TYPE.PACKAGE_AVAILABILITY,
        value: { available: true },
        source: sourceFile,
        status: RULE_STATUS.LIVE,
        checkedBy: 'legacy-import',
        checkedAt: ts,
      }));
    }

    for (const trimId of pkg.includedInTrims ?? []) {
      db.rules.push(createRule({
        manufacturerId,
        modelId,
        modelYearId,
        trimId,
        packageId,
        ruleType: RULE_TYPE.PACKAGE_INCLUDED,
        value: { included: true },
        source: sourceFile,
        status: RULE_STATUS.LIVE,
        checkedBy: 'legacy-import',
        checkedAt: ts,
      }));
    }

    const required = pkg.requiredPackages ?? pkg.requiresPackages ?? [];
    if (required.length) {
      db.rules.push(createRule({
        manufacturerId,
        modelId,
        modelYearId,
        packageId,
        ruleType: RULE_TYPE.PACKAGE_DEPENDENCY,
        value: { requiredPackageIds: required },
        source: sourceFile,
        status: RULE_STATUS.LIVE,
        checkedBy: 'legacy-import',
        checkedAt: ts,
      }));
    }

    if (pkg.priceGross != null) {
      db.rules.push(createRule({
        manufacturerId,
        modelId,
        modelYearId,
        packageId,
        ruleType: RULE_TYPE.PRICE,
        value: { target: 'package' },
        price: pkg.priceGross,
        source: sourceFile,
        status: RULE_STATUS.LIVE,
        checkedBy: 'legacy-import',
        checkedAt: ts,
      }));
    }
  }

  for (const trim of legacy.trims ?? []) {
    for (const packageId of trim.availablePackages ?? []) {
      db.rules.push(createRule({
        manufacturerId,
        modelId,
        modelYearId,
        trimId: trim.id,
        packageId,
        ruleType: RULE_TYPE.PACKAGE_AVAILABILITY,
        value: { available: true },
        source: sourceFile,
        status: RULE_STATUS.LIVE,
        checkedBy: 'legacy-import',
        checkedAt: ts,
      }));
    }

    for (const packageId of trim.includedPackages ?? []) {
      db.rules.push(createRule({
        manufacturerId,
        modelId,
        modelYearId,
        trimId: trim.id,
        packageId,
        ruleType: RULE_TYPE.PACKAGE_INCLUDED,
        value: { included: true },
        source: sourceFile,
        status: RULE_STATUS.LIVE,
        checkedBy: 'legacy-import',
        checkedAt: ts,
      }));
    }
  }

  for (const dep of legacy.packageDependencies ?? []) {
    if (dep.requiresPackages?.length) {
      db.rules.push(createRule({
        manufacturerId,
        modelId,
        modelYearId,
        packageId: dep.packageId,
        ruleType: RULE_TYPE.PACKAGE_DEPENDENCY,
        value: { requiredPackageIds: dep.requiresPackages, note: dep.note ?? null },
        source: sourceFile,
        status: RULE_STATUS.LIVE,
        checkedBy: 'legacy-import',
        checkedAt: ts,
      }));
    }
  }

  for (const v of legacy.variants ?? []) {
    db.variants.push({
      id: v.id ?? foundationId('var'),
      manufacturerId,
      modelId,
      modelYearId,
      trimId: v.trimId,
      powertrainId: v.engineId ?? null,
      priceGross: v.priceGross,
      baseLeasingRate: v.baseLeasingRate ?? null,
    });
  }

  const trimIds = (legacy.trims ?? []).map((t) => t.id);

  for (const color of legacy.colors ?? []) {
    const colorId = color.id ?? foundationId('color');
    const colorTrims = color.availableTrims?.length ? color.availableTrims : trimIds;
    for (const trimId of colorTrims) {
      db.rules.push(createRule({
        manufacturerId,
        modelId,
        modelYearId,
        trimId,
        colorId,
        ruleType: RULE_TYPE.COLOR,
        value: {
          colorId,
          label: color.label ?? color.name ?? colorId,
          priceGross: color.priceGross ?? 0,
          hexPreview: color.hexPreview ?? null,
        },
        price: color.priceGross ?? 0,
        source: sourceFile,
        status: RULE_STATUS.LIVE,
        checkedBy: 'legacy-import',
        checkedAt: ts,
      }));
    }
  }

  for (const entry of legacy.changeLog ?? []) {
    db.changeLogs.push({
      id: foundationId('log'),
      manufacturerId,
      modelId,
      modelYearId,
      summary: entry.change ?? entry.summary ?? 'Änderung',
      source: entry.source ?? sourceFile,
      author: entry.author ?? legacy.admin?.updatedBy ?? null,
      status: entry.status === 'published' ? RULE_STATUS.LIVE : RULE_STATUS.DRAFT,
      createdAt: entry.date ? `${entry.date}T12:00:00.000Z` : ts,
    });
  }

  return db;
}

/**
 * Merge mehrere Foundation-DBs (z. B. Seed + Server).
 * @param {...import('./configuratorFoundationTypes.js').ConfiguratorFoundationDatabase} dbs
 */
const SCOPED_FOUNDATION_COLLECTIONS = new Set([
  'powertrains', 'trims', 'equipmentItems', 'optionPackages',
  'packageContents', 'variants', 'rules', 'sourceDocuments', 'changeLogs',
]);

function foundationMergeKey(collectionKey, item) {
  if (SCOPED_FOUNDATION_COLLECTIONS.has(collectionKey)) {
    return `${item.modelYearId ?? ''}|${item.id}`;
  }
  return item.id;
}

export function mergeFoundationDatabases(...dbs) {
  const merged = createEmptyFoundationDatabase();
  const collections = [
    'manufacturers', 'models', 'modelYears', 'powertrains', 'trims',
    'equipmentItems', 'optionPackages', 'packageContents', 'variants', 'rules',
    'sourceDocuments', 'changeLogs',
  ];

  for (const db of dbs) {
    if (!db) continue;
    for (const key of collections) {
      const items = db[key] ?? [];
      const existingKeys = new Set(merged[key].map((item) => foundationMergeKey(key, item)));
      for (const item of items) {
        const mergeKey = foundationMergeKey(key, item);
        if (!existingKeys.has(mergeKey)) {
          merged[key].push(item);
          existingKeys.add(mergeKey);
        }
      }
    }
  }

  return merged;
}
