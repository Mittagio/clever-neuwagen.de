/**
 * Lädt strukturierte Ausstattungs-JSON-Dateien und registriert sie in Layer 2.
 * Vite: import.meta.glob über equipmentImportGlobEntries.js (automatisch alle *.equipment.json).
 */
import {
  ingestEquipmentImport,
  normalizeImportModelKey,
  validateEquipmentImport,
} from './equipmentImportMapper.js';
import { reapplyFeatureAliasMappingsForAllImportedModels } from '../admin/featureAliasProfileApplier.js';

/** @typedef {import('../../data/features/modelEquipmentSchema.js').EquipmentImportRecord} EquipmentImportRecord */
/** @typedef {import('./equipmentImportFileEntries.js').EquipmentImportFileEntry} EquipmentImportFileEntry */

const equipmentDirUrl = new URL('../../data/imports/equipment/', import.meta.url);

/** @type {EquipmentImportFileEntry[]} */
let equipmentImportFileEntries = [];

try {
  const globEntries = await import('./equipmentImportGlobEntries.js');
  equipmentImportFileEntries = globEntries.EQUIPMENT_IMPORT_FILE_ENTRIES ?? [];
} catch {
  equipmentImportFileEntries = [];
}

const isNodeRuntime = typeof process !== 'undefined' && Boolean(process.versions?.node);

if (equipmentImportFileEntries.length === 0 && isNodeRuntime) {
  try {
    const fsMod = await import(/* @vite-ignore */ './equipmentImportFilesystem.js');
    equipmentImportFileEntries = fsMod.discoverEquipmentImportFilesFromFilesystem(equipmentDirUrl);
  } catch {
    equipmentImportFileEntries = [];
  }
}

export const EQUIPMENT_IMPORT_FILE_ENTRIES = equipmentImportFileEntries;

export const EQUIPMENT_IMPORT_FILES = EQUIPMENT_IMPORT_FILE_ENTRIES.map(
  (entry) => entry.importData,
);

/** @type {Map<string, object>} */
const loadSummariesByFile = new Map();

/** @type {Set<string>} */
const registeredDedupeKeys = new Set();

let defaultImportsRegistered = false;

/**
 * @param {EquipmentImportRecord} importData
 */
export function buildEquipmentImportDedupeKey(importData) {
  const modelKey = normalizeImportModelKey(importData.modelKey);
  const year = String(importData.modelYear ?? '');
  const documentName = importData.source?.documentName ?? '';
  return `${modelKey}::${year}::${documentName}`;
}

/**
 * @param {ReturnType<typeof validateEquipmentImport>} validation
 * @param {boolean} registered
 * @param {boolean} skipped
 * @param {string | null} reason
 */
function resolveImportStatus(validation, registered, skipped, reason) {
  if (!validation.valid) return 'failed';
  if (skipped && reason === 'duplicate') return 'skipped';
  if (registered) return 'registered';
  if (skipped) return 'skipped';
  return 'failed';
}

/**
 * @returns {Array<{
 *   filePath: string,
 *   fileName: string,
 *   modelKey: string,
 *   brand: string | null,
 *   model: string | null,
 *   modelYear: string | null,
 *   documentName: string | null,
 *   dedupeKey: string,
 *   importData: EquipmentImportRecord,
 *   validation: ReturnType<typeof validateEquipmentImport>,
 * }>}
 */
export function loadEquipmentImportFiles() {
  return EQUIPMENT_IMPORT_FILE_ENTRIES.map(({ filePath, fileName, importData }) => {
    const validation = validateEquipmentImport(importData);
    return {
      filePath,
      fileName,
      modelKey: normalizeImportModelKey(importData.modelKey),
      brand: importData.brand ?? null,
      model: importData.model ?? null,
      modelYear: importData.modelYear ?? null,
      documentName: importData.source?.documentName ?? null,
      dedupeKey: buildEquipmentImportDedupeKey(importData),
      importData,
      validation,
    };
  });
}

/**
 * @param {string} modelKey
 * @returns {EquipmentImportRecord | null}
 */
export function loadEquipmentImportByModelKey(modelKey) {
  const normalized = normalizeImportModelKey(modelKey);
  const entry = EQUIPMENT_IMPORT_FILE_ENTRIES.find(
    ({ importData }) => normalizeImportModelKey(importData.modelKey) === normalized,
  );
  return entry?.importData ?? null;
}

/**
 * @returns {object[]}
 */
export function getLoadedEquipmentImportSummaries() {
  return [...loadSummariesByFile.values()];
}

/**
 * @param {EquipmentImportRecord} importData
 * @param {{ fileName?: string, filePath?: string, dataOrigin?: string }} [options]
 */
export function tryRegisterEquipmentImportRecord(importData, options = {}) {
  const fileName = options.fileName ?? 'inline-import';
  const filePath = options.filePath ?? fileName;
  const validation = validateEquipmentImport(importData);
  const dedupeKey = buildEquipmentImportDedupeKey(importData);
  const modelKey = normalizeImportModelKey(importData.modelKey);

  /** @type {Record<string, unknown>} */
  const summary = {
    filePath,
    fileName,
    modelKey,
    brand: importData.brand ?? null,
    model: importData.model ?? null,
    modelYear: importData.modelYear ?? null,
    documentName: importData.source?.documentName ?? null,
    dedupeKey,
    validation,
    errors: validation.errors,
    warnings: validation.warnings,
    registered: false,
    skipped: false,
    reason: null,
    status: 'failed',
  };

  if (!validation.valid) {
    console.warn(
      `[equipmentImportLoader] ${fileName}: Validierung fehlgeschlagen`,
      validation.errors,
    );
    summary.reason = 'validation_failed';
    summary.status = resolveImportStatus(validation, false, false, summary.reason);
    loadSummariesByFile.set(fileName, summary);
    return summary;
  }

  if (validation.warnings.length > 0) {
    console.warn(
      `[equipmentImportLoader] ${fileName}: Warnungen`,
      validation.warnings,
    );
  }

  if (registeredDedupeKeys.has(dedupeKey)) {
    summary.skipped = true;
    summary.reason = 'duplicate';
    summary.status = resolveImportStatus(validation, false, true, summary.reason);
    loadSummariesByFile.set(fileName, summary);
    return summary;
  }

  const ingestResult = ingestEquipmentImport(importData, {
    register: true,
    mergeExisting: true,
    dataOrigin: options.dataOrigin ?? 'json_import',
    importFile: fileName,
  });

  if (ingestResult.registered) {
    registeredDedupeKeys.add(dedupeKey);
    summary.registered = true;
    summary.unknownFeatureCount = ingestResult.unknownFeatures?.length ?? 0;
    summary.status = 'registered';
  } else {
    summary.reason = 'ingest_failed';
    summary.status = 'failed';
  }

  loadSummariesByFile.set(fileName, summary);
  return summary;
}

/**
 * @returns {object[]}
 */
export function registerEquipmentImportsFromFiles() {
  const results = [];
  for (const { filePath, fileName, importData } of EQUIPMENT_IMPORT_FILE_ENTRIES) {
    results.push(tryRegisterEquipmentImportRecord(importData, {
      filePath,
      fileName,
      dataOrigin: 'json_import',
    }));
  }
  reapplyFeatureAliasMappingsForAllImportedModels();
  return results;
}

/**
 * Idempotente Registrierung aller Standard-JSON-Imports beim App-Start.
 * @returns {object[]}
 */
export function registerDefaultEquipmentImports() {
  if (defaultImportsRegistered) {
    return getLoadedEquipmentImportSummaries();
  }

  const results = registerEquipmentImportsFromFiles();
  reapplyFeatureAliasMappingsForAllImportedModels();
  defaultImportsRegistered = true;
  return results;
}

/** Nur für Tests – setzt Loader-Zustand zurück. */
export function resetEquipmentImportLoaderState() {
  loadSummariesByFile.clear();
  registeredDedupeKeys.clear();
  defaultImportsRegistered = false;
}
