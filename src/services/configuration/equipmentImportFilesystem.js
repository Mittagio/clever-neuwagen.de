/**
 * Node-only: Dateisystem-Fallback für Ausstattungs-JSON-Importe (Tests, kein Browser).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/** @typedef {import('./equipmentImportFileEntries.js').EquipmentImportFileEntry} EquipmentImportFileEntry */

/**
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
