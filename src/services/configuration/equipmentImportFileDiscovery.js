/**
 * Hilfsfunktionen zum Auflösen von Ausstattungs-JSON-Importen (glob / Dateisystem).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

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

/**
 * Node-/Test-Fallback: liest *.equipment.json aus dem Import-Ordner.
 * @param {URL | string} equipmentDirUrl
 * @returns {EquipmentImportFileEntry[]}
 */
export function discoverEquipmentImportFilesFromFilesystem(equipmentDirUrl) {
  const equipmentDir = fileURLToPath(equipmentDirUrl);
  return readdirSync(equipmentDir)
    .filter((name) => name.endsWith('.equipment.json'))
    .sort((a, b) => a.localeCompare(b, 'de'))
    .map((fileName) => {
      const absolutePath = path.join(equipmentDir, fileName);
      const importData = JSON.parse(readFileSync(absolutePath, 'utf8'));
      return {
        filePath: absolutePath.replace(/\\/g, '/'),
        fileName,
        importData,
      };
    });
}
