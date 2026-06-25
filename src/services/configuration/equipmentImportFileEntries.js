/**
 * Browser-/Vite-sichere Hilfen für Ausstattungs-JSON-Importe (ohne node:fs).
 */

/** @typedef {import('../../data/features/modelEquipmentSchema.js').EquipmentImportRecord} EquipmentImportRecord */

/**
 * @typedef {object} EquipmentImportFileEntry
 * @property {string} filePath
 * @property {string} fileName
 * @property {EquipmentImportRecord} importData
 */

/**
 * @param {string} filePath
 */
export function extractFileNameFromPath(filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  const segments = normalized.split('/');
  return segments[segments.length - 1] ?? filePath;
}

/**
 * Baut Einträge aus einem Vite-import.meta.glob-Ergebnis.
 * @param {Record<string, EquipmentImportRecord | { default: EquipmentImportRecord }>} modules
 * @returns {EquipmentImportFileEntry[]}
 */
export function buildEquipmentImportFileEntries(modules) {
  return Object.entries(modules)
    .map(([filePath, moduleValue]) => {
      const importData = moduleValue?.default ?? moduleValue;
      return {
        filePath,
        fileName: extractFileNameFromPath(filePath),
        importData,
      };
    })
    .sort((a, b) => a.fileName.localeCompare(b.fileName, 'de'));
}
